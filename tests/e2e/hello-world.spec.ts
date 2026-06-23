import { expect, test } from "@playwright/test";

test("loads the hello world app", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  await expect(page.getByText("Hidden orders. Simultaneous resolution.")).toBeVisible();
});
