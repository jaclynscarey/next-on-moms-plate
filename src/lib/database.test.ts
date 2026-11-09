import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let pg: PGlite;
let oid: string;
const admin = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
const payload = {
  title: "Name sign",
  modelUrl: "https://makerworld.com/en/models/123",
  quantity: 1,
  recipient: "Recipient",
  notes: "Personalized",
  parts: [{ name: "Whole print", filamentId: "", special: "Pink PLA" }],
};
async function as(id: string, sql: string, params: unknown[] = []) {
  await pg.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
  );
  return pg.query(sql, params);
}
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await pg.exec(readFileSync("supabase/migrations/001_initial.sql", "utf8"));
  await pg.exec(
    `grant select,insert,update,delete on all tables in schema public,storage to authenticated,anon;grant all on all tables in schema public to service_role;insert into auth.users values('${admin}','admin@example.test');insert into public.profiles values('${admin}','Admin','admin');insert into public.invitations values('member@example.test','Member',now()),('other@example.test','Other',now());insert into auth.users values('${user}','member@example.test'),('${other}','other@example.test');`,
  );
  const created = await as(
    user,
    "select public.submit_order($1::jsonb) as id",
    [JSON.stringify(payload)],
  );
  oid = (created.rows[0] as { id: string }).id;
}, 30000);
afterAll(async () => {
  await pg.close();
});
it("rejects a null optimistic version", async () => {
  await expect(
    as(admin, "select public.mutate_order($1,null,'approve')", [oid]),
  ).rejects.toThrow("Order changed");
});
it("enforces first ready request and only one running print", async () => {
  const created = await as(
    other,
    "select public.submit_order($1::jsonb) as id",
    [JSON.stringify(payload)],
  );
  const second = (created.rows[0] as { id: string }).id;
  await as(admin, "select public.mutate_order($1,1,'approve')", [second]);
  await as(admin, "select public.mutate_order($1,1,'approve')", [oid]);
  await expect(
    as(admin, "select public.mutate_order($1,2,'start')", [second]),
  ).rejects.toThrow("oldest ready");
  await as(
    admin,
    "select public.mutate_order($1,2,'hold','{\"note\":\"Waiting\"}')",
    [second],
  );
  // Restore the fixture without changing its submission time.
  await pg.exec("reset role");
  await pg.query(
    "update public.orders set status='pending',version=1 where id=$1",
    [oid],
  );
  await pg.query("delete from public.notification_outbox where order_id=$1", [
    second,
  ]);
  await pg.query(
    "delete from public.notification_outbox where order_id=$1 and kind='approve'",
    [oid],
  );
});
it("restricts reference metadata, storage and feedback to submitter and admin", async () => {
  await pg.exec("reset role");
  await pg.query(
    "insert into public.order_images(order_id,path) values($1,$2)",
    [oid, `${oid}/reference`],
  );
  await pg.query(
    "insert into storage.objects(bucket_id,name) values('references',$1)",
    [`${oid}/reference`],
  );
  expect(
    (
      await as(other, "select * from public.order_images where order_id=$1", [
        oid,
      ])
    ).rows,
  ).toHaveLength(0);
  expect((await as(other, "select * from storage.objects")).rows).toHaveLength(
    0,
  );
  expect(
    (
      await as(user, "select * from public.order_images where order_id=$1", [
        oid,
      ])
    ).rows,
  ).toHaveLength(1);
});
it("blocks public and uninvited reads", async () => {
  await pg.exec("reset role;set role anon");
  expect((await pg.query("select * from public.orders")).rows).toHaveLength(0);
  expect(
    (
      await as(
        "00000000-0000-4000-8000-000000000099",
        "select * from public.orders",
      )
    ).rows,
  ).toHaveLength(0);
});
it("blocks member approvals and other member edits", async () => {
  await expect(
    as(user, `select public.mutate_order($1,1,'approve')`, [oid]),
  ).rejects.toThrow("Admin required");
  await expect(
    as(other, `select public.mutate_order($1,1,'edit',$2::jsonb)`, [
      oid,
      JSON.stringify(payload),
    ]),
  ).rejects.toThrow("cannot be edited");
});
it("enforces version checks, locks printing edits, preserves priority and records email jobs", async () => {
  const before = await as(
    user,
    "select submitted_at from public.orders where id=$1",
    [oid],
  );
  await as(admin, `select public.mutate_order($1,1,'approve')`, [oid]);
  await expect(
    as(admin, `select public.mutate_order($1,1,'start')`, [oid]),
  ).rejects.toThrow("Order changed");
  await as(user, `select public.mutate_order($1,2,'edit',$2::jsonb)`, [
    oid,
    JSON.stringify({ ...payload, quantity: 2 }),
  ]);
  await as(admin, `select public.mutate_order($1,3,'approve')`, [oid]);
  await as(admin, `select public.mutate_order($1,4,'start')`, [oid]);
  await expect(
    as(user, `select public.mutate_order($1,5,'edit',$2::jsonb)`, [
      oid,
      JSON.stringify(payload),
    ]),
  ).rejects.toThrow("cannot be edited");
  const after = await as(
    user,
    "select submitted_at from public.orders where id=$1",
    [oid],
  );
  expect(after.rows).toEqual(before.rows);
  await pg.exec("reset role");
  expect(
    (await pg.query("select * from public.notification_outbox")).rows,
  ).toHaveLength(4);
});
it("prevents role escalation and direct order updates", async () => {
  await as(user, `update public.profiles set role='admin' where id=$1`, [user]);
  expect(
    (await as(user, "select role from public.profiles where id=$1", [user]))
      .rows,
  ).toEqual([{ role: "member" }]);
  await as(user, `update public.orders set status='completed' where id=$1`, [
    oid,
  ]);
  expect(
    (await as(user, "select status from public.orders where id=$1", [oid]))
      .rows,
  ).toEqual([{ status: "printing" }]);
});
it("rejects uninvited auth users and unavailable filament requests", async () => {
  await pg.exec("reset role");
  await expect(
    pg.exec(
      `insert into auth.users values('00000000-0000-4000-8000-000000000009','uninvited@example.test')`,
    ),
  ).rejects.toThrow("invitation");
  await expect(
    as(user, "select public.submit_order($1::jsonb)", [
      JSON.stringify({
        ...payload,
        parts: [
          {
            name: "Body",
            filamentId: "00000000-0000-4000-8000-000000000099",
            special: "",
          },
        ],
      }),
    ]),
  ).rejects.toThrow("Filament unavailable");
});
it("hides comments from other members and outbox from all clients", async () => {
  await as(
    user,
    "insert into public.order_comments(order_id,author_id,body) values($1,$2,$3)",
    [oid, user, "Please use the small version"],
  );
  expect(
    (await as(other, "select * from public.order_comments")).rows,
  ).toHaveLength(0);
  expect(
    (await as(admin, "select * from public.order_comments")).rows,
  ).toHaveLength(1);
  expect(
    (await as(admin, "select * from public.notification_outbox")).rows,
  ).toHaveLength(0);
});
it("blocks anonymous private storage and internal helpers", async () => {
  await pg.exec(
    `reset role;insert into storage.objects(bucket_id,name) values('references','private.png');set role anon;`,
  );
  expect((await pg.query("select * from storage.objects")).rows).toHaveLength(
    0,
  );
  await expect(
    as(user, `select public.record_order_event($1,'complete')`, [oid]),
  ).rejects.toThrow("permission denied");
});
it("atomically attaches staged images and rejects stale or over-limit batches", async () => {
  const result = await as(user, "select public.submit_order($1::jsonb) as id", [
    JSON.stringify(payload),
  ]);
  const id = (result.rows[0] as { id: string }).id;
  await pg.exec("reset role");
  const paths = Array.from({ length: 6 }, (_, i) => `${id}/${i}`);
  for (const path of paths)
    await pg.query(
      "insert into storage.objects(bucket_id,name) values('references',$1)",
      [path],
    );
  await pg.exec("set role service_role");
  await expect(
    pg.query("select public.attach_order_images($1,1,$2,$3::text[])", [
      id,
      user,
      paths,
    ]),
  ).rejects.toThrow("five");
  await pg.query("select public.attach_order_images($1,1,$2,$3::text[])", [
    id,
    user,
    paths.slice(0, 5),
  ]);
  await expect(
    pg.query("select public.attach_order_images($1,1,$2,$3::text[])", [
      id,
      user,
      [paths[5]],
    ]),
  ).rejects.toThrow("Order changed");
  await expect(
    pg.query("select public.attach_order_images($1,2,$2,$3::text[])", [
      id,
      user,
      [paths[5]],
    ]),
  ).rejects.toThrow("five");
  expect(
    (
      await pg.query("select * from public.order_images where order_id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(5);
});
it.each([
  "https://makerworld.com/en/models/123/../../login",
  "https://makerworld.com/en/models/123/%2e%2e/login",
  "https://makerworld.com.evil.com/en/models/123",
])("rejects unsafe direct-RPC URLs %s", async (modelUrl) => {
  await expect(
    as(user, "select public.submit_order($1::jsonb)", [
      JSON.stringify({ ...payload, modelUrl }),
    ]),
  ).rejects.toThrow("MakerWorld");
});
it("backs off outbox retries and stops uncertain jobs before the deduplication window expires", async () => {
  await pg.exec("reset role");
  await pg.exec(
    "update public.notification_outbox set next_attempt_at=now()+interval '1 hour';set role service_role",
  );
  expect(
    (await pg.query("select * from public.claim_notifications(20)")).rows,
  ).toHaveLength(0);
  await pg.exec(
    "reset role;update public.notification_outbox set next_attempt_at=null,first_attempt_at=now()-interval '25 hours',delivery_unknown=true;set role service_role",
  );
  expect(
    (await pg.query("select * from public.claim_notifications(20)")).rows,
  ).toHaveLength(0);
});
