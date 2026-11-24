import { expect, type Page, test } from "@playwright/test";
import { waitForCameraStill } from "./mapCamera";
import { endTurnAnyway, selectTerritory } from "./turn";

// D7: aircraft on the armies' cards, the Recruit fold-outs, and the battle report's ledger.

async function startCampaign(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".air-layer .unit-counter").first()).toBeAttached();
  if (await page.getByRole("complementary", { name: "Briefing" }).isVisible()) await page.getByRole("button", { exact: true, name: "Briefing" }).click();
}

/** Every aircraft card that covers an army's card or prints its role outside its own edges. */
async function badAircraft(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    // Laid-out positions, so a card lifted under the pointer is not measured while it moves.
    const box = (card: HTMLElement) => ({ bottom: card.offsetTop + card.offsetHeight, left: card.offsetLeft, right: card.offsetLeft + card.offsetWidth, top: card.offsetTop });
    const cards = (layer: string) => [...document.querySelectorAll<HTMLElement>(`${layer} .unit-counter`)];
    const armies = cards(".counter-layer:not(.air-layer)").map(box);
    return cards(".air-layer").flatMap((card) => {
      const own = box(card);
      const role = card.querySelector<HTMLElement>(".unit-counter-designation");
      const name = card.querySelector(".visually-hidden")?.textContent ?? "";
      return [
        ...(armies.some((army) => own.left < army.right && army.left < own.right && own.top < army.bottom && army.top < own.bottom) ? [`${name} covers an army`] : []),
        ...(role !== null && (role.scrollWidth > role.clientWidth || role.getBoundingClientRect().right > card.getBoundingClientRect().right) ? [`${name}: ${role.textContent} is cut off`] : [])
      ];
    });
  });
}

test("draws aircraft on the armies' cards, clear of every army, at all three zooms", async ({ page }) => {
  await startCampaign(page);
  await expect(page.locator(".air-layer").getByRole("button", { name: /2 aircraft in Madrid/ })).toBeAttached();
  const levels = new Set<string>();
  for (let step = 0; step < 8; step += 1) {
    await waitForCameraStill(page);
    const level = await page.locator(".air-layer").getAttribute("data-level") ?? "";
    levels.add(level);
    expect(await badAircraft(page)).toEqual([]);
    const role = page.locator('.air-counter[data-unit-id="rep-breguet-bombers"] .unit-counter-designation');
    if (await role.count() > 0) {
      if (level === "overview") await expect(role).toBeHidden();
      else await expect(role).toHaveText("BOMB");
    }
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    if (await zoomIn.isDisabled()) break;
    await zoomIn.click();
  }
  expect([...levels].sort()).toEqual(["detail", "operational", "overview"]);
});

for (const { text, width } of [{ text: "100%", width: 416 }, { text: "100%", width: 320 }, { text: "200%", width: 320 }]) {
  test(`keeps Recruit inside a ${String(width)} px pane at ${text} text, fold-outs open`, async ({ page }) => {
    await page.setViewportSize({ height: 800, width });
    await startCampaign(page);
    await page.addStyleTag({ content: `html { font-size: ${text} !important; }` });
    // The frame itself stays on the screen, whatever the text size.
    expect(await page.evaluate(() => [...document.querySelectorAll(".game-screen, .game-header, .campaign-map")].filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).map((element) => element.className))).toEqual([]);
    await selectTerritory(page, "madrid");
    await page.getByRole("tab", { name: "Recruit" }).evaluate((tab: HTMLElement) => { tab.click(); });
    const fold = page.locator(".recruit-effects").first();
    await expect(fold).not.toHaveAttribute("open");
    await fold.locator("summary").click();
    await expect(fold.getByRole("listitem").first()).toBeVisible();
    await page.locator(".recruit-effects").evaluateAll((folds) => { for (const each of folds) each.setAttribute("open", ""); });
    // Nothing in the tab runs past its own box, nor any row past the list.
    const wide = await page.evaluate(() => {
      const list = document.querySelector(".recruit-list")?.getBoundingClientRect().right ?? 0;
      return [".pane-tab-list", ".recruit-tab", ".recruit-list", ".recruit-row", ".recruit-effects"]
        .flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => ({ element, selector })))
        .filter(({ element }) => element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > list + 1)
        .map(({ element, selector }) => `${selector}: ${String(element.scrollWidth)} in ${String(element.clientWidth)}`);
    });
    expect(wide).toEqual([]);
  });
}

test("prints a battle's roll as a ledger that adds up, with who fought folded away", async ({ page }) => {
  await startCampaign(page);
  await endTurnAnyway(page);
  await expect(page.getByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
  const card = page.locator("details.battle-card").filter({ has: page.locator(".roll-ledger") }).first();
  await expect(card).toBeAttached();
  await card.evaluate((element: HTMLDetailsElement) => { element.open = true; });
  await expect(card.locator(".roll-ledger")).toContainText("Total");
  await expect(card).toContainText("Outcome");
  const fought = card.locator(".who-fought");
  await expect(fought).not.toHaveAttribute("open");
  await fought.locator("summary").click();
  await expect(fought.getByRole("table")).toContainText("men");
});
