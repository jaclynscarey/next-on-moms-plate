export const statusLabels = {
  pending: "Awaiting approval",
  changes_requested: "Changes requested",
  queued: "Queued",
  on_hold: "On hold",
  printing: "Printing",
  completed: "Completed",
  denied: "Denied",
  cancelled: "Cancelled",
} as const;
export type Status = keyof typeof statusLabels;
export type Actor = { id: string; role: "admin" | "member" };
export type Part = { name: string; filamentId: string; special: string };
export type PrintRequestInput = {
  title: string;
  modelUrl: string;
  quantity: number;
  recipient: string;
  notes: string;
  parts: Part[];
};
export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};
export type PrintOrder = PrintRequestInput & {
  id: string;
  status: Status;
  submittedAt: string;
  submitterId: string;
  submitterName: string;
  version: number;
  holdReason: string;
  comments: Comment[];
  images: string[];
};
export type Filament = {
  id: string;
  name: string;
  brand: string;
  material: string;
  color: string;
  available: boolean;
  imageUrl?: string;
};
export type OrderAction =
  | { type: "edit"; input: PrintRequestInput }
  | {
      type:
        | "approve"
        | "deny"
        | "request_changes"
        | "hold"
        | "release"
        | "start"
        | "complete"
        | "retry"
        | "cancel";
      note?: string;
    };
function text(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max)
    throw Error("Please check the text fields.");
  return value.trim();
}
export function validateRequest(value: unknown): PrintRequestInput {
  if (!value || typeof value !== "object")
    throw Error("Request details are required.");
  const v = value as Record<string, unknown>;
  const title = text(v.title, 160),
    recipient = text(v.recipient, 100),
    modelUrl = text(v.modelUrl, 1000),
    notes = text(v.notes ?? "", 4000);
  if (!title || !recipient) throw Error("Add a title and recipient.");
  let url: URL;
  try {
    url = new URL(modelUrl);
  } catch {
    throw Error("Enter a MakerWorld model link.");
  }
  if (
    url.protocol !== "https:" ||
    !["makerworld.com", "www.makerworld.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !/^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?models\/\d+(?:[-/]|$)/.test(
      url.pathname,
    )
  )
    throw Error("Use an HTTPS MakerWorld model link.");
  if (
    typeof v.quantity !== "number" ||
    !Number.isSafeInteger(v.quantity) ||
    v.quantity < 1 ||
    v.quantity > 100
  )
    throw Error("Quantity must be a whole number from 1 to 100.");
  if (!Array.isArray(v.parts) || !v.parts.length || v.parts.length > 40)
    throw Error("Add at least one part and its filament.");
  const parts = v.parts.map((p: Record<string, unknown>) => {
    const name = text(p.name, 100),
      filamentId = text(p.filamentId ?? "", 100),
      special = text(p.special ?? "", 500);
    if (!name || (!filamentId && !special) || !!filamentId === !!special)
      throw Error("Each named part needs one filament or a special request.");
    return { name, filamentId, special };
  });
  return { title, modelUrl, quantity: v.quantity, recipient, notes, parts };
}
export function getReadyQueue(orders: PrintOrder[]): PrintOrder[] {
  return orders
    .filter((o) => o.status === "queued")
    .sort(
      (a, b) =>
        Date.parse(a.submittedAt) - Date.parse(b.submittedAt) ||
        a.id.localeCompare(b.id),
    );
}
export function transitionOrder(
  order: PrintOrder,
  action: OrderAction,
  actor: Actor,
): PrintOrder {
  const editable = [
    "pending",
    "changes_requested",
    "queued",
    "on_hold",
  ].includes(order.status);
  const next = { ...order, version: order.version + 1 };
  if (action.type === "edit" || action.type === "cancel") {
    if (actor.id !== order.submitterId || !editable)
      throw Error(
        "Only the submitter can change this request before printing.",
      );
    if (action.type === "cancel") return { ...next, status: "cancelled" };
    if (action.type !== "edit") throw Error("Invalid request action.");
    const input = validateRequest(action.input);
    if (input.modelUrl !== order.modelUrl)
      throw Error("A different model needs a new order.");
    return { ...next, ...input, status: "pending", holdReason: "" };
  }
  if (actor.role !== "admin") throw Error("Admin access required.");
  const rules: Record<string, { from: Status[]; to: Status }> = {
    approve: { from: ["pending"], to: "queued" },
    deny: {
      from: ["pending", "changes_requested", "queued", "on_hold"],
      to: "denied",
    },
    request_changes: {
      from: ["pending", "queued", "on_hold"],
      to: "changes_requested",
    },
    hold: { from: ["queued", "printing"], to: "on_hold" },
    release: { from: ["on_hold"], to: "queued" },
    start: { from: ["queued"], to: "printing" },
    complete: { from: ["printing"], to: "completed" },
    retry: { from: ["printing"], to: "queued" },
  };
  const rule = rules[action.type];
  if (!rule?.from.includes(order.status))
    throw Error("This action is not available for the current status.");
  if (
    ["hold", "request_changes", "deny"].includes(action.type) &&
    !action.note?.trim()
  )
    throw Error("Please add a reason.");
  return {
    ...next,
    status: rule.to,
    holdReason: action.type === "hold" ? action.note!.trim() : "",
  };
}
export function validateFilaments(
  input: PrintRequestInput,
  filaments: Filament[],
) {
  for (const p of input.parts)
    if (
      p.filamentId &&
      !filaments.some((f) => f.id === p.filamentId && f.available)
    )
      throw Error(
        "Choose an available filament or request a special filament.",
      );
}
