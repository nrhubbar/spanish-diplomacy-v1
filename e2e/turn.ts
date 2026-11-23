import { expect, type Page } from "@playwright/test";

// The steps of a planning turn that several suites share: selecting, choosing Move from the
// selection bar (U4) and ending the turn (U2).

/** Selects a territory, or picks it as the destination while one is being chosen. */
export async function selectTerritory(page: Page, territoryId: string): Promise<void> {
  await page.locator(`.map-region[data-territory-id="${territoryId}"]`).focus();
  await page.keyboard.press("Enter");
}

/** Presses Move in the selection bar, which starts choosing a destination. */
export async function chooseMove(page: Page): Promise<void> {
  await page.getByRole("group", { name: "Orders for the selected units" }).getByRole("button", { exact: true, name: "Move" }).click();
}

/** Presses End Turn while some armies have no order, and checks that the confirm asks first. */
export async function askToEndTurn(page: Page) {
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  const confirm = page.getByRole("alertdialog", { name: /^\d+ (army has|armies have) no order$/ });
  await expect(confirm).toBeVisible();
  return confirm;
}

/** Ends a turn in which some armies have no order: End Turn, then End anyway. */
export async function endTurnAnyway(page: Page): Promise<void> {
  const confirm = await askToEndTurn(page);
  await confirm.getByRole("button", { name: "End anyway" }).click();
  await expect(confirm).toHaveCount(0);
}
