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

test("renders the abstract map territories cleanly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Create Local Game" }).click();

  const map = page.getByLabel("Milestone 1 territory map");
  await expect(map).toBeVisible();
  await expect(map.getByRole("button", { name: "North" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Center" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Southwest" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Eastern Port" })).toBeVisible();
  await expect(map.getByText("Eastern")).toBeVisible();
  await expect(map.getByText("Port")).toBeVisible();
});

test("submits no moves for all players", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Create Local Game" }).click();

  await page.getByRole("button", { name: "Submit No Move" }).click();
  await expect(page.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "Submit No Move" }).click();
  await expect(page.getByRole("heading", { name: "Player 3 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "Submit No Move" }).click();

  await expect(page.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
  await expect(page.getByText("player-1 held position.")).toBeVisible();
  await expect(page.getByText("player-2 held position.")).toBeVisible();
  await expect(page.getByText("player-3 held position.")).toBeVisible();
});

test("supports keyboard map selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Create Local Game" }).click();

  await page.getByRole("button", { name: "Center" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Submit Move" })).toBeEnabled();
});
