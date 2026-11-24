import { expect, type Page, test } from "@playwright/test";
import { selectTerritory } from "./turn";

async function startCampaign(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".air-layer .unit-counter").first()).toBeAttached();
}

test("the Manpower ledger takes upkeep off by unit type, and stays on the screen", async ({ page }) => {
  await startCampaign(page);
  const chip = page.getByRole("button", { name: /^Manpower/ });
  await expect(chip).toContainText("+14.1k");
  await chip.click();
  const ledger = page.locator(".resource-detail");
  await expect(ledger.getByRole("row", { name: /Upkeep 20 units/ })).toContainText("−12.9k");
  await expect(ledger.getByRole("row", { name: /Militia column, 5 at 1.5k/ })).toContainText("−7.5k");
  await ledger.getByRole("button", { name: /Upkeep/ }).click();
  await expect(ledger.getByRole("row", { name: /Militia column/ })).toBeHidden();
  const box = await ledger.boundingBox();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
});

test("Disband takes two steps, saves the upkeep at once, can be taken back, and sends the unit home", async ({ page }) => {
  await startCampaign(page);
  await selectTerritory(page, "madrid");
  const controls = page.getByRole("group", { name: "Disband Madrid Sierra Columns" });
  const disband = controls.getByRole("button", { name: "Disband" });
  // The label can be read: its colour is not its background's.
  expect(await disband.evaluate((element) => getComputedStyle(element).color === getComputedStyle(element).backgroundColor)).toBe(false);
  await disband.click();
  await expect(controls).toContainText("Disband this unit? Saves 1.5k Manpower a turn.");
  await controls.getByRole("button", { name: "Keep" }).click();
  await disband.click();
  await disband.click();
  await expect(controls).toContainText("Goes home at the end of the turn.");
  await expect(page.getByRole("button", { name: /^Manpower/ })).toContainText("+15.6k");
  await controls.getByRole("button", { name: "Keep" }).click();
  await expect(page.getByRole("button", { name: /^Manpower/ })).toContainText("+14.1k");
});

test("a Factory is queued in a city for Funds and Manpower, and pays 1.5 Funds a turn", async ({ page }) => {
  await startCampaign(page);
  await selectTerritory(page, "castilla-la-mancha");
  await page.getByRole("tab", { name: "Buildings" }).click();
  await page.getByRole("button", { name: /^Albacete/ }).click();
  const factory = page.getByRole("article", { name: "Albacete" }).getByRole("listitem").filter({ hasText: /^Factory/ }).filter({ has: page.getByRole("button", { name: /Queue/ }) });
  await expect(factory).toContainText("6 Funds");
  await expect(factory).toContainText("4k Manpower");
  await expect(factory).toContainText("+1.5 Funds");
  await expect(page.getByText(/pays for itself/i)).toHaveCount(0);
  await factory.getByRole("button", { name: /Queue/ }).click();
  await expect(page.getByRole("button", { name: /^Funds/ })).toContainText("34");
  await expect(page.getByRole("button", { name: /^Manpower/ })).toContainText("6k");
});
