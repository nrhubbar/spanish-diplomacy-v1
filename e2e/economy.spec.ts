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
  await expect(chip).toContainText("+3.3k");
  await chip.click();
  const ledger = page.locator(".resource-detail");
  await expect(ledger.getByRole("row", { name: /Upkeep 20 units/ })).toContainText("−12.9k");
  await expect(ledger.getByRole("row", { name: /Militia column, 5 at 1.5k/ })).toContainText("−7.5k");
  await ledger.getByRole("button", { name: /Upkeep/ }).click();
  await expect(ledger.getByRole("row", { name: /Militia column/ })).toBeHidden();
  const box = await ledger.boundingBox();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
});

test("Disband is an order for several units, with one confirm, and each can be taken back", async ({ page }) => {
  await startCampaign(page);
  await selectTerritory(page, "madrid");
  // The general can't disband, so he leaves the selection first.
  for (const card of await page.locator(".formation-button[aria-pressed=true]").filter({ hasText: "General" }).all()) await card.click();
  await expect(page.locator(".formation-button[aria-pressed=true]").filter({ hasText: "General" })).toHaveCount(0);
  const before = await page.getByRole("button", { name: /^Manpower/ }).innerText();
  const button = page.getByRole("button", { name: /^Order for \d+ selected units?$/ });
  await button.click();
  const menu = page.getByRole("group", { name: /^Order for/ });
  await expect(menu.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await menu.getByRole("button", { name: "Disband" }).click();
  const confirm = page.getByRole("group", { name: /^Disband / });
  await expect(confirm).toContainText(/Saves [\d.]+ Funds and [\d.]+k Manpower a turn together\./);
  await confirm.getByRole("button", { name: "Disband" }).click();
  await expect(page.getByRole("button", { name: "Select units first" })).toBeFocused();
  const going = page.getByText("Goes home at the end of the turn.");
  const count = await going.count();
  expect(count).toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: /^Manpower/ })).not.toHaveText(before);
  await page.getByRole("group", { name: "Disband Madrid Sierra Columns" }).getByRole("button", { name: "Keep" }).click();
  await expect(going).toHaveCount(count - 1);
});

test("the order menu is a bottom sheet with large rows on a phone", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await startCampaign(page);
  await selectTerritory(page, "madrid");
  const button = page.getByRole("button", { name: /^Order for \d+ selected units?$/ });
  await button.click();
  const row = page.getByRole("group", { name: /^Order for/ }).getByRole("button", { name: "Entrench" });
  await expect(row).toBeVisible();
  expect((await row.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  const sheet = await page.locator(".order-menu").boundingBox();
  const pane = await page.locator(".map-pane").boundingBox();
  // It lies along the bottom of the pane, edge to edge.
  expect(Math.abs((sheet?.y ?? 0) + (sheet?.height ?? 0) - (pane?.y ?? 0) - (pane?.height ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((sheet?.width ?? 0) - (pane?.width ?? 0))).toBeLessThanOrEqual(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await row.click();
  await expect(page.locator(".order-menu")).toHaveCount(0);
});

test("a general's counter says what he does to the dice on hover, and so does his card", async ({ page }) => {
  await startCampaign(page);
  await selectTerritory(page, "madrid");
  const counter = page.locator(".counter-layer .unit-counter").filter({ has: page.locator(".unit-counter-tip") }).first();
  await counter.hover();
  await expect(counter.locator(".unit-counter-tip")).toBeVisible();
  await expect(counter.locator(".unit-counter-tip")).toContainText(/ on the battle roll of his army/);
  await expect(page.locator(".general-effect").first()).toContainText(/battle roll of his army/);
});

test("a Factory is queued in a city for Funds and Manpower, and pays 2.3 Funds a turn", async ({ page }) => {
  await startCampaign(page);
  await selectTerritory(page, "castilla-la-mancha");
  await page.getByRole("tab", { name: "Buildings" }).click();
  await page.getByRole("button", { name: /^Albacete/ }).click();
  const factory = page.getByRole("article", { name: "Albacete" }).getByRole("listitem").filter({ hasText: /^Factory/ }).filter({ has: page.getByRole("button", { name: /Queue/ }) });
  await expect(factory).toContainText("4 Funds");
  await expect(factory).toContainText("4k Manpower");
  await expect(factory).toContainText("+2.3 Funds");
  await expect(page.getByText(/pays for itself/i)).toHaveCount(0);
  await factory.getByRole("button", { name: /Queue/ }).click();
  await expect(page.getByRole("button", { name: /^Funds/ })).toContainText("36");
  await expect(page.getByRole("button", { name: /^Manpower/ })).toContainText("6k");
});
