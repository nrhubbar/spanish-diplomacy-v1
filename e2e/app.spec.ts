import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const screenshotDir = "build/e2e/screenshots";

async function saveScreenshot(page: Page, name: string): Promise<void> {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ fullPage: true, path: `${screenshotDir}/${name}.png` });
}

async function startLocalGame(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Create Local Game" }).click();
}

test("plays one visible debug turn with contested orders", async ({ page }) => {
  await startLocalGame(page);

  await expect(page.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "North" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Center" }).click();
  await saveScreenshot(page, "player-1-center-order");
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();
  await expect(page.getByText("Player 1 submitted orders.")).toBeVisible();
  await page.getByRole("button", { name: "Southwest" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Center" }).click();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Player 3 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
  await expect(page.getByText(/com bounced com-inf-001 moving from north to center/)).toBeVisible();
  await expect(page.getByText("Player 3: No orders")).toBeVisible();
  await saveScreenshot(page, "contested-resolution");

  await page.getByRole("button", { name: "Start Next Turn" }).click();
  await expect(page.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
  await expect(page.getByText("late January 1930")).toBeVisible();
});

test("renders the abstract map and unit counters cleanly", async ({ page }) => {
  await startLocalGame(page);

  const map = page.getByLabel("Milestone 1 territory map");

  await expect(map).toBeVisible();
  await expect(map.getByRole("button", { name: "North" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Center" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Southwest" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Eastern Port" })).toBeVisible();
  await expect(map.getByRole("button", { name: "1st International Infantry" })).toBeVisible();
  await expect(map.getByRole("button", { name: "1st Royal Infantry" })).toBeVisible();
  await expect(map.getByRole("button", { name: "1st Falangist Infantry" })).toBeVisible();
  await saveScreenshot(page, "initial-map");
});

test("submits empty orders for all players", async ({ page }) => {
  await startLocalGame(page);

  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Player 3 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
  await expect(page.getByText("com held com-inf-001.")).toBeVisible();
  await expect(page.getByText("roy held roy-inf-001.")).toBeVisible();
  await expect(page.getByText("fas held fas-inf-001.")).toBeVisible();
  await saveScreenshot(page, "empty-orders-resolution");
});

test("warns when selecting an illegal destination", async ({ page }) => {
  await startLocalGame(page);

  await page.getByRole("button", { name: "North" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "North" }).click();

  await expect(page.getByText("That territory is not a legal destination.")).toBeVisible();
  await expect(page.getByText("Choose a different territory as the destination.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
  await saveScreenshot(page, "illegal-destination-warning");
});
