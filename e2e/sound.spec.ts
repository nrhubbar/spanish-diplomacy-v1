import { expect, test } from "@playwright/test";

// The sliders, the mute and the Credits link only: nothing here listens to audio. Every other
// spec starts with sound off (playwright.config.ts); this one sets its own levels.
test("sound levels are kept in the browser, and Credits name the music", async ({ page }) => {
  const music: string[] = [];
  page.on("request", (request) => { if (["fetch", "media"].includes(request.resourceType()) && /\.(?:ogg|m4a|mp3)/.test(request.url())) music.push(request.url()); });
  await page.goto("#/settings");
  const effects = page.getByRole("slider", { name: "Effects" });
  await effects.focus();
  await effects.press("Home");
  for (let step = 0; step < 4; step += 1) await effects.press("ArrowRight");
  await expect(page.getByText("20%")).toBeVisible();
  await page.getByRole("button", { name: "Unmute master" }).click();
  await expect(page.getByRole("button", { name: "Mute master" })).toBeVisible();
  const box = await page.getByRole("button", { name: "Mute master" }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);

  await page.reload();
  await expect(page.getByRole("slider", { name: "Effects" })).toHaveValue("20");
  await expect(page.getByRole("button", { name: "Mute master" })).toBeVisible();

  await page.getByRole("button", { name: "Credits" }).click();
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
  await expect(page.getByText(/by Scott Buckley, released under/)).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Credits" })).toBeVisible();
  expect(music).toEqual([]);
});

test("the game's menu has no sound levels, and Settings is one click away", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await page.getByRole("button", { exact: true, name: "Menu" }).click();
  await expect(page.getByRole("group", { name: "Game menu" })).toBeVisible();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { exact: true, name: "Settings" }).click();
  await expect(page.getByRole("slider")).toHaveCount(3);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { exact: true, name: "Menu" })).toBeVisible();
});
