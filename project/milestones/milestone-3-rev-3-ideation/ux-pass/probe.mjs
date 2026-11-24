import { browser, newPage, start, openView, shot } from "./lib.mjs";
export const measure = () => {
  const body = document.querySelector(".map-pane-body"), b = body.getBoundingClientRect();
  const box = document.querySelector(".muster-box"), bx = box.getBoundingClientRect();
  const foot = document.querySelector(".muster-footer").getBoundingClientRect();
  const cards = [...document.querySelectorAll(".muster-card")];
  const footTop = foot.top + 0.0;
  const top = Math.max(b.top, getComputedStyle(box).position === "sticky" ? bx.bottom : b.top), bot = Math.min(b.bottom, footTop);
  const vis = cards.map((c) => { const r = c.getBoundingClientRect(); const v = Math.max(0, Math.min(r.bottom, bot) - Math.max(r.top, top)); return v / r.height; });
  return { body: Math.round(b.height), box: Math.round(bx.height), foot: Math.round(foot.height), listRoom: Math.round(bot - top), cards: cards.length, full: vis.filter((v) => v > 0.98).length, half: vis.filter((v) => v > 0.5).length, scrollH: body.scrollHeight, facts: document.querySelector(".muster-box-facts")?.innerText.replace(/\n/g, " | ").slice(0, 160) };
};
if (process.argv[1].endsWith("probe.mjs")) {
  const turns = Number(process.argv[2] ?? 1);
  for (const kind of ["desktop", "phone"]) {
    const page = await newPage(kind);
    await start(page, { orders2: false });
    for (let i = 1; i < turns; i += 1) await page.evaluate(() => { window.M3D.d("game/endTurn"); window.M3D.d("game/startNextTurn"); });
    await page.waitForTimeout(500);
    for (const target of ["aragon", "andalucia", "castilla-y-leon", "navarra", "extremadura", "galicia", "pais-vasco"]) {
      await openView(page, { kind: "invade", target });
      await page.waitForTimeout(200);
      const n = await page.locator(".muster-card").count();
      if (n === 0) { console.log(kind, target, "none"); continue; }
      const boxes = page.locator('.muster-card input[type="checkbox"]:not(:disabled)');
      for (let i = 0; i < await boxes.count(); i += 1) if (!(await boxes.nth(i).isChecked())) await boxes.nth(i).check({ force: true }).catch(() => {});
      await page.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 0; });
      await page.waitForTimeout(100);
      const top = await page.evaluate(measure);
      await page.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 420; });
      const mid = await page.evaluate(measure);
      console.log(kind, "t", turns + 1, target, JSON.stringify(top), "scrolled", JSON.stringify({ full: mid.full, half: mid.half, listRoom: mid.listRoom }));
      await shot(page, `probe-${kind}-${target}`);
    }
    await page.context().close();
  }
  await browser.close();
}
