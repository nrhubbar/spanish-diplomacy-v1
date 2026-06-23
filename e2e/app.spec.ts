import { expect, test } from "@playwright/test";

test("navigates from start screen to counter", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { name: "Order Counter" })).toBeVisible();

  await page.getByRole("button", { name: "Up" }).click();
  await expect(page.getByLabel("Counter value")).toHaveText("1");
});
