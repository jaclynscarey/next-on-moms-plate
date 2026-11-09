import { describe, it, expect } from "vitest";
import {
  validateRequest,
  getReadyQueue,
  transitionOrder,
  type PrintOrder,
} from "./orders";
const input = {
  title: "Dragon",
  modelUrl: "https://makerworld.com/en/models/123-dragon",
  quantity: 1,
  recipient: "Sofia",
  notes: "",
  parts: [{ name: "Body", filamentId: "blue", special: "" }],
};
const order = (
  id = "a",
  status: PrintOrder["status"] = "queued",
  submittedAt = "2026-11-01T00:00:00Z",
): PrintOrder => ({
  ...input,
  id,
  status,
  submittedAt,
  submitterId: "user",
  submitterName: "Member",
  version: 1,
  holdReason: "",
  comments: [],
  images: [],
});
describe("request validation", () => {
  it("accepts a complete request", () =>
    expect(validateRequest(input).title).toBe("Dragon"));
  it.each([
    "https://makerworld.com.evil.com/en/models/123",
    "http://makerworld.com/en/models/123",
    "https://user@makerworld.com/en/models/123",
    "javascript:alert(1)",
    "https://makerworld.com/en/search",
    "bad",
  ])("rejects unsafe model URL %s", (modelUrl) =>
    expect(() => validateRequest({ ...input, modelUrl })).toThrow(),
  );
  it.each([0, -1, 1.5, NaN])("rejects quantity %s", (quantity) =>
    expect(() => validateRequest({ ...input, quantity })).toThrow(),
  );
  it("requires parts and filament choice", () => {
    expect(() => validateRequest({ ...input, parts: [] })).toThrow();
    expect(() =>
      validateRequest({ ...input, parts: [{ name: "Body" }] }),
    ).toThrow();
  });
});
describe("fair queue", () => {
  it("sorts ready orders and skips holds and unapproved orders", () =>
    expect(
      getReadyQueue([
        order("b"),
        order("hold", "on_hold"),
        order("pending", "pending"),
        order("a"),
        order("old", "queued", "2026-10-01T00:00:00Z"),
      ]).map((o) => o.id),
    ).toEqual(["old", "a", "b"]));
  it("does not mutate its input", () => {
    const list = [order("b"), order("a")];
    getReadyQueue(list);
    expect(list[0].id).toBe("b");
  });
});
describe("transitions", () => {
  const admin = { id: "admin", role: "admin" as const };
  const user = { id: "user", role: "member" as const };
  it("requires admin to approve", () =>
    expect(() =>
      transitionOrder(order("a", "pending"), { type: "approve" }, user),
    ).toThrow());
  it("preserves original priority when edited and reapproved", () => {
    const old = order();
    const edited = transitionOrder(
      old,
      { type: "edit", input: { ...input, quantity: 2 } },
      user,
    );
    expect(edited.status).toBe("pending");
    const approved = transitionOrder(edited, { type: "approve" }, admin);
    expect(approved.submittedAt).toBe(old.submittedAt);
    expect(approved.quantity).toBe(2);
    expect(approved.version).toBe(3);
  });
  it("rejects another member editing", () =>
    expect(() =>
      transitionOrder(
        order(),
        { type: "edit", input },
        { id: "other", role: "member" },
      ),
    ).toThrow());
  it.each(["printing", "completed", "denied", "cancelled"] as const)(
    "locks edits and cancellation at %s",
    (status) => {
      expect(() =>
        transitionOrder(order("a", status), { type: "edit", input }, user),
      ).toThrow();
      expect(() =>
        transitionOrder(order("a", status), { type: "cancel" }, user),
      ).toThrow();
    },
  );
  it("requires a new order for a different model", () =>
    expect(() =>
      transitionOrder(
        order(),
        {
          type: "edit",
          input: { ...input, modelUrl: "https://makerworld.com/en/models/456" },
        },
        user,
      ),
    ).toThrow());
  it("requires a hold reason and permits release", () => {
    expect(() =>
      transitionOrder(order(), { type: "hold", note: "" }, admin),
    ).toThrow();
    const held = transitionOrder(
      order(),
      { type: "hold", note: "Waiting for pink" },
      admin,
    );
    expect(held.status).toBe("on_hold");
    expect(transitionOrder(held, { type: "release" }, admin).status).toBe(
      "queued",
    );
  });
  it("cannot complete an unstarted order", () =>
    expect(() =>
      transitionOrder(order(), { type: "complete" }, admin),
    ).toThrow());
});
