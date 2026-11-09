"use server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { deliverNotifications } from "@/lib/notifications";
export async function saveFilament(input: {
  id?: string;
  name: string;
  brand: string;
  material: string;
  color: string;
  available: boolean;
}) {
  await requireAdmin();
  if (
    !input.name.trim() ||
    input.name.length > 100 ||
    input.brand.length > 100 ||
    input.material.length > 50 ||
    !/^#[0-9a-f]{6}$/i.test(input.color)
  )
    throw Error("Check the filament name and color.");
  const client = await db();
  const { error } = input.id
    ? await client.from("filaments").update(input).eq("id", input.id)
    : await client.from("filaments").insert(input);
  if (error) throw Error(error.message);
  revalidatePath("/");
}
export async function inviteMember(email: string, name: string) {
  await requireAdmin();
  email = email.trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name.trim() ||
    name.length > 100
  )
    throw Error("Enter a name and valid email.");
  const client = await db();
  const { error } = await client
    .from("invitations")
    .upsert({ email, name: name.trim() });
  if (error) throw Error(error.message);
  const result = await adminDb().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.APP_URL}/auth/callback`,
  });
  if (result.error) throw Error(result.error.message);
  return "Invitation sent.";
}
export async function retryEmails() {
  await requireAdmin();
  const result = await deliverNotifications(20);
  const { data, error } = await adminDb()
    .from("notification_outbox")
    .select("id,attempts,first_attempt_at")
    .is("sent_at", null);
  if (error) throw Error("Could not load email delivery status.");
  return {
    ...result,
    pending: data.length,
    needsReview: data.filter(
      (x) =>
        x.attempts >= 8 ||
        (x.first_attempt_at &&
          Date.now() - Date.parse(x.first_attempt_at) > 23 * 3600000),
    ).length,
  };
}
