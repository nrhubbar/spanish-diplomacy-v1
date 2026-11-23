import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { endTurnAnyway } from "./turn";

// F1 on a real report: Spain fights standing battles every turn (M27), so the first turn's
// report always has battle cards, and on a busy turn the third card on starts collapsed.

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

interface Target {
  readonly collapsed: boolean;
  readonly territoryId: string;
  readonly x: number;
  readonly y: number;
}

/**
 * A battle territory to click, and a point on it that hits its region rather than a counter or
 * the pane. Collapsed cards come first, so the click has a card to open.
 */
async function battleTarget(page: Page): Promise<Target> {
  const target = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLDetailsElement>("details.battle-card")];
    const ordered = [...cards.filter((card) => !card.open), ...cards.filter((card) => card.open)];
    for (const card of ordered) {
      for (const territoryId of card.dataset["places"]?.split(" ") ?? []) {
        const region = document.querySelector(`.map-region[data-territory-id="${territoryId}"]`);
        if (region === null) continue;
        const box = region.getBoundingClientRect();
        for (let row = 1; row < 12; row += 1) {
          for (let column = 1; column < 12; column += 1) {
            const x = box.left + (box.width * column) / 12;
            const y = box.top + (box.height * row) / 12;
            // The point and a margin around it must all hit the region, clear of its edges and of counters.
            const clear = [[0, 0], [-8, 0], [8, 0], [0, -8], [0, 8]].every(([dx = 0, dy = 0]) =>
              document.elementFromPoint(x + dx, y + dy)?.closest("[data-territory-id]")?.getAttribute("data-territory-id") === territoryId);
            if (clear) return { collapsed: !card.open, territoryId, x, y };
          }
        }
      }
    }
    return null;
  });
  if (target === null) throw new Error("no battle territory to click on the map");
  return target;
}

test("focuses a battle territory on a real turn-1 report: its card opens, in view (F1)", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  await endTurnAnyway(page);
  await expect(page.getByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
  await expect(page.locator(".map-vector")).toBeVisible();
  await expect(page.locator("details.battle-card").first()).toBeAttached();

  const target = await battleTarget(page);
  // Cards after the second start collapsed; a busy turn's click must open one.
  if (await page.locator("details.battle-card").count() > 2) expect(target.collapsed).toBe(true);
  await page.mouse.click(target.x, target.y);

  // On a phone the collapsed sheet opens by itself to show the card.
  const report = page.getByRole("complementary", { name: "Turn report" });
  await expect(report.getByRole("button", { name: "Hide turn report" })).toBeVisible();
  const card = report.locator('details.battle-card[data-focused="true"]').first();
  await expect(card).toHaveAttribute("data-places", new RegExp(`\\b${target.territoryId}\\b`));
  await expect(card).toHaveAttribute("open", "");
  await expect(card).toBeInViewport();
  await expect(page.locator(`[data-highlight="origin"][data-territory-highlight="${target.territoryId}"]`)).toBeAttached();
  await expectAccessible(page);
});
