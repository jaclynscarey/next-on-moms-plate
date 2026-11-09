export type EmailJob = {
  id: string;
  event_id: string;
  order_id: string;
  recipient: string;
  kind: string;
  attempts: number;
};
export async function deliverJobs(
  jobs: EmailJob[],
  send: (job: EmailJob) => Promise<void>,
  save: (id: string, patch: Record<string, unknown>) => Promise<void>,
  now = Date.now(),
) {
  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    try {
      await send(job);
      await save(job.id, {
        sent_at: new Date(now).toISOString(),
        last_error: null,
        delivery_unknown: false,
      });
      sent++;
    } catch {
      await save(job.id, {
        last_error:
          "Delivery was not confirmed. Retry safely within 23 hours or reconcile with the provider.",
        delivery_unknown: true,
        claimed_at: null,
        next_attempt_at: new Date(
          now + Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
        ).toISOString(),
      });
      failed++;
    }
  }
  return { sent, failed };
}
