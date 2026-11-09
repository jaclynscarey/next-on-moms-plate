import { it, expect } from "vitest";
import { orderDestination } from "./links";
it("preserves an order ID without accepting redirect URLs", () => {
  expect(orderDestination("00000000-0000-4000-8000-000000000001")).toBe(
    "/?order=00000000-0000-4000-8000-000000000001",
  );
  expect(orderDestination("https://evil.example")).toBe("/");
  expect(orderDestination("//evil.example")).toBe("/");
});
