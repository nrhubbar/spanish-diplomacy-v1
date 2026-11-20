// Milestone 3 UX pass: mock UI injected into the live app (browser side).
// render.mjs loads this with window.__M3 = { provinces, map } and then calls M3.* per capture.
// Throwaway design tooling, not game code. Everything here is example data for one mock world:
// Turn 7, Late October 1936, from the Republic's seat, on top of the real turn-1 positions.
(function () {
  "use strict";
  const DATA = window.__M3;
  const P = DATA.provinces.map((p) => ({ ...p }));
  // Illustrative scenario split: the Oviedo pocket inside Asturias, held by the North (Q-PART-1 splits Asturias in 2).
  {
    const ast = P.find((p) => p.id === "asturias"); ast.capital = false;
    const pts = []; for (let i = 0; i < 9; i += 1) { const a = i / 9 * Math.PI * 2; const r = i % 2 ? 13 : 16; pts.push(`${(-230 + r * Math.cos(a)).toFixed(1)} ${(-375 + r * Math.sin(a)).toFixed(1)}`); }
    P.push({ id: "oviedo", name: "Oviedo", territory: "asturias", holder: "north", capital: true, rail: 2, port: 0, d: "M" + pts.join("L") + "Z", cx: -230, cy: -375, neighbours: ["asturias"] });
    ast.neighbours = ast.neighbours.concat("oviedo");
  }
  const MAP = DATA.map;
  const FC = { republic: "#b1493f", north: "#b39232", south: "#665089" };
  const FNAME = { republic: "Republican Government", north: "Northern Insurgent Command", south: "Southern Insurgent Command" };
  const SVGNS = "http://www.w3.org/2000/svg";
  const ZONE = {
    galicia: "Cantabrian", asturias: "Cantabrian", cantabria: "Cantabrian", "pais-vasco": "Cantabrian",
    "castilla-y-leon": "Meseta", madrid: "Meseta", "castilla-la-mancha": "Meseta", aragon: "Meseta", navarra: "Meseta", "la-rioja": "Meseta",
    catalunya: "Mediterranean", valencia: "Mediterranean", murcia: "Mediterranean", "islas-baleares": "Mediterranean",
    andalucia: "South", extremadura: "South", ceuta: "South", melilla: "South"
  };
  // One d20 roll this turn (9), read against each zone's Late October table.
  const WX = { Cantabrian: "Rain", Meseta: "Clear", Mediterranean: "Clear", South: "Clear" };
  const FORECAST = { Cantabrian: "Rain 45% · Mud 20%", Meseta: "Rain 30% · Clear 55%", Mediterranean: "Clear 60% · Rain 30%", South: "Clear 65% · Rain 25%" };

  // ---------- helpers ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const svg = () => $("svg.map-vector");
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    if (parent) parent.appendChild(n);
    return n;
  }
  function layer(name, after) {
    const old = svg().querySelector("g.m3-" + name); if (old) old.remove();
    const g = el("g", { class: "m3-layer m3-" + name });
    const ref = svg().querySelector(after);
    ref ? ref.after(g) : svg().appendChild(g);
    return g;
  }
  function km2px(x, y) {
    const s = svg(); const pt = s.createSVGPoint(); pt.x = x; pt.y = y;
    const sp = pt.matrixTransform(s.getScreenCTM());
    const r = $(".map-surface").getBoundingClientRect();
    return { x: sp.x - r.left, y: sp.y - r.top };
  }
  function overlay() {
    let o = $(".map-surface > .m3-overlay");
    if (!o) { o = document.createElement("div"); o.className = "m3-overlay"; $(".map-surface").appendChild(o); }
    return o;
  }
  function html(s) { const t = document.createElement("template"); t.innerHTML = s.trim(); return t.content.firstElementChild; }
  const prov = (id) => P.find((p) => p.id === id);
  const inTerr = (t) => P.filter((p) => p.territory === t);
  const territoryD = (t) => { const r = $(`.map-region[data-territory-id="${t}"]`); return r && r.getAttribute("d"); };
  const contested = (t) => new Set(inTerr(t).map((p) => p.holder)).size > 1;
  const TERRS = Array.from(new Set(P.map((p) => p.territory)));
  function defs() {
    if ($("#m3-defs")) return;
    const d = el("defs", { id: "m3-defs" }, svg());
    const pat = el("pattern", { id: "m3-sheen", width: 14, height: 14, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, d);
    el("rect", { width: 1.6, height: 14, fill: "rgb(251 246 234 / 45%)" }, pat);
    const m = el("marker", { id: "m3-arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, d);
    el("path", { d: "M0 0 10 5 0 10z", fill: "#9e2b2b" }, m);
  }
  function addCss(text) { const s = document.createElement("style"); s.textContent = text; document.head.appendChild(s); }

  // ---------- icons ----------
  const ICON = {
    Clear: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.4" fill="#d9a520" stroke="#7a5a06"/><g stroke="#7a5a06" stroke-width="1.4" stroke-linecap="round"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></g></svg>',
    Rain: '<svg viewBox="0 0 16 16"><path d="M4 9.5a3 3 0 0 1 .4-6 4 4 0 0 1 7.5 1.2A2.4 2.4 0 0 1 12 9.5z" fill="#c9d4dc" stroke="#1f3550"/><g stroke="#1f3550" stroke-width="1.4" stroke-linecap="round"><path d="M5 11.5 4 14M8 11.5 7 14M11 11.5l-1 2.5"/></g></svg>',
    Mud: '<svg viewBox="0 0 16 16"><path d="M1 11c2-1.5 4 1 6 0s4-1.5 8 0v3H1z" fill="#7a5a3a"/><path d="M3 8c1.5-1 3 .5 4.5 0" stroke="#7a5a3a" fill="none" stroke-width="1.3"/></svg>',
    Snow: '<svg viewBox="0 0 16 16"><g stroke="#1f3550" stroke-width="1.4" stroke-linecap="round"><path d="M8 1v14M2 4.5l12 7M2 11.5l12-7"/></g></svg>',
    plane: '<svg viewBox="0 0 24 14"><path d="M1 7l8-1.2L12 1h2l-1.6 4.8L20 5l2-2.4h1.4L22.6 7l.8 4.4H22L20 9l-7.6-.8L14 13h-2L9 8.2 1 7z"/></svg>',
    clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3"/><path d="M8 4.3V8l2.6 1.6"/></svg>',
    mountain: '<svg viewBox="0 0 16 16"><path d="M1 14 6 5l3 5 2-3 4 7z" fill="#8a7a66" stroke="#241d18" stroke-width=".8"/></svg>',
    rail: '<svg viewBox="0 0 16 16"><g stroke="#241d18" stroke-width="1.3"><path d="M5 1 3 15M11 1l2 14"/><path d="M4.6 4h6.8M4.2 7.5h7.6M3.8 11h8.4"/></g></svg>',
    truck: '<svg viewBox="0 0 16 16"><path d="M1 4h8v7H1zM9 6.5h3.4L15 9v2H9z" fill="#efe7d4" stroke="#241d18"/><circle cx="4" cy="12" r="1.7" fill="#241d18"/><circle cx="12" cy="12" r="1.7" fill="#241d18"/></svg>'
  };
  // NATO-style unit symbols (600 x 400 frame).
  const SYM = (kind, fill) => {
    const frame = `<path d="M5 5H595V395H5Z" fill="${fill}" stroke="#241d18" stroke-width="18"/>`;
    const k = {
      infantry: '<path d="M595 395 5 5M595 5 5 395" stroke="#000" stroke-width="16"/>',
      militia: '<path d="M595 395 5 5M595 5 5 395" stroke="#000" stroke-width="16"/><text x="300" y="250" font-size="150" text-anchor="middle" font-weight="900" fill="#000">M</text>',
      security: '<path d="M595 395 5 5M595 5 5 395" stroke="#000" stroke-width="16"/><path d="M5 5H595V80H5z" fill="#000"/>',
      colonial: '<path d="M595 395 5 5M595 5 5 395" stroke="#000" stroke-width="16"/><path d="M300 330 220 380h160z" fill="#000"/>',
      artillery: '<circle cx="300" cy="200" r="60" fill="#000"/>',
      cavalry: '<path d="M5 395 595 5" stroke="#000" stroke-width="18"/>',
      tank: '<ellipse cx="300" cy="200" rx="200" ry="95" fill="none" stroke="#000" stroke-width="18"/>',
      truck: '<circle cx="180" cy="300" r="45" fill="none" stroke="#000" stroke-width="16"/><circle cx="420" cy="300" r="45" fill="none" stroke="#000" stroke-width="16"/><path d="M90 230H510" stroke="#000" stroke-width="16"/>',
      aa: '<circle cx="300" cy="230" r="55" fill="#000"/><path d="M110 300Q300 40 490 300" fill="none" stroke="#000" stroke-width="18"/>'
    }[kind];
    return `<svg viewBox="0 0 600 400" preserveAspectRatio="none">${frame}${k}</svg>`;
  };
  const wxChip = (t) => `<span class="m3-wx-chip">${ICON[WX[ZONE[t]]]}${WX[ZONE[t]]}</span>`;

  // ---------- header: date, resources, timer, readiness ----------
  function header(opt) {
    const k = $(".screen-kicker"); if (k) k.textContent = "Turn 7 · Late October 1936 · " + (/revealed/i.test(k.textContent) ? "Orders revealed" : "Planning");
    const chips = $$(".status-chips li");
    const notes = ["planning", "ready", "ready"];
    chips.forEach((li, i) => { li.dataset.ready = i > 0 ? "true" : "false"; const n = document.createElement("span"); n.className = "m3-ready-note"; n.textContent = notes[i]; li.appendChild(n); });
    const strip = html(`<div class="m3-header-strip"></div>`);
    strip.appendChild(html(`<span class="m3-timer" title="Time left this turn">${ICON.clock}4:12</span>`));
    if (opt !== "b") {
      strip.appendChild(html(`<span class="m3-res" title="Funds: balance, and income next turn">Funds <span>42</span><span class="gain">+31</span></span>`));
      strip.appendChild(html(`<span class="m3-res" title="Manpower in thousands of men">Manpower <span>18k</span><span class="gain">+9k</span></span>`));
    }
    if (window.innerWidth < 700) { $(".game-header-title").appendChild(strip); strip.style.marginTop = "0.35rem"; }
    else { const act = $(".game-header-actions"); act.style.display = "flex"; act.style.gap = "0.5rem"; act.style.alignItems = "center"; act.prepend(strip); addCss(".status-chips .chip-name{display:none!important}.status-chips .chip-abbreviation{display:inline!important}"); }
  }
  function ledgerInPane() {
    return `<div class="m3-income" aria-label="Your treasury"><div>Funds<strong>42 <small style="color:var(--success)">+31 next turn</small></strong></div><div>Manpower<strong>18k <small style="color:var(--success)">+9k next turn</small></strong></div></div>`;
  }

  // ---------- sub-territories on the map ----------
  function subterr(opt, zoomedTerritory) {
    defs();
    const g = layer("prov", "g.map-geometry");
    const borders = layer("prov-borders", "g.map-borders");
    const labels = layer("prov-labels", "g.map-territory-labels");
    const css = [];
    for (const t of TERRS) {
      const isC = contested(t);
      const showFill = opt === "a" ? isC : opt === "b" ? isC : opt === "c" ? (zoomedTerritory === t && isC) : false;
      if (showFill) css.push(`.map-region[data-territory-id="${t}"]{fill:transparent!important}`);
      for (const p of inTerr(t)) {
        if (showFill) el("path", { d: p.d, class: "m3-prov m3-prov-fill", fill: FC[p.holder] }, g);
        const showBorder = opt === "b" || (opt === "a" && isC) || (opt === "c" && zoomedTerritory === t);
        if (showBorder && inTerr(t).length > 1) el("path", { d: p.d, class: "m3-prov-border" + (opt === "b" && !isC ? " faint" : "") }, borders);
        if ((opt === "a" && isC) || (opt === "c" && zoomedTerritory === t) || (opt === "b" && isC)) {
          const lb = el("text", { x: p.cx, y: p.cy + 4, class: "m3-prov-label" }, labels); lb.textContent = p.name;
          lb.setAttribute("font-size", "11");
        }
        if (p.capital && (showBorder || opt === "a" && isC)) {
          el("path", { d: star(p.cx, p.cy - 13, 6.5, 2.8), class: "m3-cap" }, labels);
        }
      }
      if (showFill && opt !== "c") { const d = territoryD(t); if (d) el("path", { d, class: "m3-contested-sheen" }, g); }
    }
    if (opt === "c") {
      // Keep the hatch; draw the front between holders inside contested territories, and a split bar.
      const front = layer("front", "g.map-borders");
      for (const t of TERRS) if (contested(t)) frontLine(t, front, t === zoomedTerritory);
      for (const t of TERRS) if (contested(t)) splitBar(t);
    }
    addCss(css.join("\n"));
  }
  function star(cx, cy, R, r) {
    let d = ""; for (let i = 0; i < 10; i += 1) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r : R; d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1); }
    return d + "Z";
  }
  let clipN = 0;
  function frontLine(t, g) {
    // The front is where provinces of different holders meet: stroke one holder's provinces and
    // clip the stroke to the other holder's provinces, so only the shared border shows.
    const ps = inTerr(t); const holders = Array.from(new Set(ps.map((p) => p.holder)));
    const d = $("#m3-defs");
    for (let i = 1; i < holders.length; i += 1) {
      const id = "m3-clip-" + (clipN += 1);
      const cp = el("clipPath", { id, clipPathUnits: "userSpaceOnUse" }, d);
      for (const p of ps.filter((q) => q.holder === holders[i])) el("path", { d: p.d }, cp);
      const gg = el("g", { "clip-path": `url(#${id})` }, g);
      for (const p of ps.filter((q) => q.holder !== holders[i])) {
        el("path", { d: p.d, class: "m3-front-halo", "stroke-width": 11 }, gg);
        el("path", { d: p.d, class: "m3-front", "stroke-width": 6 }, gg);
      }
    }
  }
  function splitBar(t) {
    const a = MAP.territories[t]; if (!a) return;
    const ps = inTerr(t); const n = ps.length;
    const pt = km2px(a.label.x, a.label.y + 16);
    const bar = html(`<span class="m3-pin m3-split" title="Sub-territories held"></span>`);
    for (const f of ["republic", "north", "south"]) { const c = ps.filter((p) => p.holder === f).length; if (c) bar.appendChild(html(`<i style="flex:${c};background:${FC[f]}"></i>`)); }
    bar.style.left = pt.x + "px"; bar.style.top = pt.y + "px";
    overlay().appendChild(bar);
  }
  function focusSub(id) {
    const p = prov(id); const g = layer("focus", "g.map-highlights");
    el("path", { d: p.d, class: "m3-focus-ring" }, g);
  }

  // ---------- rail ----------
  function curve(a, b, bend) {
    const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2; const dx = b.cx - a.cx, dy = b.cy - a.cy;
    const k = bend == null ? 0.12 : bend;
    return `M${a.cx} ${a.cy}Q${(mx - dy * k).toFixed(1)} ${(my + dx * k).toFixed(1)} ${b.cx} ${b.cy}`;
  }
  function rail(opt, reachFrom) {
    const g = layer("rail", "g.map-rivers");
    const W = { 1: 1.1, 2: 1.8, 3: 2.6 };
    const pairs = [];
    for (const a of P) for (const nId of a.neighbours) { const b = prov(nId); if (!b || a.id > b.id || !a.rail || !b.rail) continue; pairs.push([a, b, Math.min(a.rail, b.rail)]); }
    let reach = null;
    if (opt === "c") {
      // Shown on demand: the network the selected army can ride (own-held rail sub-territories).
      reach = new Set([reachFrom]); const q = [reachFrom];
      while (q.length) { const c = prov(q.shift()); for (const n of c.neighbours) { const b = prov(n); if (b && b.rail && b.holder === "republic" && !reach.has(n)) { reach.add(n); q.push(n); } } }
    }
    for (const [a, b, lvl] of pairs) {
      if (opt === "b" && lvl < 2) continue;
      if (opt === "c" && !(reach.has(a.id) && reach.has(b.id))) continue;
      const d = curve(a, b);
      el("path", { d, class: "m3-rail-case", "stroke-width": W[lvl] + 2.2 }, g);
      el("path", { d, class: "m3-rail" + (opt === "c" ? " reach" : ""), "stroke-width": W[lvl] }, g);
      if (lvl >= 2) el("path", { d, class: "m3-rail ties", "stroke-width": W[lvl] + 3.5 }, g);
    }
    for (const p of P) {
      if (!p.rail) continue;
      if (opt === "b" && p.rail < 2) continue;
      if (opt === "c" && !reach.has(p.id)) continue;
      el("rect", { x: p.cx - 2.6 - p.rail, y: p.cy - 2.6 - p.rail, width: 5.2 + 2 * p.rail, height: 5.2 + 2 * p.rail, rx: 1, class: "m3-station" + (opt === "c" ? " reach" : "") }, g);
    }
  }

  // ---------- pane ----------
  function readArmies() {
    return $$(".formation-list li").map((li) => ({
      name: $(".formation-name", li).textContent, meta: $(".formation-meta", li).textContent.split(" · ")[0],
      values: $(".army-line-values strong", li).textContent, men: $(".army-line-strength", li).textContent.trim(),
      share: ($(".army-line-strength", li).getAttribute("style") || "").match(/[\d.]+/)?.[0] || "1"
    }));
  }
  function unitRow(u, extra, selected) {
    return `<li><button aria-pressed="${selected ? "true" : "false"}" class="formation-button" data-ordered="false" type="button"><span aria-hidden="true" class="formation-check"></span><span class="formation-name">${u.name}</span><span class="formation-meta">${u.meta}${u.order ? " · " + u.order : ""}</span>${extra ? `<span class="m3-meta-row" style="grid-column:2">${extra}</span>` : ""}<span class="army-line"><span aria-hidden="true" class="army-line-values"><strong>${u.values}</strong></span><span aria-hidden="true" class="army-line-strength" style="--strength-share: ${u.share};"><span class="army-line-bar"></span>${u.men}</span></span></button></li>`;
  }
  const pips = (n, of) => `<span class="m3-pips">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
  const CAT = {
    barcelona: { dev: { Industry: 3, Farms: 1, Mines: 0 }, rail: 3, port: 2, buildings: ["Barracks", "Depot", "Hospital", "Airfield"], queue: [["Factory", 0.5, "2 turns left", "build"], ["Rail yard", 0, "queued · 14 Funds", "queued"]] },
    tarragona: { dev: { Industry: 1, Farms: 2, Mines: 0 }, rail: 2, port: 1, buildings: [], queue: [["Farms 3", 0.33, "2 of 3 turns left", "build"]] },
    lleida: { dev: { Industry: 0, Farms: 3, Mines: 0 }, rail: 2, port: 0, buildings: ["Fortifications"], queue: [] },
    girona: { dev: { Industry: 1, Farms: 2, Mines: 1 }, rail: 2, port: 0, buildings: [], queue: [] }
  };
  const INCOME = { barcelona: "+6 Funds · +1k", tarragona: "+2 Funds · +1k", lleida: "+1 Funds · +1k", girona: "+2 Funds · +1k" };
  function subCard(id, opts) {
    const p = prov(id); const s = CAT[id]; const o = opts || {};
    const dev = Object.entries(s.dev).filter(([k]) => !(k === "Industry" && !p.capital && s.dev[k] === 0)).map(([k, v]) => `<span>${k} ${pips(v, 3)}</span>`).join("");
    const q = s.queue.map(([n, f, t, st]) => `<div class="m3-q" data-state="${o.paused ? "paused" : st}"><span>${st === "queued" ? "Next: " : ""}<b>${n}</b></span><span class="t">${o.paused ? "paused · contested" : t}</span><span class="bar"><i style="width:${f * 100}%"></i></span></div>`).join("");
    return `<li class="m3-sub" data-capital="${p.capital}" ${o.paused ? 'data-paused="true"' : ""}><div class="m3-sub-head"><span class="m3-sub-name">${p.capital ? '<span class="star">★</span>' : ""}${p.name}</span><span class="m3-sub-holder" style="--fc:${FC[p.holder]}">${INCOME[id] || ""}</span></div>
      <div class="m3-dev">${dev}<span>Rail ${pips(s.rail, 3)}</span>${s.port ? `<span>Port ${pips(s.port, 2)}</span>` : ""}</div>
      ${s.buildings.length ? `<div class="m3-dev"><span>${s.buildings.join(" · ")}</span></div>` : ""}
      ${q ? `<div class="m3-queue">${q}</div>` : ""}
      ${o.buttons === false ? "" : `<div class="m3-btn-row"><button class="m3-mini" type="button">Build</button>${p.capital ? '<button class="m3-mini" type="button">Recruit</button>' : ""}</div>`}</li>`;
  }
  function territoryHead(t, name, opts) {
    const o = opts || {};
    return `<h3>${name}</h3><p class="pane-meta">Held whole by Republican Government · ${o.subs || "4 sub-territories"}</p>
      <div class="m3-meta-row">${wxChip(t)}<span class="m3-pill" title="${ZONE[t]} zone forecast for Early November">Next: ${FORECAST[ZONE[t]]}</span></div>
      <div class="m3-meta-row"><span class="m3-pill good">Pays +11 Funds · +4k men a turn</span><span class="m3-pill">Recruits at Barcelona</span></div>`;
  }
  const GEN = '<span class="m3-pill gen" title="Gen. Llano de la Encomienda · Cautious: −1 when attacking · can rally">Llano de la Encomienda</span>';
  function armiesBlock(armies, opts) {
    const o = opts || {};
    const rows = armies.map((u, i) => unitRow({ ...u, order: i === 2 ? "Resting" : "Entrenching" }, i === 0 ? GEN : i === 1 ? '<span class="m3-pill warn">Fatigue 1</span>' : i === 2 ? '<span class="m3-pill bad">Demoralized</span>' : "", o.selected !== false)).join("");
    const training = `<li><div class="formation-button" style="border-style:dashed;background:rgb(255 255 255 / 30%)"><span class="formation-check" style="border-style:dashed;background:transparent"></span><span class="formation-name">2nd Catalan Infantry Regiment</span><span class="formation-meta">Infantry regiment · in training at Barcelona · ready Early November</span></div></li>`;
    return `<div class="army-picker"><div class="army-picker-header"><h4>Your units</h4><span class="selection-count">${o.selected === false ? "0" : armies.length} of ${armies.length} selected</span></div><ul class="formation-list">${rows}${training}</ul>
      <div class="selection-tools"><button class="text-button" type="button">Select all</button><button class="text-button" type="button">Clear</button></div>
      <div class="order-command"><button class="order-button" type="button"><span>Give Selected Units Order</span></button></div></div>`;
  }
  function recruitBlock(opt, hover) {
    const fill = FC.republic;
    const types = [
      ["Militia column", "militia", "3-4", "6 Funds · 3k men · 1 turn", null],
      ["Infantry regiment", "infantry", "4-6", "12 Funds · 2k men · 2 turns", null],
      ["Security forces", "security", "3-5", "10 Funds · 2k men · 2 turns", null],
      ["Cavalry", "cavalry", "4-4", "14 Funds · 1k men · 2 turns", null],
      ["Artillery group", "artillery", "2-3", "18 Funds · 1k men · 3 turns", "Needs a Factory in Barcelona (being built: 2 turns left)"],
      ["Truck park", "truck", "–", "10 Funds · 0.5k men · 2 turns", "Needs a Factory (being built) and a Depot"],
      ["Tanks", "tank", "6-4", "30 Funds · 0.5k men · 4 turns", "Needs a Factory (being built) and a Depot"],
      ["Anti-air battery", "aa", "–", "16 Funds · 0.5k men · 2 turns", "Needs a Factory (being built)"],
      ["Colonial veterans", "colonial", "6-5", "", "Not available to the Republic"]
    ];
    const basket = `<div class="m3-basket">This turn: <strong>1 × Infantry regiment</strong> — 12 Funds, 2k men. Left after: <strong>30 Funds · 16k men</strong>. Ready Early November.</div>`;
    if (opt === "b") {
      return `<div class="m3-rec-grid">${types.map(([n, k, v, c, why]) => `<div class="m3-card" data-off="${!!why}" ${hover === k ? 'data-hover="true"' : ""}><span class="sym">${SYM(k, fill)}</span><span class="nm">${n}</span><span class="cost">${why ? "Locked" : c.split(" · ").slice(0, 2).join(" · ")}</span></div>`).join("")}</div>${basket}`;
    }
    return `<ul class="m3-recruit-list">${types.map(([n, k, v, c, why]) => `<li class="m3-rec" data-off="${!!why}" ${hover === k ? 'data-hover="true"' : ""}><span class="sym">${SYM(k, fill)}</span><span class="nm">${n}</span><span class="qty">${why ? `<span class="vals">${v}</span>` : `<span class="vals" style="margin-right:.4rem">${v}</span><button type="button">−</button><span>${k === "infantry" ? 1 : 0}</span><button type="button">+</button>`}</span>${why ? `<span class="why">🔒 ${why}</span>` : `<span class="cost">${c}</span>`}</li>`).join("")}</ul>${basket}`;
  }
  function recruitTooltip(kind, text) {
    const row = $(`.m3-rec[data-hover="true"], .m3-card[data-hover="true"]`); if (!row) return;
    const r = row.getBoundingClientRect();
    const t = html(`<div class="m3-tooltip" style="position:fixed;left:${Math.max(8, r.left - 250)}px;top:${r.top - 6}px;width:15rem"><b>${text[0]}</b>${text[1]}<div class="muted" style="margin-top:.3rem">${text[2]}</div></div>`);
    t.style.setProperty("--x", "0");
    document.body.appendChild(t);
    t.classList.add("side");
    addCss(`.m3-tooltip.side::after{left:auto;right:-6px;top:14px;bottom:auto;transform:rotate(-45deg)}`);
  }
  function setPane(innerHtml, title) {
    const body = $(".map-pane-body"); body.innerHTML = innerHtml;
    if (title) $(".map-pane-title").textContent = title;
  }
  function paneTerritory(opt, armies, sub) {
    const t = "catalunya", name = "Cataluña";
    const head = territoryHead(t, name);
    const subs = ["barcelona", "tarragona", "lleida", "girona"].map((id) => subCard(id, { buttons: opt === "c" })).join("");
    if (opt === "a") {
      const tab = sub || "units";
      const tabs = `<div class="m3-tabs" role="tablist"><button class="m3-tab" role="tab" aria-selected="${tab === "units"}">Units<span class="count">3</span></button><button class="m3-tab" role="tab" aria-selected="${tab === "build"}">Build<span class="count">2</span></button><button class="m3-tab" role="tab" aria-selected="${tab === "recruit"}">Recruit</button></div>`;
      const body = tab === "units" ? armiesBlock(armies) : tab === "build" ? `<div class="m3-section-head" style="margin-top:.6rem"><h4>Sub-territories</h4><span class="note">Click one on the map to focus it</span></div><ul class="m3-sub-list">${["barcelona", "tarragona", "lleida", "girona"].map((id) => subCard(id, {})).join("")}</ul>` : `<div class="m3-section-head" style="margin-top:.6rem"><h4>Recruit at Barcelona</h4><span class="note">Barracks · Depot</span></div>${recruitBlock(DATA.recruitOpt || "a", DATA.recruitHover)}`;
      setPane(`<section class="pane-section">${head}${tabs}${body}</section>`);
    } else if (opt === "b") {
      setPane(`<section class="pane-section">${head}</section>
        <details class="m3-acc" open><summary>Units<span class="note">3 here · 1 in training</span></summary>${armiesBlock(armies)}</details>
        <details class="m3-acc" open><summary>Sub-territories<span class="note">2 builds under way</span></summary><ul class="m3-sub-list">${["barcelona", "tarragona", "lleida", "girona"].map((id) => subCard(id, { buttons: false })).join("")}</ul></details>
        <details class="m3-acc"><summary>Recruit at Barcelona<span class="note">4 of 9 types available</span></summary></details>`);
    } else {
      setPane(`<section class="pane-section">${head}</section>
        <section class="pane-section"><div class="m3-section-head"><h4 style="margin:0">Sub-territories</h4><span class="note">Build and recruit from each card</span></div><ul class="m3-sub-list">${subs}</ul></section>
        <section class="pane-section">${armiesBlock(armies, { selected: false })}</section>`);
    }
  }
  function paneSubFocus() {
    const head = `<button class="m3-back" type="button">← Cataluña</button><h3>★ Barcelona</h3><p class="pane-meta">Capital sub-territory of Cataluña · held by Republican Government</p><div class="m3-meta-row">${wxChip("catalunya")}<span class="m3-pill">Pays +6 Funds · +1k men</span><span class="m3-pill">Coast · port 2</span></div>`;
    const card = `<ul class="m3-sub-list">${subCard("barcelona", { buttons: false })}</ul>`;
    const options = [["Industry 3 → 4", "max level is 3", true], ["Farms 1 → 2", "8 Funds · 2 turns · +1k men a turn", false], ["Port 2 → 3", "max level is 2", true], ["Fortifications", "10 Funds · 2 turns · +1 defence", false], ["Hospital", "built", true], ["Airfield → paved", "12 Funds · 2 turns · flies in Mud and Snow", false]];
    const list = `<div class="m3-section-head" style="margin-top:.7rem"><h4 style="margin:0">Add to the queue</h4><span class="note">Paid when queued</span></div><ul class="m3-recruit-list">${options.map(([n, c, off]) => `<li class="m3-rec" data-off="${off}" style="grid-template-columns:1fr auto"><span class="nm">${n}</span><span class="qty">${off ? "" : '<button class="m3-mini" type="button">Queue</button>'}</span><span class="${off ? "why" : "cost"}" style="grid-column:1/-1">${c}</span></li>`).join("")}</ul>`;
    setPane(`<section class="pane-section">${head}${card}${list}</section>`);
  }

  // ---------- move targets ----------
  function moveTargets(opt) {
    // Real destination rows are CyL (attack) and CLM (reinforce). Add rail-reached rows and new detail.
    const list = $(".destination-list"); if (!list) return;
    const items = $$(".destination-list li", list);
    const cyl = items.find((li) => li.textContent.includes("Castilla y León"));
    const clm = items.find((li) => li.textContent.includes("Castilla-La Mancha"));
    const allow = (on, lost) => `<span class="m3-allow" title="Moves left this turn">${Array.from({ length: 2 }, (_, i) => `<i class="${i < on ? "on" : i < on + lost ? "lost" : ""}"></i>`).join("")}</span>`;
    if (opt === "a") {
      if (cyl) $("button", cyl).insertAdjacentHTML("beforeend", `<span class="m3-dest-extra">${wxChip("castilla-y-leon")}<span class="m3-pill warn">${ICON.mountain}Mountain entry (Ávila) · last move</span><span class="m3-pill">Fatigued −2 on 1 unit</span></span>`);
      if (clm) $("button", clm).insertAdjacentHTML("beforeend", `<span class="m3-dest-extra">${wxChip("castilla-la-mancha")}<span class="m3-pill">1 move left after</span></span>`);
    } else {
      if (cyl) {
        $("button", cyl).style.borderWidth = "1.5px"; $("button", cyl).style.borderColor = "var(--ink)"; $("button", cyl).style.background = "#fff";
        cyl.insertAdjacentHTML("beforeend", `<div class="m3-detail-card"><h5>Attack Castilla y León</h5><dl class="m3-mods"><dt>Odds (attack 14 v defence 22)</dt><dd>1:2</dd><dt>Below 1:1 (1 halving)</dt><dd>−3</dd><dt>Fatigued (Madrid Sierra Columns)</dt><dd>−2</dd><dt>Gen. Miaja +1, Cautious −1</dt><dd>0</dd><dt>Weather · Meseta ${ICON.Clear.replace("<svg", '<svg width="12" height="12"')} Clear</dt><dd>0</dd><dt class="total">Chance to take ground</dt><dd class="total">0% · 8% gives ground</dd></dl><p class="pane-meta" style="font-size:.78rem">Enters at Ávila (mountain): uses the rest of this turn's moves. Next turn ${FORECAST.Meseta}.</p></div>`);
      }
      if (clm) $("button", clm).insertAdjacentHTML("beforeend", `<span class="m3-dest-extra">${wxChip("castilla-la-mancha")}<span class="m3-pill">Reinforce · 1 move left</span></span>`);
    }
    // Extra rows reached by rail.
    const tpl = (name, chip, detail, extra) => `<li><button class="destination-button" type="button"><span class="destination-name">${name}</span>${chip}<span class="destination-detail">${detail}</span>${extra ? `<span class="m3-dest-extra">${extra}</span>` : ""}</button></li>`;
    list.insertAdjacentHTML("beforeend",
      tpl("Valencia", `<span class="odds-chip" data-tone="safe">By rail · Reinforce</span>`, "Rail from Madrid, level 2 the whole way (range 4) · uses 1 of Madrid's 3 boarding places", opt === "a" ? `${wxChip("valencia")}<span class="m3-pill">${ICON.rail}Rail</span>` : "") +
      tpl("Aragón", `<span class="odds-chip" data-tone="even">Rail, then attack · Approx. 1:1 · 38%</span>`, "Rail to Guadalajara, then attack Teruel (level 1 line) · Teruel is the last move", opt === "a" ? `${wxChip("aragon")}<span class="m3-pill">${ICON.rail}Rail + 1</span>` : ""));
    // "Army forming" summary above the destinations.
    const choices = $(".destination-choices") || list.parentElement;
    choices.insertAdjacentHTML("afterbegin", `<div class="m3-army-forming"><b>Army leaving Madrid</b> · 4 units, 14 attack ${allow(1, 0)}<br><span class="pane-meta" style="font-size:.76rem">1 move this turn: no trucks (2 trucks for these 4 units would give +1). Rail does not use moves.</span></div>`);
    // Map: weather glyph on odds chips, plus chips for the rail destinations.
    $$(".odds-layer .odds-chip").forEach((c) => { c.insertAdjacentHTML("beforeend", `<span class="m3-wx-inline">${ICON.Clear}</span>`); });
    const add = (t, text, tone) => { const a = MAP.territories[t].unitAnchor; const pt = km2px(a.x, a.y - 26); const c = html(`<span class="odds-chip m3-pin" data-tone="${tone}" style="position:absolute;height:21px;box-shadow:0 1px 4px rgb(0 0 0 / 45%)">${text}<span class="m3-wx-inline">${ICON.Clear}</span></span>`); c.style.left = pt.x + "px"; c.style.top = pt.y + "px"; overlay().appendChild(c); };
    add("valencia", "By rail · Reinforce", "safe"); add("aragon", "Rail + attack · ≈1:1 · 38%", "even");
    const g = layer("routes-mock", "g.map-routes");
    el("path", { d: curve(prov("madrid"), prov("valencia"), 0.1), class: "m3-route-rail" }, g);
    el("path", { d: curve(prov("madrid"), prov("guadalajara"), 0.2) + curve(prov("guadalajara"), prov("teruel"), 0.1).replace(/^M[^Q]+/, ""), class: "m3-route-rail" }, g);
  }

  // ---------- battle report ----------
  const GRADE = [
    ["Attacker destroyed", "#7a1f1a"], ["Attacker routed", "#9e3a2e"], ["Attacker repulsed", "#b5483c"], ["Attack checked", "#d08a6c"],
    ["Bloody stalemate", "#a99b84"], ["Stalemate", "#cbbf9f"], ["Gives ground (1)", "#9fb3c4"], ["Pushed back (2)", "#7d9bb5"],
    ["Costly victory", "#5f86a8"], ["Driven out", "#3f6a90"], ["Defender routed", "#2f5578"], ["Defender broken", "#244666"], ["Defender destroyed", "#1f3550"]
  ];
  // 5:1 column: which grade each modified score 1..20 gives (illustrative).
  const COL5 = [6, 7, 7, 8, 8, 9, 9, 9, 10, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 13];
  function battle(opt) {
    const card = $(".battle-card"); if (!card) return;
    card.dataset.result = "m3";
    const attacker = $(".battle-side-faction", card)?.textContent || "The attacker";
    const defender = $$(".battle-side-faction", card)[1]?.textContent || "";
    const place = ($(".battle-kicker", card)?.textContent || "").replace(/^Battle for /, "");
    const odds = $(".battle-odds-label", card)?.textContent || "5:1";
    const rep = /Republican/.test(defender);
    const score = 12 - (rep ? 3 : 0) - 1 + 3;
    const grade = GRADE[COL5[score - 1] - 1][0];
    $(".battle-title", card).textContent = grade;
    $(".battle-occupation", card).textContent = `The ${attacker} took ${place}. The defenders lost 20% of their men and half were demoralized; they fell back.`;
    const roll = $(".battle-roll", card);
    const mods = `<div class="m3-d20-roll"><span class="m3-die">12</span><span>d20 <b>12</b>${rep ? " · Popular resistance −3" : ""} · Barricades (city held) −1 · Artillery +3 = <b>${score}</b></span></div>`;
    let body;
    if (opt === "a") {
      body = `<div class="m3-d20"><p class="battle-odds"><span class="battle-odds-label">${odds}</span> odds · that column of the d20 table (illustrative)</p>${mods}<div class="m3-d20-strip">${COL5.map((g, i) => `<span style="background:${GRADE[g - 1][1]}" ${i + 1 === score ? 'data-hit="true"' : ""}>${i + 1}</span>`).join("")}</div>
        <div class="m3-d20-legend">${Array.from(new Set(COL5)).map((g) => `<span><i style="background:${GRADE[g - 1][1]}"></i>${GRADE[g - 1][0]}</span>`).join("")}</div></div>`;
    } else {
      const bands = []; let start = 1;
      for (let i = 1; i <= 20; i += 1) if (i === 20 || COL5[i] !== COL5[i - 1]) { bands.push([start, i, COL5[i - 1]]); start = i + 1; }
      const eff = { 6: "both lose 10%", 7: "1 sub-territory changes hands", 8: "2 sub-territories", 9: "takes all · both lose 35%", 10: "takes all · defender −20%, half demoralized", 11: "takes all · defender −35%, all demoralized", 12: "takes all · weakest defender destroyed", 13: "takes all · defenders destroyed" };
      body = `<div class="m3-d20"><p class="battle-odds"><span class="battle-odds-label">${odds}</span> odds · what this column could roll (illustrative)</p>${mods}<ul class="m3-bands">${bands.map(([a, b, g]) => `<li style="--c:${GRADE[g - 1][1]}" ${score >= a && score <= b ? 'data-hit="true"' : ""}><span class="rng">${a === b ? a : a + "–" + b}</span><span>${GRADE[g - 1][0]}</span><span class="eff">${eff[g] || ""}</span></li>`).join("")}</ul></div>`;
    }
    roll.innerHTML = body;
    let sib = roll.nextElementSibling; while (sib) { sib.style.display = "none"; sib = sib.nextElementSibling; }
    roll.insertAdjacentHTML("afterend", `<p class="pane-meta" style="font-size:.82rem">● Defenders lost 20% of their men; half were demoralized; they fell back through their own sub-territories.<br>● Attackers lost 10% of their men.</p>`);
    const b = $(".map-pane-body"); const d = $(".m3-d20", card); if (b && d) b.scrollTop += d.getBoundingClientRect().top - b.getBoundingClientRect().top - 120;
  }
  function battleIconTooltip() {
    const m = $(".map-outcome-battle"); if (!m) return;
    const r = m.getBoundingClientRect(); const s = $(".map-surface").getBoundingClientRect();
    const res = (m.getAttribute("data-battle-result") || "").replace(/-/g, " ");
    const label = res.charAt(0).toUpperCase() + res.slice(1);
    const t = html(`<div class="m3-tooltip"><b>${label}</b>The battle's result, from the attacker's side.<div class="muted">Click to open its battle card</div></div>`);
    overlay().appendChild(t);
    t.style.left = (r.left - s.left - 12) + "px"; t.style.top = (r.top - s.top - t.offsetHeight - 10) + "px";
    m.style.filter = "drop-shadow(0 0 4px #f2c84b)";
  }

  // ---------- air ----------
  function aircraft(opt) {
    const o = overlay();
    const counters = [
      ["madrid", -95, -96, "republic", "BOMB", "Escuadrilla España · Potez 54 bombers", true],
      ["madrid", -128, -92, "republic", "FTR", "Dewoitine D.372 fighters", false],
      ["barcelona", 395, -168, "republic", "RCN", "Breguet 19 recon", false],
      ["sevilla", -262, 268, "south", "BOMB", "Ju 52 bombers (Tablada)", false],
      ["sevilla", -228, 268, "south", "FTR", "Fiat CR.32 fighters", false]
    ];
    for (const [, x, y, f, lab, title, sel] of counters) {
      const pt = km2px(x, y);
      const c = html(`<span class="m3-pin m3-air" style="--fc:${FC[f]}" title="${title}" data-selected="${sel && opt === "a"}">${ICON.plane}</span>`);
      c.style.left = pt.x + "px"; c.style.top = pt.y + "px"; c.insertAdjacentHTML("beforeend", `<span style="position:absolute;bottom:-12px;font:800 8px var(--sans);color:var(--ink);background:var(--paper);padding:0 2px;border-radius:2px">${lab}</span>`);
      o.appendChild(c);
    }
    const g = layer("air", "g.map-routes");
    const m = prov("madrid"), sv = prov("sevilla");
    if (opt === "a") el("circle", { cx: m.cx, cy: m.cy, r: 330, class: "m3-range" }, g);
    el("path", { d: `M${m.cx} ${m.cy}Q${(m.cx + sv.cx) / 2 + 40} ${(m.cy + sv.cy) / 2} ${sv.cx + 10} ${sv.cy - 18}`, class: "m3-raid" }, g);
    if (opt === "b") el("path", { d: `M${m.cx - 20} ${m.cy}Q${m.cx - 60} ${m.cy + 60} ${prov("toledo").cx} ${prov("toledo").cy}`, class: "m3-raid", style: "stroke:var(--route)" }, g);
    focusSub("sevilla");
  }
  function paneAir(opt) {
    const missions = (sel) => `<div class="m3-btn-row">${["Raid", "Intercept", "Support", "Recon", "Stand down"].map((m) => `<button class="m3-mini${m === sel ? " primary" : ""}" type="button">${m}</button>`).join("")}</div>`;
    const odds = `<dl class="m3-mods"><dt>Target: Sevilla (Tablada airfield, Industry 2)</dt><dd>range 3 of 3</dd><dt>Anti-air in Sevilla</dt><dd>−3</dd><dt>Enemy fighters in range (Fiat CR.32)</dt><dd>may intercept</dd><dt>Weather · South ☀ Clear</dt><dd>flies</dd></dl>
      <div class="m3-d20-legend" style="margin-top:.35rem"><span><i style="background:#7a1f1a"></i>Air eliminated 15%</span><span><i style="background:#cbbf9f"></i>Nothing hit 40%</span><span><i style="background:#7d9bb5"></i>Income cut 1 turn 30%</span><span><i style="background:#1f3550"></i>Building hit 15%</span></div>`;
    if (opt === "a") {
      setPane(`<section class="pane-section"><h3>Escuadrilla España</h3><p class="pane-meta">Bomber · Potez 54 · based at Madrid (Getafe airfield, paved) · range 3 territories</p><div class="m3-meta-row">${wxChip("madrid")}<span class="m3-pill">1 mission a turn</span></div>
        <h4>Mission</h4>${missions("Raid")}<div class="m3-detail-card"><h5>Raid Sevilla</h5>${odds}</div></section>
        <section class="pane-section"><h3 style="font-size:.95rem">Other aircraft at Madrid</h3><p class="pane-meta">Dewoitine D.372 fighters · Intercept over Madrid</p></section>`, "Air");
    } else {
      const row = (n, meta, sel, extra) => `<li class="m3-sub"><div class="m3-sub-head"><span class="m3-sub-name">${n}</span><span class="m3-sub-holder" style="--fc:${FC.republic}">${meta}</span></div>${missions(sel)}${extra || ""}</li>`;
      setPane(`<section class="pane-section"><h3>Air</h3><p class="pane-meta">3 aircraft · each flies one mission a turn · none grounded (Mud or Snow grounds unpaved airfields)</p>
        <ul class="m3-sub-list">${row("Escuadrilla España", "Bomber · Madrid", "Raid", `<p class="pane-meta" style="font-size:.78rem;margin:0">→ Sevilla · 15% lost · 45% hits something</p>`)}${row("Dewoitine D.372", "Fighter · Madrid", "Support", `<p class="pane-meta" style="font-size:.78rem;margin:0">→ Battle for Toledo: +2 if it happens</p>`)}${row("Breguet 19", "Recon · Barcelona", "Recon", `<p class="pane-meta" style="font-size:.78rem;margin:0">→ Aragón: shows balances, queues and training next turn</p>`)}</ul></section>`, "Orders");
    }
  }

  // ---------- setup ----------
  function setupTimer() {
    const anchor = $(".scenario-picker"); if (!anchor) return;
    anchor.insertAdjacentHTML("afterend", `<div class="m3-setup-field"><label>Turn timer</label><div class="m3-seg" role="radiogroup"><span aria-checked="false">Off</span><span aria-checked="false">1 min</span><span aria-checked="true">5 min</span><span aria-checked="false">10 min</span><span aria-disabled="true">30 min · online</span><span aria-disabled="true">1 h · online</span></div><p class="hint">Each player's clock runs only on their own planning screen. Turn 1 gets double time. When time runs out, the orders you planned go in and every other unit holds.</p></div>`);
  }

  function menu(items) {
    return `<div class="m3-menu" role="menu">${items.map(([n, d, st]) => `<div class="m3-menu-item" data-state="${st || ""}" role="menuitem"><b>${n}</b><span>${d}</span></div>`).join("")}</div>`;
  }
  function paneContested(armies) {
    const u = armies[0] || { name: "Vitoria Infantry Regiment No. 8", meta: "Infantry regiment", values: "4-6", men: "785/785 men", share: "1" };
    const head = `<h3>Andalucía</h3><p class="pane-meta">Contested: Republic 3 sub-territories, Southern command 5</p>
      <div class="m3-meta-row">${wxChip("andalucia")}<span class="m3-pill bad">No income while contested</span><span class="m3-pill warn">Builds paused</span><span class="m3-pill warn">No recruiting</span></div>`;
    const rows = unitRow({ ...u, order: "Attacking (default)" }, '<span class="m3-pill warn">Fatigue 2 · −2</span>', true)
      + unitRow({ name: "Málaga Militia Column", meta: "Militia column", values: "2-2", men: "1400/2500 men", share: "0.56", order: "Holding" }, '<span class="m3-pill bad">Demoralized · no general to rally it</span>', false);
    const m = menu([["Attack", "Default here. Joins the standing battle for Andalucía; +1 fatigue.", "on"], ["Withdraw", "To Murcia or Castilla-La Mancha, through your own sub-territories (Almería, Jaén).", ""], ["Move, Entrench, Rest", "Not in contested ground: units here attack or withdraw.", "off"], ["Replenish", "Not in contested ground.", "off"]]);
    setPane(`<section class="pane-section">${head}<div class="army-picker"><div class="army-picker-header"><h4>Your units</h4><span class="selection-count">1 of 2 selected</span></div><ul class="formation-list">${rows}</ul><div class="order-command" data-menu-open="true"><button class="order-button" type="button"><span>Give Selected Units Order</span></button>${m}</div></div></section>`);
  }
  function paneReplenish(armies) {
    const list = armies.map((u, i) => i === 1 ? { ...u, men: "1,800/2,500 men", share: "0.72", order: "Entrenching" } : { ...u, order: "Entrenching" });
    const rows = list.map((u, i) => unitRow(u, i === 1 ? '<span class="m3-pill">Below strength: 700 men short</span>' : "", i === 1)).join("");
    const m = menu([["Replenish", "+700 men, arriving at the end of the turn · 4 Funds and 0.7k Manpower · cancelled and refunded if the unit fights", "on"], ["Move", "To a neighbouring territory, or by rail", ""], ["Entrench", "Default when there is no other order (+1 works)", ""]]);
    setPane(`<section class="pane-section">${territoryHead("catalunya", "Cataluña")}<div class="m3-tabs" role="tablist"><button class="m3-tab" role="tab" aria-selected="true">Units<span class="count">3</span></button><button class="m3-tab" role="tab" aria-selected="false">Build<span class="count">2</span></button><button class="m3-tab" role="tab" aria-selected="false">Recruit</button></div>
      <div class="army-picker"><div class="army-picker-header"><h4>Your units</h4><span class="selection-count">1 of 3 selected</span></div><ul class="formation-list">${rows}</ul><div class="order-command" data-menu-open="true"><button class="order-button" type="button"><span>Give Selected Units Order</span></button>${m}</div></div></section>`);
  }
  function stamp(text) { const s = html(`<div class="m3-stamp">${text}</div>`); document.body.appendChild(s); }

  window.M3 = { paneContested, paneReplenish, header, subterr, rail, paneTerritory, paneSubFocus, readArmies, moveTargets, battle, battleIconTooltip, aircraft, paneAir, setupTimer, focusSub, recruitTooltip, stamp, ledgerInPane, setPane, km2px };
})();
