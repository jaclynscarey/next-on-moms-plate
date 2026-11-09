"use server";
import { db } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { validateRequest } from "@/lib/orders";
import { deliverNotifications } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
export async function saveOrder(
  id: string | null,
  version: number,
  input: unknown,
) {
  await requireMember();
  const client = await db();
  const payload = validateRequest(input);
  const result = id
    ? await client.rpc("mutate_order", {
        order_id: id,
        expected_version: version,
        action: "edit",
        payload,
      })
    : await client.rpc("submit_order", { payload });
  if (result.error) throw Error(result.error.message);
  revalidatePath("/");
  return id ?? String(result.data);
}
export async function sendPendingNotifications() {
  await requireMember();
  await deliverNotifications(10).catch(() => undefined);
}
export async function changeOrder(
  id: string,
  version: number,
  action: string,
  note: string,
) {
  await requireMember();
  const client = await db();
  const { error } = await client.rpc("mutate_order", {
    order_id: id,
    expected_version: version,
    action,
    payload: { note },
  });
  if (error) throw Error(error.message);
  revalidatePath("/");
  await deliverNotifications(10).catch(() => undefined);
}
export async function addComment(orderId: string, body: string) {
  const member = await requireMember();
  if (!body.trim() || body.length > 4000)
    throw Error("Write a comment of up to 4,000 characters.");
  const client = await db();
  const { error } = await client
    .from("order_comments")
    .insert({ order_id: orderId, author_id: member.id, body: body.trim() });
  if (error) throw Error(error.message);
  revalidatePath("/");
}
