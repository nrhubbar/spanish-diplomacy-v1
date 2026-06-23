import { expect, test } from "@playwright/test";

test("plays one visible debug turn", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { name: "Milestone 1 Setup" })).toBeVisible();

  await page.getByRole("button", { name: "Create Local Game" }).click();
  await expect(page.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
  await expect(page.getByLabel("Milestone 1 territory map")).toBeVisible();

  await page.getByRole("button", { name: "Center" }).click();
  await page.getByRole("button", { name: "Submit Move" }).click();
  await expect(page.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();

  await page.getByRole("button", { name: "Center" }).click();
  await page.getByRole("button", { name: "Submit Move" }).click();
  await expect(page.getByRole("heading", { name: "Player 3 Order Submission" })).toBeVisible();

  await page.getByRole("button", { name: "Submit No Move" }).click();
  await expect(page.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
  await expect(page.getByText(/player-1 bounced moving from north to center/)).toBeVisible();

  await page.getByRole("button", { name: "Start Next Turn" }).click();
  await expect(page.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
});
