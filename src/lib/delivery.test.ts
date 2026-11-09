import { it, expect } from "vitest";
import { deliverJobs, type EmailJob } from "./delivery";
const job: EmailJob = {
  id: "job",
  event_id: "event",
  order_id: "order",
  recipient: "member@example.test",
  kind: "approve",
  attempts: 1,
};
it("records successful delivery and uses the stable event key", async () => {
  const sent: string[] = [],
    saved: Record<string, unknown>[] = [];
  const result = await deliverJobs(
    [job],
    async (j) => {
      sent.push(j.event_id);
    },
    async (_, p) => {
      saved.push(p);
    },
    100000,
  );
  expect(result).toEqual({ sent: 1, failed: 0 });
  expect(sent).toEqual(["event"]);
  expect(saved[0].sent_at).toBe(new Date(100000).toISOString());
});
it("keeps timed-out sends uncertain and backs off instead of tight retries", async () => {
  let saved: Record<string, unknown> = {};
  const result = await deliverJobs(
    [job],
    async () => {
      throw Error("timeout");
    },
    async (_, p) => {
      saved = p;
    },
    100000,
  );
  expect(result.failed).toBe(1);
  expect(saved.delivery_unknown).toBe(true);
  expect(Date.parse(String(saved.next_attempt_at))).toBeGreaterThan(100000);
});
it("treats failure to record a successful send as uncertain", async () => {
  const saved: Record<string, unknown>[] = [];
  let first = true;
  await deliverJobs(
    [job],
    async () => {},
    async (_, p) => {
      if (first) {
        first = false;
        throw Error("database timeout");
      }
      saved.push(p);
    },
  );
  expect(saved[0].delivery_unknown).toBe(true);
});
