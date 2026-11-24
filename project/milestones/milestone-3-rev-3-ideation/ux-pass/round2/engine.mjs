// Lets a mock call the app's own code: the indexed scenario (from a React prop) and the engine and
// presentation modules the dev server serves. Nothing in src/ changes; the mocks print what these return.
export async function engine(page) {
  await page.evaluate(async () => {
    const el = document.querySelector(".map-surface"); let top = el[Object.keys(el).find((k) => k.startsWith("__reactFiber"))];
    while (top.return) top = top.return;
    const stack = [top];
    while (stack.length && !window.__sc) { const f = stack.pop(); if (f.memoizedProps?.scenario?.index) window.__sc = f.memoizedProps.scenario; if (f.sibling) stack.push(f.sibling); if (f.child) stack.push(f.child); }
    const at = (p) => import(`/src/main/${p}.ts`);
    const [est, odds, must, army, text, grades, recruit, led, resources, eco] = await Promise.all(["engine/combat/estimate", "presentation/odds", "presentation/muster", "presentation/army", "presentation/text", "presentation/grades", "presentation/recruitment", "presentation/ledger", "engine/economy/resources", "presentation/economy"].map(at));
    window.__eng = { ...est, ...odds, ...must, ...army, ...text, ...grades, recruit, led, resources, eco };
  });
}
