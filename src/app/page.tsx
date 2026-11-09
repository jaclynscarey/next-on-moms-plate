import { redirect } from "next/navigation";
import { db, isConfigured } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { demoFilaments, demoOrders } from "@/lib/demo";
import Dashboard from "@/components/dashboard";
import type { PrintOrder, Filament, Comment } from "@/lib/orders";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const query = await searchParams;
  if (!isConfigured())
    return (
      <Dashboard
        demo
        initialOrders={demoOrders}
        initialFilaments={demoFilaments}
        member={{ id: "demo", name: "Jacky", role: "admin" }}
        recipients={[
          "Jacky",
          "Mike",
          "Sam",
          "Matthew",
          "Bia",
          "Wyatt",
          "Mia",
          "Sofia",
        ]}
        selectedOrder={query.order}
      />
    );
  let member;
  try {
    member = await requireMember();
  } catch {
    redirect(
      "/login" +
        (query.order ? "?order=" + encodeURIComponent(query.order) : ""),
    );
  }
  const client = await db();
  const [orders, filaments, profiles, comments, images, events, recipients] =
    await Promise.all([
      client.from("orders").select("*").order("submitted_at"),
      client.from("filaments").select("*").order("name"),
      client.from("profiles").select("id,name"),
      client.from("order_comments").select("*").order("created_at"),
      client.from("order_images").select("*"),
      client.from("order_events").select("*").order("created_at"),
      client.from("recipients").select("name"),
    ]);
  if (
    orders.error ||
    filaments.error ||
    profiles.error ||
    comments.error ||
    images.error ||
    events.error ||
    recipients.error
  )
    throw Error("The dashboard could not load. Please refresh.");
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.name]));
  const signed = await Promise.all(
    (images.data ?? []).map(async (i) => {
      const { data } = await client.storage
        .from("references")
        .createSignedUrl(i.path, 3600);
      return { ...i, url: data?.signedUrl ?? "" };
    }),
  );
  const mapped: PrintOrder[] = (orders.data ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    modelUrl: o.model_url,
    quantity: o.quantity,
    recipient: o.recipient,
    notes: o.notes,
    parts: o.parts,
    status: o.status,
    submittedAt: o.submitted_at,
    submitterId: o.submitter_id,
    submitterName: names.get(o.submitter_id) ?? "Family member",
    version: o.version,
    holdReason: o.hold_reason,
    comments: [
      ...(comments.data ?? [])
        .filter((c) => c.order_id === o.id)
        .map((c) => ({
          id: c.id,
          author: names.get(c.author_id) ?? "Member",
          body: c.body,
          createdAt: c.created_at,
        })),
      ...(events.data ?? [])
        .filter((e) => e.order_id === o.id && e.note)
        .map((e) => ({
          id: e.id,
          author: `Mom · ${e.kind.replaceAll("_", " ")}`,
          body: e.note,
          createdAt: e.created_at,
        })),
    ].sort((a: Comment, b: Comment) => a.createdAt.localeCompare(b.createdAt)),
    images: signed
      .filter((i) => i.order_id === o.id)
      .map((i) => i.url)
      .filter(Boolean),
  }));
  return (
    <Dashboard
      demo={false}
      initialOrders={mapped}
      initialFilaments={filaments.data as Filament[]}
      member={member}
      recipients={[
        ...new Set([
          ...names.values(),
          ...(recipients.data ?? []).map((r) => r.name),
          "Sofia",
        ]),
      ]}
      selectedOrder={query.order}
    />
  );
}
