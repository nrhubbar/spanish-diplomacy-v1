// Milestone 3 Rev 2 UX pass: pane, header and report mocks (window.M3P), on top of mock.js.
// Content comes from the real game state (the store) and from real pane markup harvested from
// the running app (window.__H), rearranged; the numbers it adds are marked as example data.
window.M3P = (() => {
  const { W, $, $$, el, state, session, viewer, subName, terrName, esc, ico, graph, graphKey, railReach, tooltip, layerToPage, toScreenFn, station, mapRect } = window.M3;
  const H = (window.__H = window.__H || {});
  const draft = () => session().draft ?? {};
  const unitName = (id) => W.units[id]?.name ?? state().raised?.[id]?.name ?? id;
  const typeName = (id) => W.unitTypes[id]?.name ?? id;
  const subsOf = (territoryId) => Object.values(W.subs).filter((s) => s.territoryId === territoryId);
  const improvementCost = { rail: { funds: 6, turns: 3 }, port: { funds: 8, turns: 3 } };
  const money = (c) => [c.funds ? `${c.funds} Funds` : "", c.manpower ? `${c.manpower}k Manpower` : ""].filter(Boolean).join(" · ");
  function projectInfo(project, siteId, levelOffset = 0) {
    const site = state().subTerritories[siteId];
    if (project.kind === "building") { const b = W.buildings[project.buildingId]; return { name: b.name, cost: b.cost, turns: b.turns }; }
    if (project.kind === "development") {
      const d = W.development[project.developmentId];
      const lvl = (site?.development?.[d.id] ?? 0) + levelOffset;
      return { name: `${d.name} ${lvl} → ${lvl + 1}`, cost: d.upgrade.cost, turns: d.upgrade.turns };
    }
    const c = improvementCost[project.improvement];
    const lvl = (site?.[project.improvement] ?? 0) + levelOffset;
    return { name: `${project.improvement === "rail" ? "Rail" : "Port"} ${lvl} → ${lvl + 1}`, cost: { funds: c.funds }, turns: c.turns };
  }
  const bar = (done, total, label) => `<div aria-label="${esc(label)} progress" aria-valuemax="${total}" aria-valuemin="0" aria-valuenow="${done}" class="queue-bar" role="progressbar"><span style="width: ${Math.round((100 * done) / total)}%"></span></div>`;
  const turnsLeft = (n) => (n <= 0 ? "ready this turn" : n === 1 ? "1 turn left" : `${n} turns left`);

  // ---------- Harvesting real markup ----------
  function harvest(key) {
    const body = $(".map-pane-body");
    if (key === "territory") {
      H.heading = $(".territory-heading")?.outerHTML;
      H.unitsPanel = $('.pane-tab-panel[id$="-units"]')?.innerHTML;
      H.recruitPanel = $('.pane-tab-panel[id$="-recruit"]')?.innerHTML;
    }
    if (key === "sites") { H.sites = Object.fromEntries($$(".site-cards .site-card").map((a) => [a.getAttribute("aria-label"), a.outerHTML])); }
    if (key.startsWith("buildlist:")) { H[key] = $(".build-list")?.outerHTML; H[`chips:${key.slice(10)}`] = $(".sub-territory-focus .site-chips")?.outerHTML; }
    return Object.keys(H);
  }

  // ---------- Note 9: what is recruiting and building here, with progress ----------
  function recruitQueueHtml(territoryId) {
    const s = state();
    const rows = s.training.filter((t) => t.territoryId === territoryId && t.factionId === viewer()).map((t) => {
      const total = W.unitTypes[t.typeId]?.recruit?.trainingTurns ?? 2;
      const done = total - t.turnsLeft;
      return `<li class="queue-head"><div class="queue-line"><span>${ico("flag")}<strong>${esc(typeName(t.typeId))}</strong></span><span class="queue-status">${turnsLeft(t.turnsLeft)}${t.paused ? " · paused (contested)" : ""}</span></div>${bar(done, total, typeName(t.typeId))}</li>`;
    });
    const ordered = (draft().recruits ?? []).filter((r) => r.territoryId === territoryId).map((r) => {
      const total = W.unitTypes[r.unitTypeId]?.recruit?.trainingTurns ?? 2;
      return `<li class="queue-head"><div class="queue-line"><span>${ico("flag")}<strong>${esc(typeName(r.unitTypeId))}</strong></span><span class="queue-status">this turn · ${total} ${total === 1 ? "turn" : "turns"}</span><button class="text-button" type="button">Cancel</button></div>${bar(0, total, typeName(r.unitTypeId))}</li>`;
    });
    return `<div class="m3-queue-block"><h4>Recruiting <small>${rows.length + ordered.length} of 3 slots · example queue</small></h4>
      <div class="m3-queue-card"><div class="m3-queue-where">Barracks at ${esc(subName(W.territories[territoryId].capitalSubTerritoryId))}<span>2 recruits a turn</span></div>
      <ol class="site-queue">${rows.join("")}${ordered.join("")}<li class="queue-next"><div class="queue-line"><span>${ico("flag")}Next: <strong>Infantry regiment</strong></span><span class="queue-status">waits for a slot · 6 Funds · 1k</span></div></li></ol></div></div>`;
  }
  function buildQueueHtml(territoryId) {
    const s = state();
    const planned = draft().builds ?? [];
    const cards = subsOf(territoryId).map((sub) => {
      const site = s.subTerritories[sub.id];
      if (!site) return "";
      const own = site.holder === viewer();
      const queue = [...site.queue.map((q) => ({ ...q, planned: false })), ...planned.filter((b) => b.subTerritoryId === sub.id).map((b) => ({ project: b.project, progress: 0, planned: true }))];
      const seen = {};
      const items = queue.map((q, at) => {
        const key = JSON.stringify(q.project);
        const info = projectInfo(q.project, sub.id, seen[key] ?? 0);
        seen[key] = (seen[key] ?? 0) + 1;
        if (at === 0) return `<li class="queue-head"><div class="queue-line"><span>${ico("chimney")}<strong>${esc(info.name)}</strong></span><span class="queue-status">${q.planned ? `this turn · ${info.turns} turns` : turnsLeft(info.turns - q.progress)}</span></div>${bar(q.progress, info.turns, info.name)}</li>`;
        return `<li class="queue-next"><div class="queue-line"><span>${ico("chimney")}Next: <strong>${esc(info.name)}</strong></span><span class="queue-status">${q.planned ? "this turn" : "queued"} · ${info.turns} turns</span></div></li>`;
      });
      return `<div class="m3-queue-card"><div class="m3-queue-where">${esc(sub.name)}<span>${own ? (queue.length ? `${queue.length} in queue` : "") : "not yours"}</span></div>${items.length ? `<ol class="site-queue">${items.join("")}</ol>` : `<p class="m3-idle">${own ? "Nothing queued · Build" : "Queue hidden"}</p>`}</div>`;
    });
    return `<div class="m3-queue-block"><h4>Building <small>one queue per sub-territory</small></h4>${cards.join("")}</div>`;
  }
  function queuesOnUnitsTab(territoryId) {
    const list = $(".training-list");
    const html = recruitQueueHtml(territoryId) + buildQueueHtml(territoryId);
    if (list) list.outerHTML = html; else $('.pane-tab-panel[id$="-units"]').insertAdjacentHTML("beforeend", html);
  }

  // ---------- Note 15: Orders mode ----------
  function orderEntries() {
    const s = state();
    const dr = draft();
    const entries = [];
    for (const o of dr.orders ?? []) {
      const kind = o.kind === "move" ? (s.control[o.to]?.kind === "contested" || (s.control[o.to]?.factionId && s.control[o.to]?.factionId !== viewer()) ? "Attack" : "Move") : o.kind[0].toUpperCase() + o.kind.slice(1);
      entries.push({ type: "unit", region: o.from, title: unitName(o.unitId), meta: `${kind} · ${terrName(o.from)} → ${terrName(o.to)}` });
    }
    for (const a of dr.airOrders ?? []) {
      const m = a.mission;
      const where = m.subTerritoryId ? `${subName(m.subTerritoryId)} (${terrName(W.subs[m.subTerritoryId].territoryId)})` : terrName(m.territoryId);
      entries.push({ type: "air", region: s.units[a.unitId]?.territoryId, title: unitName(a.unitId), meta: `${m.kind[0].toUpperCase() + m.kind.slice(1)} · ${where}` });
    }
    for (const r of dr.recruits ?? []) {
      const t = W.unitTypes[r.unitTypeId];
      entries.push({ type: "recruit", region: r.territoryId, title: `${typeName(r.unitTypeId)} at ${subName(W.territories[r.territoryId].capitalSubTerritoryId)}`, meta: `Recruit · ${money(t.recruit.cost)} · ${t.recruit.trainingTurns} ${t.recruit.trainingTurns === 1 ? "turn" : "turns"}`, bar: [0, t.recruit.trainingTurns], fresh: true });
    }
    for (const t of s.training.filter((x) => x.factionId === viewer())) {
      const total = W.unitTypes[t.typeId]?.recruit?.trainingTurns ?? 2;
      entries.push({ type: "recruit", region: t.territoryId, title: `${typeName(t.typeId)} at ${subName(W.territories[t.territoryId].capitalSubTerritoryId)}`, meta: `In training · ${turnsLeft(t.turnsLeft)}`, bar: [total - t.turnsLeft, total] });
    }
    for (const b of dr.builds ?? []) {
      const i = projectInfo(b.project, b.subTerritoryId, state().subTerritories[b.subTerritoryId].queue.filter((q) => JSON.stringify(q.project) === JSON.stringify(b.project)).length);
      entries.push({ type: "build", region: W.subs[b.subTerritoryId].territoryId, title: `${i.name} at ${subName(b.subTerritoryId)}`, meta: `Build · ${money(i.cost)} · ${i.turns} turns`, bar: [0, i.turns], fresh: true });
    }
    for (const [id, site] of Object.entries(s.subTerritories)) {
      if (site.holder !== viewer()) continue;
      site.queue.forEach((q, at) => {
        const i = projectInfo(q.project, id, site.queue.slice(0, at).filter((o) => JSON.stringify(o.project) === JSON.stringify(q.project)).length);
        entries.push({ type: "build", region: W.subs[id].territoryId, title: `${i.name} at ${subName(id)}`, meta: at === 0 ? `Under way · ${turnsLeft(i.turns - q.progress)}` : `Queued · starts after ${projectInfo(site.queue[0].project, id).name}`, bar: at === 0 ? [q.progress, i.turns] : undefined });
      });
    }
    return entries;
  }
  const typeGroups = [["unit", "Unit orders", "move"], ["air", "Air missions", "plane"], ["recruit", "Recruits", "flag"], ["build", "Builds", "chimney"]];
  function rowHtml(e, showType) {
    return `<li class="m3-order-row"><strong>${esc(e.title)}</strong><span class="formation-meta">${esc(e.meta)}${e.fresh ? " · this turn" : ""}</span>${e.fresh || e.type === "unit" || e.type === "air" ? '<button class="text-button" type="button">Cancel</button>' : ""}${e.bar ? bar(e.bar[0], e.bar[1], e.title) : ""}</li>`;
  }
  function ordersBody(groupBy) {
    const entries = orderEntries();
    const dr = draft();
    const thisTurn = (dr.orders?.length ?? 0) + (dr.airOrders?.length ?? 0) + (dr.recruits?.length ?? 0) + (dr.builds?.length ?? 0);
    let groups;
    if (groupBy === "type") {
      groups = typeGroups.map(([t, label, icon]) => ({ label, icon, rows: entries.filter((e) => e.type === t) }));
    } else {
      const regions = [...new Set(entries.map((e) => e.region))];
      groups = regions.map((r) => ({ label: terrName(r), icon: null, rows: entries.filter((e) => e.region === r) }));
    }
    return `<section class="pane-section">
      <div class="m3-orders-head"><p class="pane-meta">Turn 2 · ${thisTurn} orders given this turn</p>
        <div class="m3-groupby" role="group" aria-label="Group orders"><button aria-pressed="${groupBy === "type"}" type="button">By type</button><button aria-pressed="${groupBy === "region"}" type="button">By region</button></div></div>
      <p class="m3-spend">Spends <b>14 Funds</b> and <b>4k Manpower</b> when revealed</p><p class="pane-meta order-summary">${esc(H.summary ?? "")}</p>
      ${groups.filter((g) => g.rows.length).map((g) => `<div class="m3-order-group"><h4>${g.icon ? ico(g.icon) : ""}${esc(g.label)} <span class="pane-tab-count">${g.rows.length}</span></h4><ul class="m3-order-list">${g.rows.map((e) => rowHtml(e, groupBy === "region")).join("")}</ul></div>`).join("")}
    </section>`;
  }
  function setPaneTitle(html) {
    const h2 = $(".map-pane-title");
    const wrap = el(`<div class="m3-pane-title-wrap">${html}</div>`);
    h2.replaceWith(wrap);
  }
  function ordersMode(groupBy = "type") {
    H.summary = $(".order-summary")?.textContent;
    $(".map-pane-title").textContent = "Orders";
    $(".map-pane-body").innerHTML = ordersBody(groupBy);
  }

  // ---------- Note 15: Territory Info mode ----------
  function productionHtml(territoryId) {
    const s = state();
    let tf = 0, tm = 0, held = 0;
    const subs = subsOf(territoryId);
    const rows = subs.map((sub) => {
      const site = s.subTerritories[sub.id];
      const own = site.holder === viewer();
      if (own) held += 1;
      const parts = Object.values(W.development).map((d) => ({ d, lvl: site.development?.[d.id] ?? 0 })).filter((x) => x.lvl > 0);
      const f = parts.filter((x) => x.d.resource === "funds").reduce((a, x) => a + x.lvl * x.d.yieldPerLevel, 0);
      const m = parts.filter((x) => x.d.resource === "manpower").reduce((a, x) => a + x.lvl * x.d.yieldPerLevel, 0);
      if (own) { tf += f; tm += m; }
      const src = parts.map((x) => `${x.d.name} ${x.lvl}`).join(" · ") || "no development";
      return `<tr><td>${sub.id === W.territories[territoryId].capitalSubTerritoryId ? "★ " : ""}${esc(sub.name)}<small>${own ? src : `held by ${esc(W.factions[site.holder]?.name ?? site.holder)}`}</small></td><td class="${f && own ? "m3-pos" : ""}">${own && f ? `+${f}` : "–"}</td><td class="${m && own ? "m3-pos" : ""}">${own && m ? `+${m}k` : "–"}</td></tr>`;
    });
    const whole = held === subs.length;
    return `<div class="build-tab-head"><h4>Production</h4><span class="pane-hint">What ${esc(terrName(territoryId))} pays a turn</span></div>
      <table class="m3-prod-table"><thead><tr><th>Sub-territory</th><th>Funds</th><th>Manpower</th></tr></thead><tbody>${rows.join("")}</tbody>
      <tfoot><tr><td>${whole ? "Held whole: pays" : "Contested: pays nothing"}</td><td class="m3-pos">+${whole ? tf : 0}</td><td class="m3-pos">+${whole ? tm : 0}k</td></tr></tfoot></table>
      <p class="pane-hint">Funds come from Mines and Industry, Manpower from Farms; one level yields 1 (1k men). A raid on a sub-territory cuts its yield for a turn.</p>
      <div class="m3-queue-block"><h4>Coming up <small>example data</small></h4><div class="m3-queue-card"><div class="m3-queue-where">Girona: Farms 1 → 2<span>this turn's build</span></div><p class="m3-idle">+1k Manpower a turn once built, from turn 5</p></div><div class="m3-queue-card"><div class="m3-queue-where">Barcelona: Farms 1 → 2<span>2 turns left</span></div><p class="m3-idle">+1k Manpower a turn from turn 4</p></div></div>`;
  }
  function buildingsHtml(territoryId, expanded) {
    const s = state();
    const planned = draft().builds ?? [];
    return `<div class="build-tab"><div class="build-tab-head"><h4>Sub-territories</h4><span class="pane-hint">Open one to queue work</span></div>${subsOf(territoryId).map((sub) => {
      const site = s.subTerritories[sub.id];
      const own = site.holder === viewer();
      const queue = [...site.queue, ...planned.filter((b) => b.subTerritoryId === sub.id).map((b) => ({ project: b.project, progress: 0, planned: true }))];
      const head = queue[0];
      const info = head ? projectInfo(head.project, sub.id) : undefined;
      const card = H.sites?.[sub.name] ? el(H.sites[sub.name]) : undefined;
      const y = card?.querySelector(".site-yield")?.textContent ?? "";
      const capital = sub.id === W.territories[territoryId].capitalSubTerritoryId;
      const mini = info ? `${ico("chimney", 'width="14" height="14" style="fill:none;stroke:currentColor;stroke-width:1.7"')}<span>${esc(info.name)}</span>${bar(head.progress, info.turns, info.name)}<span>${head.planned ? "this turn" : turnsLeft(info.turns - head.progress)}${queue.length > 1 ? ` · +${queue.length - 1} queued` : ""}</span>` : `<span>${own ? "Nothing queued" : "Not yours"}</span>`;
      const open = sub.id === expanded;
      const body = open ? (H[`buildlist:${sub.id}`] ?? H.sites?.[sub.name] ?? "") : "";
      return `<details class="m3-site" data-own="${own}"${open ? " open" : ""}><summary><h4>${capital ? "★ " : ""}${esc(sub.name)}</h4><span class="site-yield">${esc(y)}</span><span class="m3-mini">${mini}</span></summary>${open ? `<div class="m3-site-body">${H[`chips:${sub.id}`] ?? ""}${body}</div>` : ""}</details>`;
    }).join("")}</div>`;
  }
  function territoryInfo(territoryId, tab, { mode = "a", expanded, compact = false } = {}) {
    const count = orderEntries().filter((e) => e.fresh || e.type === "unit" || e.type === "air").length;
    const name = terrName(territoryId);
    if (mode === "a") setPaneTitle(`<button class="m3-back" type="button">← Orders <span class="pane-tab-count">${count}</span></button><h2 class="map-pane-title">${esc(name)}</h2>`);
    else setPaneTitle(`<div class="pane-tab-list m3-mode-tabs" role="tablist" aria-label="Pane"><button class="pane-tab" role="tab" aria-selected="false" type="button">Orders <span class="pane-tab-count">${count}</span></button><button class="pane-tab" role="tab" aria-selected="true" type="button">${esc(name)}</button></div>`);
    const heading = el(H.heading);
    heading.querySelector("h3")?.remove();
    const unitsCount = (H.unitsPanel?.match(/class="formation-button"/g) ?? []).length;
    const tabs = [["units", "Units", unitsCount], ["buildings", "Buildings", (draft().builds ?? []).filter((b) => W.subs[b.subTerritoryId].territoryId === territoryId).length + subsOf(territoryId).filter((s) => state().subTerritories[s.id].queue.length).length], ["recruit", "Recruit"], ["production", "Production"]];
    const panel = tab === "units" ? H.unitsPanel : tab === "buildings" ? buildingsHtml(territoryId, expanded) : tab === "recruit" ? H.recruitPanel : productionHtml(territoryId);
    $(".map-pane-body").innerHTML = `<section aria-label="Territory" class="pane-section"><div class="pane-tabs">${compact ? "" : heading.outerHTML}<div aria-label="Territory" class="pane-tab-list" role="tablist">${tabs.map(([id, label, n]) => `<button class="pane-tab" data-tab="${id}" role="tab" aria-selected="${id === tab}" type="button">${label}${n ? ` <span class="pane-tab-count">${n}</span>` : ""}</button>`).join("")}</div><div class="pane-tab-panel" role="tabpanel">${panel}</div></div></section>`;
  }

  // ---------- Note 16: Funds and Manpower balance ----------
  function balanceRows(resource) {
    const s = state();
    const rows = [];
    for (const t of Object.values(W.territories)) {
      const subs = subsOf(t.id);
      const mine = subs.filter((x) => s.subTerritories[x.id]?.holder === viewer());
      if (!mine.length) continue;
      const gross = mine.reduce((a, x) => a + Object.values(W.development).filter((d) => d.resource === resource).reduce((b, d) => b + (s.subTerritories[x.id].development?.[d.id] ?? 0) * d.yieldPerLevel, 0), 0);
      const whole = mine.length === subs.length;
      rows.push({ name: t.name, gross, whole, held: `${mine.length}/${subs.length}` });
    }
    rows.sort((a, b) => Number(b.whole) - Number(a.whole) || b.gross - a.gross);
    return rows;
  }
  function balance(resource) {
    const isF = resource === "funds";
    const unit = isF ? "" : "k";
    const rows = balanceRows(resource);
    const total = rows.filter((r) => r.whole).reduce((a, r) => a + r.gross, 0);
    const lost = rows.filter((r) => !r.whole).reduce((a, r) => a + r.gross, 0);
    const chip = $$(".resource-chip").find((b) => b.textContent.includes(isF ? "Funds" : "Manpower"));
    const wrap = chip.closest(".resource-chip-wrap");
    let det = wrap.querySelector(".resource-detail");
    if (!det) { chip.click(); det = wrap.querySelector(".resource-detail"); }
    const tre = state().treasuries[viewer()][resource];
    const line = (r) => `<tr data-contested="${!r.whole}"><td>${esc(r.name)}${r.whole ? "" : ` <small class="muted">(${r.held} held)</small>`}</td><td class="m3-pos">+${r.gross}${unit}</td><td class="${r.whole ? "" : "m3-neg"}">${r.whole || !r.gross ? "" : `−${r.gross}${unit} <small>contested</small>`}</td><td><b>${r.whole ? `+${r.gross}${unit}` : `0`}</b></td></tr>`;
    det.classList.add("m3-balance");
    det.innerHTML = `<p><strong>${isF ? "Funds" : "Manpower"}: ${tre}${unit}</strong></p>
      <table><tbody>
        <tr class="m3-sub"><td>Held whole</td><td></td><td></td><td></td></tr>${rows.filter((r) => r.whole).map(line).join("")}
        <tr class="m3-sub"><td>Contested: pays nothing</td><td></td><td></td><td></td></tr>${rows.filter((r) => !r.whole).map(line).join("")}
      </tbody><tfoot><tr><td>Next turn</td><td>+${total + lost}${unit}</td><td class="m3-neg">−${lost}${unit}</td><td>+${total}${unit}</td></tr></tfoot></table>
      <p>${isF ? "This turn's orders spend 14 when revealed." : "This turn's orders spend 4k when revealed."} Raids cut a sub-territory's yield for a turn.</p>
      <ul aria-label="Other factions" class="resource-others"><li><span>Northern Insurgent Command</span><span class="resource-hidden">hidden</span></li><li><span>Southern Insurgent Command</span><span class="resource-hidden">hidden</span></li></ul>`;
    return { total, lost, rows };
  }

  // ---------- Note 10: What happened, grouped by player ----------
  function reportByPlayer() {
    const section = $('section[aria-labelledby="outcomes-title"]');
    const s = state();
    const factions = Object.values(W.factions);
    const names = Object.values(W.units).map((u) => [u.name, u.factionId]).concat(Object.entries(s.raised ?? {}).map(([id, u]) => [u.name, u.factionId])).sort((a, b) => b[0].length - a[0].length);
    const subNames = Object.values(W.subs).map((x) => [x.name, x.id]).sort((a, b) => b[0].length - a[0].length);
    function owner(text) {
      for (const f of factions) if (text.startsWith(`${f.name}:`) || text.includes(`by ${f.name}'s`) || text.startsWith(`${f.name}'s`)) return f.id;
      for (const [n, f] of names) if (text.includes(n) && !/^(Militia column|Infantry regiment) No\. \d/.test(n)) return f;
      const at = /(?:at|in|on) ([A-ZÁÉÍÓÚ][\wáéíóúñ ]+?)(?:[.,]|$| \()/u.exec(text);
      if (at) { const hit = subNames.find(([n]) => at[1].startsWith(n)); if (hit) return s.subTerritories[hit[1]]?.holder; }
      for (const f of factions) if (text.includes(f.name)) return f.id;
      return undefined;
    }
    const groups = $$(".outcome-group", section).map((g) => ({ summary: g.querySelector("summary"), open: g.open, lines: $$("li", g).map((li) => li.textContent) }));
    const per = Object.fromEntries(factions.map((f) => [f.id, []]));
    per.other = [];
    for (const g of groups) {
      const by = {};
      for (const line of g.lines) { const o = owner(line) ?? "other"; (by[o] ??= []).push(line.replace(/^(Republican Government|Northern Insurgent Command|Southern Insurgent Command): /, "")); }
      for (const [o, lines] of Object.entries(by)) per[o].push({ summary: g.summary, open: g.open, lines });
    }
    const block = (f, list) => {
      const n = list.reduce((a, g) => a + g.lines.length, 0);
      return `<details class="m3-faction" style="--fc: ${f.color}" open><summary><span class="m3-swatch"></span>${esc(f.name)}${f.id === viewer() ? " (you)" : ""}<small>${n} ${n === 1 ? "event" : "events"}</small></summary><div class="m3-faction-body">${list.map((g) => { const sum = g.summary.cloneNode(true); sum.lastChild.textContent = sum.lastChild.textContent.replace(/\(\d+\)/, `(${g.lines.length})`); return `<details class="outcome-group"${g.open || f.id === viewer() ? " open" : ""}>${sum.outerHTML}<ul>${g.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>`; }).join("")}</div></details>`;
    };
    const hint = $(".pane-hint", section)?.outerHTML ?? "";
    const tail = $$(".pane-hint", section).slice(-1)[0]?.outerHTML ?? "";
    section.innerHTML = `<h3 id="outcomes-title">What happened</h3>${factions.map((f) => (per[f.id].length ? block(f, per[f.id]) : "")).join("")}${per.other.length ? block({ id: "other", name: "Everyone", color: "#9b8b74" }, per.other) : ""}${tail}`;
    return Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.reduce((a, g) => a + g.lines.length, 0)]));
  }

  // ---------- Note 11: group Replenish ----------
  const repExample = { "Wad-Ras Infantry Regiment No. 1": [410, 550], "Covadonga Infantry Regiment No. 4": [380, 550], "Madrid Sierra Columns": [3900, 5000] };
  function damageExample() {
    for (const b of $$(".formation-button")) {
      const name = b.querySelector(".formation-name")?.textContent;
      const ex = repExample[name];
      if (!ex) continue;
      const s = b.querySelector(".army-line-strength");
      s.lastChild.textContent = `${ex[0]}/${ex[1]} men`;
      s.style.setProperty("--strength-share", String(ex[0] / ex[1]));
      const hidden = b.querySelector(".army-line .visually-hidden");
      if (hidden) hidden.textContent = hidden.textContent.replace(/\d+ of \d+ men/, `${ex[0]} of ${ex[1]} men`);
    }
  }
  function replenishA() {
    damageExample();
    const menu = $(".order-menu");
    const choice = el(`<div class="order-choice" data-order-kind="replenish"><span aria-hidden="true" class="order-choice-icon"></span><button class="order-choice-button" type="button">Replenish selected (9 Funds · 1k)</button><span class="order-choice-description">Refills 3 of the 5 selected units. Skips Madrid Assault and Civil Guards (at full strength) and General Miaja's Headquarters (generals don't replenish).</span></div>`);
    menu.prepend(choice);
    menu.setAttribute("aria-label", "Order for 5 units");
  }
  function replenishB() {
    damageExample();
    const list = $(".formation-list");
    list.insertAdjacentHTML("beforebegin", `<div class="m3-rep-col"><span>Unit</span><span>Replenish</span></div>`);
    const costs = { "Wad-Ras Infantry Regiment No. 1": ["3 Funds", true], "Covadonga Infantry Regiment No. 4": ["3 Funds", true], "Madrid Sierra Columns": ["3 Funds · 1k", false], "Madrid Assault and Civil Guards": ["full", null], "General Miaja's Headquarters": ["—", null] };
    for (const li of $$("li", list)) {
      const name = li.querySelector(".formation-name")?.textContent;
      const c = costs[name];
      if (!c) continue;
      li.classList.add("m3-has-rep");
      li.insertAdjacentHTML("beforeend", `<label class="m3-rep-box"${c[1] === null ? ' data-off="true"' : ""}><input type="checkbox"${c[1] ? " checked" : ""}${c[1] === null ? " disabled" : ""}>${c[0]}</label>`);
    }
    $(".order-command").insertAdjacentHTML("afterbegin", `<div class="m3-rep-total"><strong>Replenish 2 units</strong><span>6 Funds · +310 men this turn (example)</span><button class="secondary-button compact-button" type="button">Give Replenish</button></div>`);
  }
  function replenishAfter() {
    damageExample();
    const ordered = ["Wad-Ras Infantry Regiment No. 1", "Covadonga Infantry Regiment No. 4", "Madrid Sierra Columns"];
    for (const b of $$(".formation-button")) {
      const name = b.querySelector(".formation-name")?.textContent;
      if (!ordered.includes(name)) continue;
      b.dataset.ordered = "true";
      const meta = b.querySelector(".formation-meta");
      meta.textContent = meta.textContent.replace(/Entrenching/, "Replenishing");
    }
    const tools = $(".selection-tools");
    tools.insertAdjacentHTML("beforebegin", `<p class="inline-feedback" role="status">Replenish given to 3 units (9 Funds, 1k Manpower, example). Selection cleared.</p>`);
  }

  // ---------- Note 6: reachability from Valencia over connected rail only ----------
  function reachValencia() {
    const reach = railReach("valencia", "republic");
    const s = state();
    const cuts = W.graph.edges.filter(([a, b, rail]) => rail && (reach.has(a) !== reach.has(b)) && s.subTerritories[reach.has(a) ? b : a]?.holder !== "republic").map(([a, b]) => [a, b]);
    graph({ reach, cuts });
    const r = mapRect();
    graphKey({ x: r.left + 80, y: r.top + 14 }, { reach: true });
    const toScreen = toScreenFn();
    const at = (id) => layerToPage(toScreen(station(id)));
    document.body.classList.add("m3-hide-real-routes");
    tooltip(`<b>Almería: no rail from Murcia</b>The only line runs inland through Granada, which the Southern command holds. Rail to Murcia, then march by road: 1 turn.<div class="muted">Illustrative network · example numbers</div>`, at("almeria"), { dx: 18, dy: 14, below: true });
    tooltip(`<b>Madrid: line cut at Albacete</b>The Madrid–Valencia line runs through ground the Northern command took on turn 1. Rail can't reach Madrid from here.<div class="muted">Illustrative network · example numbers</div>`, at("albacete"), { dx: -120, dy: -16 });
    return [...reach];
  }

  return { harvest, queuesOnUnitsTab, ordersMode, territoryInfo, balance, reportByPlayer, replenishA, replenishB, replenishAfter, reachValencia, orderEntries };
})();
