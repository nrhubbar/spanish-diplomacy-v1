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

test("supports direct links and routes unknown paths home", async ({ page }) => {
  await page.goto("/assets/#/setup");
  await expect(page.getByRole("heading", { name: "Milestone 1 Setup" })).toBeVisible();

  await page.goto("/assets/#/missing");
  await expect(page.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
});

test("plays one visible debug turn with neighboring moves", async ({ page }) => {
  await startLocalGame(page);

  await expect(page.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "Galicia" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Asturias" }).click();
  await saveScreenshot(page, "player-1-asturias-order");
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();
  await expect(page.getByText("Player 1 submitted orders.")).toBeVisible();
  await page.getByRole("button", { name: "Catalunya" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Aragon" }).click();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Player 3 Order Submission" })).toBeVisible();
  await page.getByRole("button", { name: "Andalucia" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Murcia" }).click();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Resolution Summary" })).toBeVisible();
  await expect(page.getByText(/com moved com-inf-001 from galicia to asturias/)).toBeVisible();
  await expect(page.getByText(/roy moved roy-inf-001 from catalunya to aragon/)).toBeVisible();
  await expect(page.getByText(/fas moved fas-inf-001 from andalucia to murcia/)).toBeVisible();
  await saveScreenshot(page, "neighboring-moves-resolution");

  await page.getByRole("button", { name: "Start Next Turn" }).click();
  await expect(page.getByRole("heading", { name: "Player 1 Order Submission" })).toBeVisible();
  await expect(page.getByText("late January 1930")).toBeVisible();
});

test("renders the Iberia map and NATO unit counters cleanly", async ({ page }) => {
  await startLocalGame(page);

  const map = page.getByLabel("Iberia campaign map");

  await expect(map).toBeVisible();
  await expect(map.getByRole("button", { name: "Galicia" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Madrid" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Extremadura" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Catalunya" })).toBeVisible();
  await expect(map.getByRole("button", { name: "Andalucia" })).toBeVisible();
  await expect(map.getByRole("button", { name: "1st International Infantry" })).toBeVisible();
  await expect(map.getByRole("button", { name: "1st Royal Infantry" })).toBeVisible();
  await expect(map.getByRole("button", { name: "1st Falangist Infantry" })).toBeVisible();
  await saveScreenshot(page, "initial-map");
});

test("keeps the campaign map usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await startLocalGame(page);

  const map = page.getByLabel("Iberia campaign map");

  await expect(map).toBeVisible();
  await expect(map.getByRole("button", { name: "Galicia" })).toBeVisible();
  await expect(map.getByRole("button", { name: "1st International Infantry" })).toBeVisible();
  await saveScreenshot(page, "mobile-initial-map");
});

test("highlights only Galicia land neighbors", async ({ page }) => {
  await startLocalGame(page);

  const map = page.getByLabel("Iberia campaign map");

  await map.getByRole("button", { name: "Galicia" }).click();
  await page.getByRole("button", { name: "Move" }).click();

  await expect(map.getByRole("button", { name: "Asturias" })).toHaveAttribute(
    "data-legal-destination",
    "true"
  );
  await expect(map.getByRole("button", { name: "Castilla y Leon" })).toHaveAttribute(
    "data-legal-destination",
    "true"
  );
  await expect(map.getByRole("button", { name: "Cantabria" })).not.toHaveAttribute(
    "data-legal-destination"
  );
  await expect(map.getByRole("button", { name: "Catalunya" })).not.toHaveAttribute(
    "data-legal-destination"
  );
  await saveScreenshot(page, "galicia-neighbor-highlights");
});

test("highlights only Catalunya land neighbors", async ({ page }) => {
  await startLocalGame(page);

  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Player 2 Order Submission" })).toBeVisible();

  const map = page.getByLabel("Iberia campaign map");

  await map.getByRole("button", { name: "Catalunya" }).click();
  await page.getByRole("button", { name: "Move" }).click();

  await expect(map.getByRole("button", { name: "Aragon" })).toHaveAttribute(
    "data-legal-destination",
    "true"
  );
  await expect(map.getByRole("button", { name: "Valencia" })).toHaveAttribute(
    "data-legal-destination",
    "true"
  );
  await expect(map.getByRole("button", { name: "Madrid" })).not.toHaveAttribute(
    "data-legal-destination"
  );
  await saveScreenshot(page, "catalunya-neighbor-highlights");
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

  await page.getByRole("button", { name: "Galicia" }).click();
  await page.getByRole("button", { name: "Move" }).click();
  await page.getByRole("button", { name: "Catalunya" }).click();

  await expect(page.getByText("That territory is not a legal destination.")).toBeVisible();
  await expect(page.getByText("Destination is not adjacent.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();
  await saveScreenshot(page, "illegal-destination-warning");
});
