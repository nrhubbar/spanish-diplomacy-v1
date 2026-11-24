import { expect, type Page, test } from "@playwright/test";

// The map pane's size, the Invade pane and the casualty chip, in a real layout.

async function plan(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  await page.keyboard.press("Escape");
}

/** Opens the Invade pane from the quick actions of a right-click (a long-press on a phone). */
async function invade(page: Page, territoryId: string): Promise<void> {
  await page.locator(`.map-region[data-territory-id="${territoryId}"]`).dispatchEvent("contextmenu", { bubbles: true, button: 2, clientX: 200, clientY: 300 });
  await page.getByRole("menuitem", { name: /^Invade/ }).click();
  await expect(page.getByRole("region", { name: "Invade" })).toBeVisible();
}

const fits = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** How many of the Invade pane's own unit cards are at least half in the pane's view. */
const cardsInView = (page: Page): Promise<number> => page.evaluate(() => {
  const view = document.querySelector(".map-pane-body")?.getBoundingClientRect();
  if (view === undefined) return 0;
  return [...document.querySelectorAll(".muster-card")].filter((card) => {
    const box = card.getBoundingClientRect();
    return Math.min(box.bottom, view.bottom) - Math.max(box.top, view.top) >= box.height / 2;
  }).length;
});

test("the pane's grip drags, takes keys, resets and is remembered", async ({ isMobile, page }) => {
  test.skip(isMobile, "The side pane is for wide screens.");
  await plan(page);
  const grip = page.getByRole("separator", { name: "Pane width" });
  const pane = page.locator(".map-pane");
  const width = async (): Promise<number> => Math.round((await pane.boundingBox())?.width ?? 0);
  const before = await width();
  const box = await grip.boundingBox();
  if (box === null) throw new Error("The grip has no box.");
  await page.mouse.move(box.x + 9, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x - 71, box.y + 100, { steps: 4 });
  await page.mouse.up();
  await expect.poll(width).toBe(before + 80);
  await grip.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(width).toBe(before + 96);
  await page.keyboard.press("Home");
  await expect.poll(width).toBe(300);
  await page.keyboard.press("End");
  const widest = Number(await grip.getAttribute("aria-valuemax"));
  await expect.poll(width).toBe(widest);
  await page.reload();
  await plan(page);
  await expect.poll(width).toBe(widest);
  // A narrower window clamps it again, and nothing ever scrolls sideways.
  for (const { max, size } of [{ max: 514, size: 1280 }, { max: 300, size: 1024 }]) {
    await page.setViewportSize({ height: 800, width: size });
    await expect(grip).toHaveAttribute("aria-valuemax", String(max));
    await expect.poll(width).toBe(max);
    expect(await fits(page)).toBe(true);
  }
  await page.setViewportSize({ height: 800, width: 1440 });
  await grip.dblclick();
  await expect.poll(width).toBe(before);
});

test("Invade shows unit cards at once, with the order button in the odds card", async ({ page }) => {
  await plan(page);
  await invade(page, "castilla-y-leon");
  const pane = page.getByRole("region", { name: "Invade" });
  const [first] = await pane.getByRole("checkbox").all();
  await first?.check();
  const odds = pane.locator(".muster-odds");
  await expect(odds.getByRole("table", { name: "Effects on the roll:" })).toBeVisible();
  await expect(odds.getByRole("button", { name: /^Order 1 unit to invade/ })).toBeVisible();
  await expect(page.locator(".unit-counter[data-selected=true]").first()).toBeAttached();
  await page.locator(".map-pane-body").evaluate((body) => { body.scrollTop = 500; });
  await expect.poll(() => cardsInView(page)).toBeGreaterThanOrEqual(3);
  expect(await page.locator(".map-pane-body").evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true);
});

test("the phone's sheet opens tall for Invade and stops where it is dragged", async ({ isMobile, page }) => {
  test.skip(!isMobile, "The sheet is for phones.");
  await plan(page);
  await invade(page, "castilla-y-leon");
  const sheet = page.locator(".map-pane");
  await expect(sheet).toHaveAttribute("data-stop", "tall");
  const grip = page.getByRole("separator", { name: "Pane height" });
  await grip.focus();
  await page.keyboard.press("ArrowDown");
  await expect(sheet).toHaveAttribute("data-stop", "half");
  await page.keyboard.press("ArrowDown");
  await expect(sheet).toHaveAttribute("data-stop", "bar");
  // The collapsed bar fits the room the camera leaves clear below the land (its height and margin).
  expect((await sheet.boundingBox())?.height ?? 0).toBeLessThanOrEqual(64);
  expect(await fits(page)).toBe(true);
});

test("the casualty chip is beside the faction's name and opens the split", async ({ page }) => {
  await plan(page);
  const chip = page.getByRole("button", { name: "0 casualties: none yet" });
  await expect(chip).toBeVisible();
  await chip.click();
  const split = page.getByRole("region", { name: "Casualties since turn 1" });
  await expect(split).toBeVisible();
  const box = await split.boundingBox();
  expect(box !== null && box.x >= 0 && box.x + box.width <= (page.viewportSize()?.width ?? 0)).toBe(true);
  expect(await fits(page)).toBe(true);
});

test("a rail order too big for the trains is refused whole, with the places left", async ({ page }) => {
  // Madrid opens with four units and six train places, so this game's stations and yards board half as many.
  await page.route(/\/spanish-civil-war-1936\/scenario\.json/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const fewer = body.replace('"unitsPerLevel":2', '"unitsPerLevel":1').replace('"rail-capacity","@data":{"units":2}', '"rail-capacity","@data":{"units":1}');
    expect(fewer).not.toBe(body);
    await route.fulfill({ body: fewer, response });
  });
  await plan(page);
  await page.locator('.map-region[data-territory-id="valencia"]').dispatchEvent("contextmenu", { bubbles: true, button: 2, clientX: 200, clientY: 300 });
  await page.getByRole("menuitem", { name: /^Reinforce/ }).click();
  const pane = page.getByRole("region", { exact: true, name: "Reinforce" });
  const madrid = pane.getByRole("region", { name: "From Madrid" });
  const boxes = await madrid.getByRole("checkbox").all();
  expect(boxes).toHaveLength(4);
  for (const box of boxes) await box.check();
  await pane.getByRole("button", { name: /^Order 4 units to reinforce/ }).click();
  await expect(pane.getByRole("alert")).toHaveText("Rail has only 3 places left at Madrid this turn, and 4 units would board.");
  // Three fit, and go.
  await boxes[3]?.uncheck();
  await pane.getByRole("button", { name: /^Order 3 units to reinforce/ }).click();
  await expect(pane).toBeHidden();
  await expect(page.locator(".map-pane")).not.toContainText("places left at Madrid");
});
