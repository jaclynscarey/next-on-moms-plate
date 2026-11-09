import { it, expect } from "vitest";
import { notificationMessage } from "./notifications";
it("builds a review link without credentials or sensitive notes", () => {
  const mail = notificationMessage(
    "submitted",
    "abc",
    "https://prints.example.com",
  );
  expect(mail.subject).toContain("review");
  expect(mail.text).toContain("https://prints.example.com/?order=abc");
  expect(mail.text).not.toContain("token");
});
it("describes requested modifications", () =>
  expect(
    notificationMessage("request_changes", "id", "https://prints.example.com")
      .subject,
  ).toContain("changes"));
