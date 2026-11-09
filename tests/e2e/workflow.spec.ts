import { test, expect } from "@playwright/test";
test("family member requests a personalized print, admin approves and completes it", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Articulated dragon for Wyatt", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Family queue" })
    .click();
  await page.getByRole("button", { name: /Personalized name sign/ }).click();
  await page.getByLabel("Note or reason").fill("Waiting");
  await page.getByRole("button", { name: "Put on hold" }).click();
  await expect(
    page.getByText("Interactive demo", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My requests" })
    .click();
  await page
    .getByRole("button", { name: "Request a print", exact: true })
    .first()
    .click();
  await page.getByLabel("What are we making?").fill("Test name plate");
  await page
    .getByLabel("MakerWorld model link")
    .fill("https://makerworld.com/en/models/123-test");
  await page.getByLabel("Who’s it for?").selectOption("Sofia");
  await page
    .getByRole("combobox", { name: "Filament", exact: true })
    .selectOption("pink");
  await page
    .getByLabel("Personalization & other details")
    .fill("Sofia with a heart");
  await page.getByRole("button", { name: "Send to Mom for approval" }).click();
  await expect(
    page.getByRole("heading", { name: "Test name plate" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".page-heading .status")).toHaveText("Queued");
  await page.getByRole("button", { name: "Edit request", exact: true }).click();
  await page.getByLabel("How many copies?").fill("2");
  await page.getByRole("button", { name: "Send updated request" }).click();
  await expect(page.locator(".page-heading .status")).toHaveText(
    "Awaiting approval",
  );
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page
    .getByRole("button", { name: "Start printing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit request", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.locator(".page-heading .status")).toHaveText("Completed");
  await page
    .getByRole("button", { name: "Request again", exact: true })
    .click();
  await expect(page.getByLabel("What are we making?")).toHaveValue(
    "Test name plate",
  );
  await expect(page.getByLabel("How many copies?")).toHaveValue("2");
});
test("queue, special filament, comments and phone layout", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Glow stars/ }).click();
  await expect(
    page.getByText("Waiting for special filament", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ready to print", exact: true })
    .click();
  await page.getByLabel("Add a comment").fill("The new filament is here.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(
    page.getByText("The new filament is here.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
