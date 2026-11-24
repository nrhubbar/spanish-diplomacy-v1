import { expect, type Page, test } from "@playwright/test";
import { waitForCameraStill } from "./mapCamera";

// N6: a mission's target is chosen on the map; there is no drop-down.

async function openBomber(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".air-layer .unit-counter").first()).toBeAttached();
  if (await page.getByRole("complementary", { name: "Briefing" }).isVisible()) await page.getByRole("button", { exact: true, name: "Briefing" }).click();
  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Breguet XIX Light Bombers/ }).last().click();
  await expect(page.getByRole("heading", { name: "Breguet XIX Light Bombers" })).toBeVisible();
  await waitForCameraStill(page);
}

const mission = (page: Page, name: string) => page.getByRole("group", { name: "Mission" }).getByRole("button", { exact: true, name });
const panel = (page: Page) => page.getByRole("region", { name: "Choosing a target" });

test("plans Ground Support by a click on a highlighted territory", async ({ page }) => {
  await openBomber(page);
  await mission(page, "Ground Support").click();
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.locator(".map-highlights > *")).not.toHaveCount(0);
  await page.locator('.map-region[data-territory-id="castilla-y-leon"]').focus();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".air-target-card")).toContainText("Ground Support Castilla y León");
});

test("leaves with Escape, says why a territory is no target, and raids a sub-territory", async ({ page }) => {
  await openBomber(page);
  await mission(page, "Raid").click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Breguet XIX Light Bombers" })).toBeVisible();

  await mission(page, "Raid").click();
  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Raids target ground another faction holds.").first()).toBeVisible();
  await page.locator('.map-region[data-territory-id="castilla-y-leon"]').focus();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toContainText("Choose what to raid in Castilla y León.");
  await panel(page).getByRole("button", { name: /^Burgos/ }).click();
  await expect(page.locator(".air-target-card")).toContainText("Raid Burgos");
});
