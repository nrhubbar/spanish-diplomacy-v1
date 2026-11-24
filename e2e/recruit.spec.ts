import { expect, type Page, test } from "@playwright/test";
import { endTurnAnyway, selectTerritory } from "./turn";

// The Recruit pane: adding or taking back a unit moves nothing else in it.

async function startCampaign(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await closeBriefing(page);
}

async function closeBriefing(page: Page): Promise<void> {
  await expect(page.locator(".map-vector")).toBeVisible();
  if (await page.getByRole("complementary", { name: "Briefing" }).isVisible()) await page.getByRole("button", { exact: true, name: "Briefing" }).click();
}

async function openRecruit(page: Page, territoryId: string): Promise<void> {
  await selectTerritory(page, territoryId);
  await page.getByRole("tab", { name: "Recruit" }).evaluate((tab: HTMLElement) => { tab.click(); });
  await expect(page.locator(".recruit-list").first()).toBeVisible();
}

/** Raises the phone's sheet to its tall stop; the desktop's side pane has none. */
async function raiseSheet(page: Page): Promise<void> {
  const grip = page.getByRole("separator", { name: "Pane height" });
  if (!await grip.isVisible()) return;
  await grip.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".map-pane")).toHaveAttribute("data-stop", "tall");
}

/** Where every tab, stepper, row, ledger line and section of the pane is on the screen. */
const boxes = (page: Page): Promise<readonly string[]> => page.evaluate(() =>
  [...document.querySelectorAll(".pane-tab, .recruit-tab, .recruit-tab h4, .recruit-stepper, .recruit-row, .recruit-orders, .order-line, .order-line > .text-button, .recruit-queue, .recruit-basket")].map((element) => {
    const { height, width, x, y } = element.getBoundingClientRect();
    return [element.className || element.tagName, ...[x, y, width, height].map((value) => value.toFixed(1))].join(" ");
  }));

/** Presses a button at one point of the screen, as a hand that doesn't move does. */
async function pressAt(page: Page, name: string): Promise<() => Promise<void>> {
  const button = page.getByRole("button", { name });
  await button.evaluate((element) => { element.scrollIntoView({ block: "center" }); });
  const box = await button.boundingBox();
  if (box === null) throw new Error(`${name} has no box.`);
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(at.x, at.y);
  return () => page.mouse.click(at.x, at.y);
}

const slotsText = (page: Page): Promise<string> => page.locator(".recruit-orders").innerText();

/** Adds infantry until the last order is used, then takes it all back, checking every box after each press. */
async function fillAndEmpty(page: Page, territoryId: string, tall: boolean): Promise<void> {
  await openRecruit(page, territoryId);
  if (tall) await raiseSheet(page);
  const slots = Number(/(\d+) Recruit orders/u.exec(await slotsText(page))?.[1]);
  expect(slots).toBeGreaterThanOrEqual(3);
  const count = page.getByRole("group", { name: "Infantry regiment to recruit" }).locator("output");
  const add = await pressAt(page, "One more Infantry regiment");
  const before = await boxes(page);
  for (let ordered = 1; ordered <= slots; ordered += 1) {
    await add();
    await expect(count).toHaveText(String(ordered));
    expect(await boxes(page)).toEqual(before);
  }
  await expect(page.locator(".recruit-orders")).toContainText(`${String(slots)} of ${String(slots)} Recruit orders`);
  await expect(page.getByRole("button", { name: "One more Infantry regiment" })).toHaveAttribute("aria-disabled", "true");
  const remove = await pressAt(page, "One fewer Infantry regiment");
  const full = await boxes(page);
  for (let ordered = slots - 1; ordered >= 0; ordered -= 1) {
    await remove();
    await expect(count).toHaveText(String(ordered));
    expect(await boxes(page)).toEqual(full);
  }
}

for (const { height, name, tall, width } of [
  { height: 800, name: "a desktop", tall: false, width: 1440 },
  { height: 839, name: "a phone", tall: false, width: 412 },
  { height: 839, name: "a phone with the sheet tall", tall: true, width: 412 },
  { height: 720, name: "a narrow phone", tall: false, width: 320 }
]) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport: { height, width } });

    test("adding and taking back units moves nothing, to the last order", async ({ page }) => {
      await startCampaign(page);
      await fillAndEmpty(page, "catalunya", tall);
    });

    test("adding and taking back units moves nothing with units in training", async ({ page }) => {
      await startCampaign(page);
      await openRecruit(page, "catalunya");
      await (await pressAt(page, "One more Infantry regiment"))();
      await endTurnAnyway(page);
      await page.getByRole("button", { name: "Start Next Turn" }).filter({ visible: true }).click();
      await closeBriefing(page);
      await openRecruit(page, "catalunya");
      await expect(page.locator(".recruit-queue")).toContainText("Infantry regiment");
      await fillAndEmpty(page, "catalunya", tall);
    });
  });
}

test("the first order moves nothing with the pane at its top, and the totals stay in sight below the ledger", async ({ page }) => {
  await startCampaign(page);
  await openRecruit(page, "catalunya");
  const top = (): Promise<void> => page.locator(".map-pane-body").evaluate((body) => { body.scrollTop = 0; });
  await top();
  const before = await boxes(page);
  await page.getByRole("button", { name: "One more Infantry regiment" }).evaluate((button: HTMLElement) => { button.click(); });
  await expect(page.locator(".order-line").first()).toContainText("Infantry regiment");
  expect(await page.locator(".map-pane-body").evaluate((body) => body.scrollTop)).toBe(0);
  expect(await boxes(page)).toEqual(before);
  await page.locator(".map-pane-body").evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await expect(page.locator(".recruit-orders")).not.toBeInViewport();
  await expect(page.locator(".recruit-basket")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".recruit-basket")).toContainText("Left");
});

test("a line of the ledger cancels its own unit, and the keyboard keeps its place at the last order", async ({ page }) => {
  await startCampaign(page);
  await openRecruit(page, "catalunya");
  const slots = page.getByRole("list", { name: "Recruit orders at Barcelona" }).getByRole("button");
  await page.getByRole("button", { name: "One more Infantry regiment" }).click();
  await page.getByRole("button", { name: "One more Militia column" }).click();
  const more = page.getByRole("button", { name: "One more Infantry regiment" });
  await more.focus();
  for (let pressed = 0; pressed < await slots.count(); pressed += 1) await page.keyboard.press("Enter");
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute("title", "No Recruit orders left here this turn.");
  await expect(slots.nth(1)).toHaveAccessibleName("Cancel Militia column, order 2 of 4");
  await slots.nth(1).press("Enter");
  await expect(slots.nth(1)).toHaveAccessibleName("Cancel Infantry regiment, order 2 of 4");
  await slots.nth(2).press("Enter");
  await expect(slots.nth(2)).toHaveAccessibleName("Nothing to cancel, order 3 of 4");
  await expect(slots.nth(2)).toBeFocused();
});

for (const { height, text, width } of [{ height: 800, text: "100%", width: 1440 }, { height: 800, text: "100%", width: 320 }, { height: 800, text: "200%", width: 320 }]) {
  test(`the totals never cover what has the focus, nor the last row, at ${String(width)} px and ${text} text`, async ({ page }) => {
    await page.setViewportSize({ height, width });
    await startCampaign(page);
    await page.addStyleTag({ content: `html { font-size: ${text} !important; }` });
    await openRecruit(page, "catalunya");
    await raiseSheet(page);
    const covered = (): Promise<string> => page.evaluate(() => {
      const on = document.activeElement?.getBoundingClientRect();
      const basket = document.querySelector(".recruit-basket")?.getBoundingClientRect();
      if (on === undefined || basket === undefined || document.activeElement?.closest(".recruit-tab") === null) return "";
      // A row taller than the view shows its head; a control is clear of the totals as a whole.
      const bottom = Math.min(on.bottom, on.top + 24);
      return on.top < basket.bottom && bottom > basket.top + 1 ? document.activeElement?.outerHTML.slice(0, 80) ?? "" : "";
    });
    await page.locator(".recruit-tab button").first().focus();
    let seen = 0;
    for (; seen < 120 && await page.evaluate(() => document.activeElement?.closest(".recruit-tab") !== null); seen += 1) {
      expect(await covered()).toBe("");
      await page.keyboard.press("Tab");
    }
    expect(seen).toBeGreaterThan(10);
    // Back up the pane as well, where the totals in sight at its top could cover what comes into view.
    await page.locator(".map-pane-body").evaluate((body) => { body.scrollTop = body.scrollHeight; });
    await page.locator(".recruit-tab").locator("button, summary, [tabindex='0']").last().focus();
    for (seen = 0; seen < 120 && await page.evaluate(() => document.activeElement?.closest(".recruit-tab") !== null); seen += 1) {
      expect(await covered()).toBe("");
      await page.keyboard.press("Shift+Tab");
    }
    expect(seen).toBeGreaterThan(10);
    await page.locator(".map-pane-body").evaluate((body) => { body.scrollTop = body.scrollHeight; });
    const gap = await page.evaluate(() => (document.querySelector(".recruit-queue")?.getBoundingClientRect().top ?? 0) - (document.querySelector(".recruit-basket")?.getBoundingClientRect().bottom ?? 0));
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => (document.querySelector(".recruit-queue")?.getBoundingClientRect().bottom ?? 0) <= (document.querySelector(".map-pane-body")?.getBoundingClientRect().bottom ?? 0) + 1)).toBe(true);
  });
}
