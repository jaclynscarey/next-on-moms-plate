-- Run once using Supabase's SQL editor or CLI. Client writes use guarded RPCs.
create type public.order_status as enum ('pending','changes_requested','queued','on_hold','printing','completed','denied','cancelled');
create table public.profiles(id uuid primary key references auth.users on delete cascade,name text not null,role text not null default 'member' check(role in ('member','admin')));
create unique index one_admin on public.profiles(role) where role='admin';
create table public.invitations(email text primary key,name text not null,created_at timestamptz not null default now());
create table public.recipients(id uuid primary key default gen_random_uuid(),name text unique not null);
create table public.filaments(id uuid primary key default gen_random_uuid(),name text not null,brand text not null default '',material text not null default 'PLA',color text not null default '#c4a4de',available boolean not null default true);
create table public.orders(id uuid primary key default gen_random_uuid(),submitter_id uuid not null references public.profiles,submitted_at timestamptz not null default clock_timestamp(),status public.order_status not null default 'pending',version integer not null default 1,title text not null,model_url text not null,quantity integer not null check(quantity between 1 and 100),recipient text not null,notes text not null default '',parts jsonb not null,hold_reason text not null default '');
create table public.order_comments(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete cascade,author_id uuid not null references public.profiles,body text not null check(length(body) between 1 and 4000),created_at timestamptz not null default now());
create table public.order_images(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete cascade,path text unique not null);
create table public.order_events(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders,actor_id uuid references public.profiles,kind text not null,note text not null default '',created_at timestamptz not null default now());
create table public.notification_outbox(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders,event_id uuid not null unique references public.order_events,recipient text not null,kind text not null,attempts integer not null default 0,claimed_at timestamptz,sent_at timestamptz,last_error text,first_attempt_at timestamptz,next_attempt_at timestamptz,delivery_unknown boolean not null default false);

create function public.is_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid())$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;

-- Create the first auth user in the dashboard, then insert that user's UUID as
-- the sole admin using the SQL editor. All subsequent users need invitations.
create function public.accept_invited_user() returns trigger language plpgsql security definer set search_path='' as $$
declare invitation public.invitations;
begin
 select * into invitation from public.invitations where email=lower(new.email) for update;
 if found then
  insert into public.profiles(id,name) values(new.id,invitation.name);
  delete from public.invitations where email=lower(new.email);
 elsif exists(select 1 from public.profiles where role='admin') then
  raise exception 'An invitation is required';
 end if;
 return new;
end;$$;
create trigger invited_user after insert on auth.users for each row execute function public.accept_invited_user();

create function public.validate_print_payload(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare part jsonb;
begin
 if coalesce(length(trim(p->>'title')),0) not between 1 and 160 or coalesce(length(trim(p->>'recipient')),0) not between 1 and 100 or coalesce(length(p->>'notes'),0)>4000 then raise exception 'Invalid request details'; end if;
 if coalesce(p->>'modelUrl','') !~ '^https://(www\.)?makerworld\.com/([a-z]{2}(-[A-Za-z]{2})?/)?models/[0-9]+([-/].*|([?#].*)?)$' or (p->>'modelUrl') ~ '[[:cntrl:]\\]' or (p->>'modelUrl') ~* '(^|/|%2f)(\.|%2e){1,2}(/|%2f|[?#]|$)' then raise exception 'Use a MakerWorld model URL'; end if;
 if jsonb_typeof(p->'quantity')<>'number' or (p->>'quantity') !~ '^[0-9]+$' or (p->>'quantity')::numeric not between 1 and 100 then raise exception 'Invalid quantity'; end if;
 if jsonb_typeof(p->'parts') is distinct from 'array' then raise exception 'Add parts'; end if;
 if jsonb_array_length(p->'parts') not between 1 and 40 then raise exception 'Add parts'; end if;
 for part in select * from jsonb_array_elements(p->'parts') loop
  if coalesce(length(trim(part->>'name')),0) not between 1 and 100 then raise exception 'Name each part'; end if;
  if (coalesce(part->>'filamentId','')='')=(coalesce(trim(part->>'special'),'')='') then raise exception 'Choose one filament or special request'; end if;
  if coalesce(length(part->>'special'),0)>500 then raise exception 'Special request too long'; end if;
  if coalesce(part->>'filamentId','')<>'' and not exists(select 1 from public.filaments where id::text=part->>'filamentId' and available) then raise exception 'Filament unavailable'; end if;
 end loop;
end;$$;

create function public.record_order_event(oid uuid,kind text,note text default '') returns void language plpgsql security definer set search_path='' as $$
declare eid uuid; dest text;
begin
 insert into public.order_events(order_id,actor_id,kind,note) values(oid,auth.uid(),kind,coalesce(note,'')) returning id into eid;
 if kind in ('submitted','resubmitted') then select u.email into dest from auth.users u join public.profiles p on p.id=u.id where p.role='admin';
 elsif kind in ('approve','deny','request_changes','complete') then select u.email into dest from auth.users u join public.orders o on o.submitter_id=u.id where o.id=oid;
 end if;
 if dest is not null then insert into public.notification_outbox(order_id,event_id,recipient,kind) values(oid,eid,dest,kind); end if;
end;$$;

create function public.submit_order(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 if not public.is_member() then raise exception 'Invitation required'; end if;
 perform public.validate_print_payload(payload);
 insert into public.orders(submitter_id,title,model_url,quantity,recipient,notes,parts) values(auth.uid(),trim(payload->>'title'),payload->>'modelUrl',(payload->>'quantity')::integer,trim(payload->>'recipient'),coalesce(payload->>'notes',''),payload->'parts') returning id into oid;
 perform public.record_order_event(oid,'submitted'); return oid;
end;$$;

create function public.mutate_order(order_id uuid,expected_version integer,action text,payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; target public.order_status; reason text:=trim(coalesce(payload->>'note',''));
begin
 if not public.is_member() then raise exception 'Invitation required'; end if;
 -- Serialize all state changes, including a release or late approval that can
 -- change the first-ready order concurrently with a start.
 perform pg_advisory_xact_lock(7431901);
 select * into o from public.orders where id=order_id for update;
 if not found or o.version is distinct from expected_version then raise exception 'Order changed. Refresh and try again.'; end if;
 if action in ('edit','cancel') then
  if o.submitter_id<>auth.uid() or o.status not in ('pending','changes_requested','queued','on_hold') then raise exception 'Order cannot be edited'; end if;
  if action='edit' then
   perform public.validate_print_payload(payload);
   if payload->>'modelUrl'<>o.model_url then raise exception 'A different model needs a new order'; end if;
   update public.orders set title=trim(payload->>'title'),quantity=(payload->>'quantity')::integer,recipient=trim(payload->>'recipient'),notes=coalesce(payload->>'notes',''),parts=payload->'parts',status='pending',hold_reason='',version=version+1 where id=order_id;
   perform public.record_order_event(order_id,'resubmitted'); return;
  end if;
  target:='cancelled';
 else
  if not public.is_admin() then raise exception 'Admin required'; end if;
  if action in ('deny','request_changes','hold') and reason='' then raise exception 'Add a reason'; end if;
  if action='approve' and o.status='pending' then target:='queued';
  elsif action='deny' and o.status in ('pending','changes_requested','queued','on_hold') then target:='denied';
  elsif action='request_changes' and o.status in ('pending','queued','on_hold') then target:='changes_requested';
  elsif action='hold' and o.status in ('queued','printing') then target:='on_hold';
  elsif action='release' and o.status='on_hold' then target:='queued';
  elsif action='start' and o.status='queued' then
   if exists(select 1 from public.orders where status='printing') then raise exception 'Finish or hold the current print first'; end if;
   if o.id is distinct from (select id from public.orders where status='queued' order by submitted_at,id limit 1) then raise exception 'Start the oldest ready request first'; end if;
   target:='printing';
  elsif action='complete' and o.status='printing' then target:='completed';
  elsif action='retry' and o.status='printing' then target:='queued';
  else raise exception 'Invalid transition'; end if;
 end if;
 update public.orders set status=target,version=version+1,hold_reason=case when action='hold' then reason else '' end where id=order_id;
 perform public.record_order_event(order_id,action,reason);
end;$$;

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.recipients enable row level security;
alter table public.filaments enable row level security;
alter table public.orders enable row level security;
alter table public.order_comments enable row level security;
alter table public.order_images enable row level security;
alter table public.order_events enable row level security;
alter table public.notification_outbox enable row level security;
create policy members_read_profiles on public.profiles for select to authenticated using(public.is_member());
create policy admin_invitations on public.invitations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy read_recipients on public.recipients for select to authenticated using(public.is_member());
create policy admin_recipients on public.recipients for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy read_filaments on public.filaments for select to authenticated using(public.is_member());
create policy admin_filaments on public.filaments for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy read_orders on public.orders for select to authenticated using(public.is_member());
create policy read_images on public.order_images for select to authenticated using(public.is_admin() or exists(select 1 from public.orders where id=order_id and submitter_id=auth.uid()));
create policy read_events on public.order_events for select to authenticated using(public.is_admin() or exists(select 1 from public.orders where id=order_id and submitter_id=auth.uid()));
create policy read_comments on public.order_comments for select to authenticated using(public.is_admin() or exists(select 1 from public.orders where id=order_id and submitter_id=auth.uid()));
create policy add_comments on public.order_comments for insert to authenticated with check(author_id=auth.uid() and (public.is_admin() or exists(select 1 from public.orders where id=order_id and submitter_id=auth.uid())));
-- Image creation is server-only after byte validation and ownership checks.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('references','references',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy read_references on storage.objects for select to authenticated using(bucket_id='references' and exists(select 1 from public.order_images i join public.orders o on o.id=i.order_id where i.path=name and (public.is_admin() or o.submitter_id=auth.uid())));

-- Internal helpers must never be callable by browsers.
revoke execute on function public.record_order_event(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.validate_print_payload(jsonb) from public,anon,authenticated;
revoke execute on function public.accept_invited_user() from public,anon,authenticated;
revoke execute on function public.submit_order(jsonb) from public,anon;
revoke execute on function public.mutate_order(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.submit_order(jsonb) to authenticated;
grant execute on function public.mutate_order(uuid,integer,text,jsonb) to authenticated;

create function public.claim_notifications(batch_size integer) returns setof public.notification_outbox language sql security definer set search_path='' as $$
 update public.notification_outbox set claimed_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id in(select id from public.notification_outbox where sent_at is null and attempts<8 and (next_attempt_at is null or next_attempt_at<=now()) and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours') and (claimed_at is null or claimed_at<now()-interval '5 minutes') order by id for update skip locked limit least(batch_size,50)) returning *;
$$;
revoke execute on function public.claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.claim_notifications(integer) to service_role;

-- Staged objects are invisible until this atomic metadata attachment succeeds.
create function public.attach_order_images(oid uuid,expected_version integer,actor_id uuid,paths text[]) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; item text;
begin
 select * into o from public.orders where id=oid for update;
 if not found or o.submitter_id is distinct from actor_id or o.version is distinct from expected_version or o.status not in ('pending','changes_requested') then raise exception 'Order changed before images could be attached'; end if;
 if coalesce(array_length(paths,1),0)=0 or coalesce(array_length(paths,1),0)+(select count(*) from public.order_images where order_id=oid)>5 then raise exception 'Up to five references per order'; end if;
 foreach item in array paths loop
  if split_part(item,'/',1)<>oid::text or not exists(select 1 from storage.objects where bucket_id='references' and name=item) then raise exception 'Invalid reference'; end if;
  insert into public.order_images(order_id,path) values(oid,item);
 end loop;
 update public.orders set status='pending',version=version+1 where id=oid;
end;$$;
revoke execute on function public.attach_order_images(uuid,integer,uuid,text[]) from public,anon,authenticated;
grant execute on function public.attach_order_images(uuid,integer,uuid,text[]) to service_role;
