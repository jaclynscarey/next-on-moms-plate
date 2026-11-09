import { Resend } from "resend";
import { adminDb } from "./supabase/admin";
import { deliverJobs } from "./delivery";
export function notificationMessage(kind: string, id: string, origin: string) {
  const subjects: Record<string, string> = {
    submitted: "A new print request needs your review",
    resubmitted: "An updated print request needs your review",
    approve: "Your print request was approved",
    deny: "An update on your print request",
    request_changes: "Your print request needs changes",
    complete: "Your print is ready!",
  };
  return {
    subject: subjects[kind] ?? "Print request update",
    text: `${subjects[kind] ?? "Print request update"}\n\nOpen the order to see its details and any notes:\n${new URL("/?order=" + encodeURIComponent(id), origin).href}\n\nSign in with your invited account to view this order.\nNext on Mom’s Plate`,
  };
}
export async function deliverNotifications(limit: number) {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !process.env.APP_URL
  )
    return { sent: 0, failed: 0, configured: false };
  const client = adminDb();
  const { data, error } = await client.rpc("claim_notifications", {
    batch_size: limit,
  });
  if (error) throw Error(error.message);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await deliverJobs(
    data ?? [],
    async (job) => {
      const message = notificationMessage(
        job.kind,
        job.order_id,
        process.env.APP_URL!,
      );
      const response = await resend.emails.send(
        { from: process.env.EMAIL_FROM!, to: job.recipient, ...message },
        { idempotencyKey: job.event_id },
      );
      if (response.error) throw Error(response.error.message);
    },
    async (id, patch) => {
      const { error } = await client
        .from("notification_outbox")
        .update(patch)
        .eq("id", id);
      if (error) throw Error(error.message);
    },
  );
  return { ...result, configured: true };
}
