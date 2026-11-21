// Milestone 3 Rev 2 close-out (b- renders): the decoupled pane, the new top bar, quick actions,
// Invade/Reinforce, global queues, routed order lines. Mock UI injected over the live app as
// window.M3B; builds on mock.js (window.M3) and mock-pane.js (window.M3P). Throwaway tooling.
window.M3B = (() => {
  const { W, $, $$, el, state, session, esc, toScreenFn, station, layerToPage, overlay, mapRect } = window.M3;
  const NS = "http://www.w3.org/2000/svg";
  const H = (window.__H = window.__H || {});
  const draft = () => session().draft ?? {};
  const typeName = (id) => W.unitTypes[id]?.name ?? id;
  const terrName = (id) => W.territories[id]?.name ?? id;
  const subName = (id) => W.subs[id]?.name ?? id;

  const I = {
    hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    chimney: '<path d="M3 21V11l5 3v-3l5 3V5h4v16z"/>',
    swords: '<path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4"/><path d="M7 14l3 3M17 14l-3 3M5 19l3-3M19 19l-3-3"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 9v6M9 12h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    hammer: '<path d="M14 6l4 4M3 21l9-9M11 4l2-1 8 8-1 2-3 0-6-6z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
    door: '<path d="M14 3H5v18h9"/><path d="M10 12h11M17 8l4 4-4 4"/>',
    plane: '<path d="M2 13l9-2 3-7h2l-1 7 7 2v2l-7-1-1 5 2 2H9l1-2-1-5-7 1z"/>',
    rail: '<path d="M8 3 6 21M16 3l2 18M7 7h10M6.5 12h11M6 17h12"/>',
    truck: '<path d="M2 6h12v10H2zM14 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    boot: '<path d="M7 3h5v9l7 3v4H5v-4l2-3z"/>',
    pass: '<path d="M4 17l8-9 8 9"/><path d="M8 17l4-4.5 4 4.5"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    trench: '<path d="M3 15h4l2 3h6l2-3h4"/><path d="M3 11h18"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  const ic = (n, cls = "") => `<svg class="m3b-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const pct = (a, b) => Math.round((100 * a) / b);
  const bar = (done, total) => `<div class="queue-bar" role="progressbar" aria-valuenow="${done}" aria-valuemax="${total}"><span style="width: ${pct(done, total)}%"></span></div>`;

  // ---------- The new chrome: top bar and pane frame ----------
  function counts() {
    const s = state(), dr = draft();
    const recruiting = s.training.filter((t) => t.factionId === "republic").length + (dr.recruits?.length ?? 0);
    const building = Object.values(s.subTerritories).filter((x) => x.holder === "republic" && x.queue.length).length + (dr.builds ?? []).filter((b) => !s.subTerritories[b.subTerritoryId].queue.length).length;
    return { recruiting, building };
  }
  function chrome({ active } = {}) {
    document.body.classList.add("m3b");
    const head = $(".game-header");
    const actions = $(".game-header-actions", head);
    const n = counts();
    // Readiness chips move up beside the date line (compact: abbreviation + dot) to free the row.
    const chips = $(".status-chips", head), kicker = $(".screen-kicker", head);
    if (chips && kicker && !$(".m3b-kickrow", head)) { const row = el('<div class="m3b-kickrow"></div>'); kicker.before(row); row.append(kicker, chips); }
    const nav = (id, icon, label, count) => `<button class="m3b-nav" data-on="${active === id}" type="button">${ic(icon)}<span class="m3b-nav-label">${label}</span>${count ? `<span class="m3b-count">${count}</span>` : ""}</button>`;
    actions.innerHTML = `<div class="m3b-navs">${nav("last", "history", "Last turn")}${nav("recruit", "flag", "Recruitment", n.recruiting)}${nav("build", "chimney", "Building", n.building)}</div>
      <button class="m3b-end" type="button">${ic("hourglass")}<span>End Turn</span></button>
      <button class="m3b-burger" aria-label="Menu" type="button">${ic("menu")}</button>`;
    // Phone: the collapsed pane bar loses its End Turn (it lives in the top bar now).
    for (const b of document.querySelectorAll("button")) if (b.textContent.trim() === "End Turn" && !b.classList.contains("m3b-end")) b.classList.add("m3b-phone-endturn");
    // Harvest one dug-in icon from the live cards (if any) for the mock cards.
    const dug = $('.status-chip[data-tone="dug-in"] .status-chip-icon');
    if (dug) H.dugIcon = dug.innerHTML;
  }
  /** The pane as a stack: back link + title in the header, a body, a sticky footer. */
  function view({ back, title, meta = "", body, footer = "" }) {
    const pane = $(".map-pane");
    pane.setAttribute("aria-label", title);
    const header = $(".map-pane-header", pane);
    $(".m3b-titlewrap", header)?.remove();
    const h2 = $(".map-pane-title", header);
    h2.style.display = "none";
    const wrap = el(`<div class="m3b-titlewrap">${back ? `<button class="m3-back" type="button">${ic("back")}${esc(back)}</button>` : ""}<h2 class="map-pane-title">${esc(title)}</h2>${meta ? `<p class="m3b-meta">${meta}</p>` : ""}</div>`);
    h2.after(wrap);
    const tog = $(".map-pane-toggle span:last-child", header);
    if (tog) tog.textContent = "Hide";
    $(".map-pane-body", pane).innerHTML = body;
    $(".map-pane-body", pane).scrollTop = 0;
    $(".map-pane-footer", pane).innerHTML = footer;
    $(".map-pane-footer", pane).classList.toggle("m3b-empty", !footer);
  }
  function actionBar({ count, where, acts = ["Move", "Replenish", "Entrench"], hint }) {
    return `<div class="m3b-actionbar"><div class="m3b-sel"><b>${count} units selected</b> · ${esc(where)}<button class="text-button" type="button">Clear</button></div>
      ${hint ? `<p class="m3b-hint">${hint}</p>` : `<div class="m3b-acts">${acts.map((a, i) => `<button class="m3b-act${i === 0 ? " m3b-act-main" : ""}" type="button">${ic(a === "Move" ? "boot" : a === "Replenish" ? "shield" : "trench")}${a}</button>`).join("")}</div>`}</div>`;
  }
  function thisTurn(footer = "") {
    window.M3P.ordersMode("type");
    const body = $(".map-pane-body").innerHTML.replace('<p class="pane-meta order-summary"></p>', "");
    view({ title: "This turn", meta: footer ? "Turn 2 · orders so far" : "Turn 2 · orders so far · no units selected", body, footer });
  }

  // ---------- Overlays: menu, quick actions, cursor, finger ----------
  function menu() {
    const b = $(".m3b-burger").getBoundingClientRect();
    $(".m3b-burger").dataset.on = "true";
    const m = el(`<div class="m3b-menu" role="menu"><button role="menuitem" type="button">${ic("gear")}Settings</button><button role="menuitem" aria-disabled="true" disabled type="button">${ic("save")}Save<small>Coming later</small></button><hr/><button role="menuitem" class="m3b-danger" type="button">${ic("door")}Exit Game</button></div>`);
    overlay().append(m);
    m.style.top = `${b.bottom + 6}px`;
    m.style.left = `${b.right - m.getBoundingClientRect().width}px`;
  }
  const pageAt = (sub) => layerToPage(toScreenFn()(station(sub)));
  function cursor(at, kind = "arrow") {
    const c = el(kind === "finger"
      ? `<div class="m3b-finger"></div>`
      : `<svg class="m3b-cursor" viewBox="0 0 16 24" width="16" height="24"><path d="M1 1v19l5-5 3.5 7 3-1.5L9 13.5h6.5z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>`);
    overlay().append(c);
    c.style.left = `${at.x}px`; c.style.top = `${at.y}px`;
    return c;
  }
  const quick = [
    ["swords", "Invade", "Contested: Cáceres is enemy-held"],
    ["shield", "Reinforce", "Castilla Regiment No. 3 holds Badajoz"],
    ["info", "Info", "Territory, units, production"],
    ["hammer", "Build", "Badajoz: 1 site you hold"]
  ];
  function contextMenu(sub, territory) {
    const at = pageAt(sub);
    hiTerritory(territory, "focus");
    const m = el(`<div class="m3b-ctx" role="menu"><p class="m3b-ctx-head">${esc(terrName(territory))} <span>Contested</span></p>${quick.map(([i, l, d]) => `<button role="menuitem" type="button">${ic(i)}<span><b>${l}</b><small>${d}</small></span></button>`).join("")}</div>`);
    overlay().append(m);
    m.style.left = `${at.x + 4}px`; m.style.top = `${at.y + 4}px`;
    cursor(at);
  }
  function radial(sub, territory) {
    const at = pageAt(sub);
    const vw = window.innerWidth;
    const p = { x: Math.min(Math.max(at.x, 124), vw - 124), y: at.y };
    hiTerritory(territory, "focus");
    const shade = el('<div class="m3b-shade"></div>');
    overlay().append(shade);
    const r = 78;
    const ang = [-90, 0, 90, 180];
    const wheel = el(`<div class="m3b-wheel"><div class="m3b-wheel-ring"></div><p class="m3b-wheel-name">${esc(terrName(territory))}<small>Contested</small></p>${quick.map(([i, l], k) => `<button type="button" style="left:${(r * Math.cos((ang[k] * Math.PI) / 180)).toFixed(1)}px;top:${(r * Math.sin((ang[k] * Math.PI) / 180)).toFixed(1)}px" data-on="${k === 0}">${ic(i)}<span>${l}</span></button>`).join("")}</div>`);
    overlay().append(wheel);
    wheel.style.left = `${p.x}px`; wheel.style.top = `${p.y}px`;
    cursor(p, "finger");
  }
  function unreachable(sub, territory, html, { phone = false } = {}) {
    const at = pageAt(sub);
    hiTerritory(territory, "out");
    if (phone) {
      overlay().append(el('<div class="m3b-shade m3b-shade-dark"></div>'));
      const f = cursor(at, "finger"); f.classList.add("m3b-tap");
      const m = el(`<div class="m3b-modal" role="dialog">${html}<div class="m3b-modal-acts"><button class="secondary-button" type="button">Show route</button><button class="m3b-primary" type="button">OK</button></div></div>`);
      overlay().append(m);
      return;
    }
    const t = el(`<div class="m3b-tip">${html}</div>`);
    overlay().append(t);
    t.style.left = `${at.x + 18}px`; t.style.top = `${at.y + 14}px`;
    cursor(at);
  }

  // ---------- Map pieces: territory highlight, routed order lines, pass chevrons ----------
  function hiTerritory(id, tone) {
    for (const reg of $$(`.map-region[data-territory-id="${id}"]`)) {
      const c = reg.cloneNode(false);
      for (const a of ["id", "class", "tabindex", "role", "aria-label", "data-territory-id"]) c.removeAttribute(a);
      c.setAttribute("class", `m3b-hi m3b-hi-${tone}`);
      reg.parentNode.append(c);
    }
  }
  function svgLayer() {
    let g = $(".m3b-lines");
    if (!g) {
      const real = $(".rail-layer:not(.m3-graph)");
      g = document.createElementNS(NS, "g");
      g.setAttribute("class", "m3b-lines");
      (real ? real.parentNode : $(".sub-territory-wash")).append(g);
    }
    return g;
  }
  const edgeOf = (a, b) => W.graph.edges.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  function chevron(at) {
    return `<g class="m3b-pass" transform="translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})"><circle r="7.5"/><path d="M-4 2.5 0-2.5 4 2.5"/></g>`;
  }
  /** An order line through the stations of `ids`, along the drawn network links. */
  function route(ids, { mode = "March", label, dim = false, arrow = true } = {}) {
    const T = toScreenFn();
    const pts = ids.map((id) => T(station(id)));
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const tip = (dx, dy) => `${(b.x + dx * Math.cos(ang) - dy * Math.sin(ang)).toFixed(1)} ${(b.y + dx * Math.sin(ang) + dy * Math.cos(ang)).toFixed(1)}`;
    let html = `<g class="m3b-route" data-mode="${mode}" data-dim="${dim}"><path class="m3b-route-halo" d="${d}"/><path class="m3b-route-line" d="${d}"/>`;
    if (arrow) html += `<path class="m3b-route-head" d="M${tip(2, 0)} L${tip(-11, -6)} L${tip(-8, 0)} L${tip(-11, 6)} Z"/>`;
    for (let i = 1; i < ids.length; i += 1) {
      const e = edgeOf(ids[i - 1], ids[i]);
      if (e?.[4]) html += chevron({ x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 });
    }
    for (const p of pts.slice(1, -1)) html += `<circle class="m3b-route-stop" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3"/>`;
    html += "</g>";
    const g = svgLayer();
    g.insertAdjacentHTML("beforeend", html);
    if (label) {
      const k = Math.floor((pts.length - 1) / 2);
      const m = { x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 };
      const pg = layerToPage(m);
      const l = el(`<div class="m3b-route-label" data-mode="${mode}" data-dim="${dim}">${ic(mode === "Rail" ? "rail" : mode === "Motor" ? "truck" : "boot")}${label}</div>`);
      overlay().append(l);
      l.style.left = `${pg.x}px`; l.style.top = `${pg.y}px`;
    }
  }
  /** Faint roads (main thicker), plus a chevron on every pass in view. No "+1 turn": passes cost no extra turn. */
  function roads() {
    const T = toScreenFn();
    let html = "";
    for (const [a, b, , road, pass] of W.graph.edges) {
      if (!road || !station(a) || !station(b)) continue;
      const A = T(station(a)), B = T(station(b));
      html += `<path class="m3b-road" data-road="${road}" d="M${A.x.toFixed(1)} ${A.y.toFixed(1)} L${B.x.toFixed(1)} ${B.y.toFixed(1)}"/>`;
    }
    for (const [a, b, , , pass] of W.graph.edges) {
      if (!pass || !station(a) || !station(b)) continue;
      const A = T(station(a)), B = T(station(b));
      html += chevron({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
    }
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "m3b-roads");
    g.innerHTML = html;
    const real = $(".rail-layer:not(.m3-graph)");
    if (real) real.before(g); else $(".sub-territory-wash").append(g);
  }

  // ---------- Unit cards for Invade / Reinforce ----------
  const dugChip = (lvl) => `<span class="status-chip" data-tone="dug-in"><span class="status-chip-icon">${H.dugIcon ?? ic("trench")}</span>Dug in ${lvl} · −${2 * lvl}</span>`;
  function card(u) {
    const modes = ["March", "Motor", "Rail"].map((m) => {
      const st = u.modes[m];
      return st ? `<span class="m3b-mode" data-state="${st === true ? "ok" : st}">${ic(m === "Rail" ? "rail" : m === "Motor" ? "truck" : "boot")}${m}</span>` : "";
    }).join("");
    return `<li class="m3b-card" data-checked="${u.checked}"><span class="m3b-check" aria-hidden="true"></span>
      <div class="m3b-card-main"><span class="formation-name">${esc(u.name)}</span><span class="formation-meta">${esc(u.meta)}</span>
      <span class="army-line"><span class="army-line-values"><strong>${u.val}</strong></span><span class="army-line-strength" style="--strength-share: ${(u.men / u.full).toFixed(3)};"><span class="army-line-bar"></span>${u.men}/${u.full} men</span>${u.dug ? `<span class="army-line-status">${dugChip(u.dug)}</span>` : ""}</span>
      <span class="m3b-modes">${modes}${u.note ? `<span class="m3b-note" data-tone="${u.tone ?? ""}">${u.note}</span>` : ""}</span></div></li>`;
  }
  const group = (title, sub, cards) => `<div class="m3b-group"><h4>${title}<small>${sub}</small></h4><ul class="m3b-cards">${cards.map(card).join("")}</ul></div>`;

  function oddsBlock({ att, def, odds, chance, defenders, air = true, expanded = false }) {
    return `<div class="m3b-odds">
      <div class="m3b-odds-top"><span class="m3b-side">Attack<b>${att}</b></span><div class="m3b-oddsbar"><span class="m3b-a" style="flex:${att}"></span><span class="m3b-d" style="flex:${def}"></span></div><span class="m3b-side m3b-right">Defence<b>${def}</b></span></div>
      <dl class="m3b-stats"><div><dt>Odds</dt><dd>≈ ${odds}</dd></div><div><dt>Take it (ground)</dt><dd class="m3b-chance">${chance}</dd></div><div><dt>Defenders</dt><dd>${defenders}</dd></div></dl>
      ${air ? `<p class="m3b-line">${ic("plane")}<span><b>Air battle first:</b> your fighter + bomber (+3) vs their Leon recon + AA 2 (+2). You win the air 53% (tie 5%): then Ground Support <b>+6</b>.</span></p>` : ""}
      <p class="m3b-line">${ic("pass")}<span><b>Passes:</b> no −2 for the defenders: Madrid units flank them over the open Madrid–Ávila road.</span></p>
    </div>`;
  }
  const madridUnits = [
    { name: "Madrid Sierra Columns", meta: "Militia column · Madrid → Ávila, open road", val: "3-4", men: 3900, full: 5000, checked: true, dug: 2, modes: { March: true, Motor: "off", Rail: "no" }, note: "Leaving loses its trench" },
    { name: "Covadonga Infantry Regiment No. 4", meta: "Infantry regiment · Guadarrama → Segovia", val: "4-6", men: 550, full: 550, checked: true, modes: { March: true, Motor: "no", Rail: "no" }, note: `${ic("pass")}Navacerrada pass: March only`, tone: "pass" },
    { name: "Wad-Ras Infantry Regiment No. 1", meta: "Infantry regiment · Madrid → Ávila, open road", val: "4-6", men: 550, full: 550, checked: true, modes: { March: "off", Motor: true, Rail: "no" }, note: "Trucks from Madrid" },
    { name: "Madrid Assault and Civil Guards", meta: "Security forces · keeps order in Madrid", val: "3-5", men: 3000, full: 3000, checked: false, dug: 1, modes: { March: true, Motor: "off" } }
  ];
  function invade() {
    const body = `<section class="pane-section m3b-invade">
      ${oddsBlock({ att: 15, def: 4, odds: "3:1", chance: "45%", defenders: `Militia column No. 1 · ${dugChip(1)}` })}
      ${group("From Madrid", "3 of 4 · border at Ávila and Segovia", madridUnits)}
      ${group("From Cantabria", "1 of 1 · border at Palencia", [{ name: "Valencia Infantry Regiment No. 21", meta: "Infantry regiment · Cantabria → Palencia", val: "4-6", men: 1070, full: 1070, checked: true, modes: { March: true, Motor: "no", Rail: "no" }, note: `${ic("pass")}Reinosa pass: March only`, tone: "pass" }])}
      ${group("From Asturias", "0 of 1 · border at León", [{ name: "Asturian Miners' Militia", meta: "Militia column · Asturias → León", val: "3-4", men: 10000, full: 10000, checked: false, modes: { March: true, Motor: "no" }, note: "Asturias is contested: leaving hands Oviedo the fight", tone: "warn" }])}
      <div class="m3b-group m3b-air"><h4>${ic("plane")}Ground Support<small>in range · at most 2 a side · +3 each</small></h4><ul class="m3b-cards">
        <li class="m3b-card m3b-aircard" data-checked="true"><span class="m3b-check"></span><div class="m3b-card-main"><span class="formation-name">Hispano-Nieuport Ni-52 Fighters</span><span class="formation-meta">Fighter squadron · Madrid · +2 in the air battle</span></div></li>
        <li class="m3b-card m3b-aircard" data-checked="true"><span class="m3b-check"></span><div class="m3b-card-main"><span class="formation-name">Breguet XIX Light Bombers</span><span class="formation-meta">Bomber squadron · Madrid · +1 in the air battle</span><span class="m3b-note" data-tone="warn">Replaces its Raid on Guadalajara</span></div></li>
      </ul></div>
    </section>`;
    view({ back: "This turn", title: "Invade Castilla y León", meta: "Northern Insurgent Command · 9 sub-territories · reachable from 3 of yours", body, footer: `<div class="m3b-orderbar"><span><b>4 units</b> + 2 aircraft · 45% ground, +6 if you win the air</span><button class="m3b-primary" type="button">${ic("swords")}Order 4 units to invade</button></div>` });
    hiTerritory("castilla-y-leon", "target");
    route(["madrid", "avila"], { mode: "Motor" });
    route(["madrid", "guadarrama", "segovia"], { mode: "March" });
    route(["cantabria", "palencia"], { mode: "March" });
    route(["asturias", "leon"], { mode: "March", dim: true });
  }
  function reinforce() {
    const body = `<section class="pane-section m3b-invade">
      <div class="m3b-odds m3b-def">
        <div class="m3b-odds-top"><span class="m3b-side">Defence now<b>12</b></span><div class="m3b-oddsbar"><span class="m3b-d" style="flex:12"></span><span class="m3b-plus" style="flex:10"></span><span class="m3b-gap" style="flex:2"></span></div><span class="m3b-side m3b-right">After<b>22</b></span></div>
        <dl class="m3b-stats"><div><dt>Units</dt><dd>2 → 4</dd></div><div><dt>Strongest threat</dt><dd>Aragón · attack 16</dd></div><div><dt>Against it</dt><dd class="m3b-chance">holds ≈ 1:1.4</dd></div></dl>
        <p class="m3b-line">${ic("trench")}<span><b>Arrivals start un-dug.</b> Otumba No. 9 stays ${dugChip(2)}; new arrivals dig in from next turn.</span></p>
        <p class="m3b-small">Valencia's militia column is already ordered to Murcia, so it is not counted.</p>
      </div>
      ${group("From Cataluña", "1 of 3 · rail along the coast", [
        { name: "Catalan Militia Columns", meta: "Militia column · Barcelona → Valencia by rail", val: "3-4", men: 5000, full: 5000, checked: true, modes: { March: "no", Motor: "off", Rail: true }, note: "Rail: 3 links, all yours (Tarragona, Castellón)" },
        { name: "Durruti Column", meta: "Militia column · ordered: attack Aragón", val: "3-4", men: 2500, full: 2500, checked: false, modes: { Rail: true }, note: "Ticking this replaces its attack order", tone: "warn" },
        { name: "Barcelona Security Forces", meta: "Security forces · keeps order in Barcelona", val: "3-5", men: 5000, full: 5000, checked: false, dug: 1, modes: { March: "no", Rail: true } }
      ])}
      ${group("From Murcia", "1 of 1 · main road via Alicante", [{ name: "Sevilla Infantry Regiment No. 34", meta: "Infantry regiment · Cartagena → Valencia", val: "4-6", men: 775, full: 775, checked: true, modes: { March: "no", Motor: true }, note: "Motor: 2 links on the main road" }])}
    </section>`;
    view({ back: "This turn", title: "Reinforce Valencia", meta: "Yours · 3 sub-territories · borders Aragón and Castilla-La Mancha", body, footer: `<div class="m3b-orderbar"><span><b>2 units</b> · defence 12 → 22</span><button class="m3b-primary m3b-blue" type="button">${ic("shield")}Order 2 units to reinforce</button></div>` });
    hiTerritory("valencia", "friend");
    route(["barcelona", "tarragona", "castellon", "valencia"], { mode: "Rail" });
    route(["murcia", "alicante", "valencia"], { mode: "Motor" });
  }

  // ---------- Global Recruitment / Building ----------
  function qcard(where, sub, rows) {
    return `<div class="m3b-q"><div class="m3b-q-head"><b>${esc(where)}</b><span>${sub}</span></div>${rows.join("")}</div>`;
  }
  const active = (icon, name, done, total, right, extra = "") => `<div class="m3b-q-active">${ic(icon)}<b>${esc(name)}</b><span class="m3b-q-left">${right}</span>${bar(done, total)}${extra}</div>`;
  const queued = (n, name, right) => `<div class="m3b-q-next"><span class="m3b-q-n">${n}</span>${esc(name)}<span>${right}</span></div>`;
  function globalRecruitment() {
    const s = state(), dr = draft();
    const by = {};
    for (const t of s.training.filter((x) => x.factionId === "republic")) (by[t.territoryId] ??= { active: [], queue: [] }).active.push(t);
    for (const r of dr.recruits ?? []) (by[r.territoryId] ??= { active: [], queue: [] }).queue.push(r);
    const order = ["catalunya", "madrid", "valencia"];
    const ids = [...new Set([...order.filter((x) => by[x]), ...Object.keys(by)])];
    let finishing = 0, nActive = 0, nQueue = 0;
    const cards = ids.map((tid) => {
      const g = by[tid];
      const rows = [];
      const slot = tid === "catalunya" ? "Barracks · 1 at a time" : tid === "madrid" ? "Barracks · 1 at a time" : "Barracks · 1 at a time";
      if (g.active.length) {
        for (const t of g.active) {
          const total = W.unitTypes[t.typeId].recruit.trainingTurns;
          rows.push(active("flag", typeName(t.typeId), total - t.turnsLeft, total, t.turnsLeft === 1 ? "1 turn left" : `${t.turnsLeft} turns left`));
          nActive += 1; if (t.turnsLeft === 1) finishing += 1;
        }
        g.queue.forEach((r, i) => { const tt = W.unitTypes[r.unitTypeId].recruit.trainingTurns; rows.push(queued(i + 1, typeName(r.unitTypeId), `ordered this turn · ${tt} ${tt === 1 ? "turn" : "turns"} once started`)); nQueue += 1; });
      } else {
        g.queue.forEach((r, i) => {
          const tt = W.unitTypes[r.unitTypeId].recruit.trainingTurns;
          if (i === 0) { rows.push(active("flag", typeName(r.unitTypeId), 0, tt, `starts this turn · ${tt} turns`)); nActive += 1; }
          else { rows.push(queued(i, typeName(r.unitTypeId), `${tt} turns`)); nQueue += 1; }
        });
      }
      if (tid === "catalunya") { rows.push(queued(g.queue.length + 1, "Infantry regiment", "queued last turn · 2 turns")); nQueue += 1; }
      return qcard(terrName(tid), slot, rows);
    });
    const body = `<section class="pane-section m3b-global"><div class="m3b-total"><span><b>${nActive}</b> in training</span><span><b>${finishing}</b> ready next turn</span><span><b>${nQueue}</b> queued</span><span><b>20 Funds · 4k</b> committed</span></div>${cards.join("")}<p class="m3b-small">Each territory with barracks trains one unit at a time; the rest wait in order. Drag to reorder.</p></section>`;
    view({ back: "This turn", title: "Recruitment", meta: "Everything training or queued, by territory", body });
    return { nActive, nQueue };
  }
  function projName(p, lvlFrom = 1) {
    if (p.kind === "building") return W.buildings[p.buildingId].name;
    if (p.kind === "development") return `${W.development[p.developmentId].name} ${lvlFrom} → ${lvlFrom + 1}`;
    return p.kind;
  }
  function projTurns(p) { return p.kind === "building" ? W.buildings[p.buildingId].turns : W.development[p.developmentId]?.upgrade?.turns ?? 3; }
  function globalBuilding() {
    const s = state(), dr = draft();
    const by = {};
    const add = (sub, item) => { const t = W.subs[sub].territoryId; ((by[t] ??= {})[sub] ??= []).push(item); };
    for (const [id, site] of Object.entries(s.subTerritories)) if (site.holder === "republic") site.queue.forEach((q) => add(id, { p: q.project, progress: q.progress }));
    for (const b of dr.builds ?? []) add(b.subTerritoryId, { p: b.project, progress: 0, fresh: true });
    let nA = 0, nQ = 0;
    const lvl = (sub, p) => p.kind === "development" ? (s.subTerritories[sub].development?.[p.developmentId] ?? 1) : 1;
    const terrCards = Object.entries(by).map(([tid, subs]) => {
      const inner = Object.entries(subs).map(([sub, items]) => {
        const [first, ...rest] = items;
        const t = projTurns(first.p);
        const left = t - first.progress;
        nA += 1; nQ += rest.length;
        return `<div class="m3b-q-sub"><p class="m3b-q-subname">${esc(subName(sub))}<span>${items.length} in queue</span></p>${active("chimney", projName(first.p, lvl(sub, first.p)), first.progress, t, first.fresh ? `starts this turn · ${t} turns` : left === 1 ? "1 turn left" : `${left} turns left`)}${rest.map((q, i) => queued(i + 1, projName(q.p, lvl(sub, q.p)), `then ${projTurns(q.p)} turns`)).join("")}</div>`;
      }).join("");
      return `<div class="m3b-q"><div class="m3b-q-head"><b>${esc(terrName(tid))}</b><span>${Object.keys(subs).length} ${Object.keys(subs).length === 1 ? "site" : "sites"}</span></div>${inner}</div>`;
    });
    // A paused queue: Bizkaia's (País Vasco is contested). Illustrative.
    terrCards.push(`<div class="m3b-q" data-paused="true"><div class="m3b-q-head"><b>País Vasco</b><span class="m3b-paused">${ic("pause")}Paused · contested</span></div><div class="m3b-q-sub"><p class="m3b-q-subname">Bizkaia<span>1 in queue</span></p><div class="m3b-q-active">${ic("chimney")}<b>Fortifications</b><span class="m3b-q-left">1 turn left when it resumes</span>${bar(1, 2)}</div><p class="m3b-small">Work stops while the enemy holds part of País Vasco; progress is kept.</p></div></div>`);
    const body = `<section class="pane-section m3b-global"><div class="m3b-total"><span><b>${nA}</b> under way</span><span><b>${nQ}</b> queued</span><span><b>1</b> paused</span><span><b>Madrid</b> finishes next turn</span></div>${terrCards.join("")}</section>`;
    view({ back: "This turn", title: "Building", meta: "Every site with work under way or queued", body });
  }

  // ---------- Funds ledger: one flat list ----------
  function ledger() {
    const res = window.M3P.balance("funds");
    const det = $(".resource-detail.m3-balance");
    const income = res.rows.reduce((a, r) => a + (r.whole ? r.gross : 0), 0);
    const replenish = 3, upkeep = Math.max(0, income - 12 - replenish);
    const rows = res.rows.map((r) => `<tr><td>${esc(r.name)}${r.whole ? "" : ` <small class="muted">${r.held} held</small>`}</td><td class="m3-pos">+${r.gross}</td><td>${r.whole || !r.gross ? "" : `<span class="m3-neg">−${r.gross} <small>contested</small></span>`}</td><td><b>${r.whole ? `+${r.gross}` : "0"}</b></td></tr>`).join("");
    const exp = [["Builds under way", "paid when queued", 0], ["Replenish (Madrid Sierra Columns)", "planned this turn", -replenish], ["Upkeep", "none in this scenario yet", -upkeep]];
    const total = income - replenish - upkeep;
    const chipInc = $$(".resource-chip").find((x) => x.textContent.includes("Funds"))?.querySelector(".resource-income");
    if (chipInc) chipInc.textContent = `+${total}`;
    det.innerHTML = `<p><strong>Funds: 0 now · +${total} next turn</strong></p>
      <table><tbody>${rows}
      <tr class="m3b-rule"><td colspan="4"></td></tr>
      ${exp.map(([n, s, v]) => `<tr><td>${n} <small class="muted">${s}</small></td><td></td><td></td><td><b class="${v < 0 ? "m3-neg" : ""}">${v < 0 ? `−${-v}` : v}</b></td></tr>`).join("")}
      </tbody><tfoot><tr><td>Next turn</td><td></td><td></td><td>+${total}</td></tr></tfoot></table>
      <p>Contested territories pay nothing: the minus shows on their row. This turn's orders spend the 14 you hold.</p>
      <ul aria-label="Other factions" class="resource-others"><li><span>Northern Insurgent Command</span><span class="resource-hidden">hidden</span></li><li><span>Southern Insurgent Command</span><span class="resource-hidden">hidden</span></li></ul>`;
    return { income, total };
  }

  // ---------- Last turn (harvested real report) and the air battle card ----------
  function harvestReport() {
    window.M3P.reportByPlayer();
    H.lastTurn = $('section[aria-labelledby="outcomes-title"]').innerHTML;
  }
  function lastTurn({ air = false, turn = 2 } = {}) {
    const card = air ? `<div class="m3b-battle"><div class="m3b-battle-head"><b>Battle for Andalucía</b><span>Málaga · Southern Insurgents attack</span></div>
      <p class="m3b-step">1 · Air battle</p>
      <div class="m3b-airgrid">
        <div class="m3b-airside"><p class="m3b-who"><span class="m3-swatch" style="--fc:${W.factions.republic.color}"></span>Republic (you)</p><p>No aircraft over Andalucía</p><p>Málaga AA <b>+2</b></p><div class="m3b-roll"><span class="m3b-d20">6</span><span>d20 6 + 2 = <b>8</b></span></div></div>
        <div class="m3b-vs">vs</div>
        <div class="m3b-airside" data-won="true"><p class="m3b-who"><span class="m3-swatch" style="--fc:${W.factions.south.color}"></span>Southern <em>wins the air</em></p><p>Ju 52 Bombers on Ground Support <b>+1</b></p><p>&nbsp;</p><div class="m3b-roll"><span class="m3b-d20">15</span><span>d20 15 + 1 = <b>16</b></span></div></div>
      </div>
      <p class="m3b-result">${ic("plane")}<span>The Ju 52s get through: Ground Support <b>+3 × 1 aircraft = +3</b> on the Southern attack roll. Two aircraft would make it +6, the cap. Had Málaga's AA won, no one would get Ground Support.</span></p>
      <p class="m3b-step">2 · Ground battle</p>
      <div class="m3b-ground"><span>Southern attack roll <b class="m3-neg">+3 air</b> · Vitoria Infantry Regiment No. 8 defends Málaga</span><span>Result below, under Battles.</span></div>
      <p class="m3b-small">Only one side ever gets Ground Support. A tie in the air means neither does.</p></div>` : "";
    view({ back: "This turn", title: "Last turn", meta: `Turn ${turn - 1} · what happened, your faction first`, body: `<section class="pane-section m3b-last">${card}<section aria-labelledby="outcomes-title">${H.lastTurn ?? "<p>No report harvested</p>"}</section></section>` });
  }

  /** Scrolls the pane so `sel` sits just under the sticky odds block. */
  function scrollUnder(sel) {
    const body = $(".map-pane-body"), e = $(sel, body), top = $(".m3b-odds", body);
    if (!e) return;
    body.scrollTop += e.getBoundingClientRect().top - (top ? top.getBoundingClientRect().bottom : body.getBoundingClientRect().top) - 10;
  }
  return { scrollUnder, chrome, view, actionBar, thisTurn, menu, contextMenu, radial, unreachable, hiTerritory, route, roads, invade, reinforce, globalRecruitment, globalBuilding, ledger, harvestReport, lastTurn, cursor, pageAt, counts };
})();
