// Milestone 3 Rev 2 UX pass: mock UI injected into the live app (window.M3). Reads the real game
// state from the store render.mjs captured, and the scenario/graph data render.mjs passes in
// window.__M3. Draws only what Rev 2 would add; everything else on screen is the real app.
window.M3 = (() => {
  const W = window.__M3;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const svgEl = (html) => { const t = document.createElementNS(NS, "g"); t.innerHTML = html; return t; };
  const session = () => window.__store.getState().game.session;
  const state = () => session().game.state;
  const viewer = () => session().factionId ?? "republic";
  const subName = (id) => W.subs[id]?.name ?? id;
  const terrName = (id) => W.territories[id]?.name ?? id;
  const fmtK = (n) => `${n}k`;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const icon = {
    rail: '<path d="M5 3h14M5 21h14M8 3v18M16 3v18M8 8h8M8 13h8M8 18h8"/>',
    road: '<path d="M7 21 10 3M17 21 14 3M12 6v2M12 11v2M12 16v2"/>',
    sub: '<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z"/><path d="M9 3v16M15 5v16" stroke-dasharray="2 2"/>',
    weather: '<path d="M7 17h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 17z"/>',
    orders: '<path d="M4 18c5-1 9-6 14-12"/><path d="M13 5h6v6"/>',
    contested: '<path d="M4 4h16v16H4z"/><path d="M4 12 12 4M4 20 20 4M12 20l8-8"/>',
    battle: '<circle cx="12" cy="12" r="8"/><path d="M8 8l8 8M16 8l-8 8"/>',
    labels: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    supply: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    chimney: '<path d="M3 21V11l5 3v-3l5 3V5h4v16z"/>',
    move: '<path d="M4 12h14M13 6l6 6-6 6"/>',
    plane: '<path d="M2 13l9-2 3-7h2l-1 7 7 2v2l-7-1-1 5 2 2H9l1-2-1-5-7 1z"/>'
  };
  const ico = (name, extra = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${icon[name]}</svg>`;

  // ---------- Coordinates: the app's toScreen, read from the sub-territory wash transform ----------
  function toScreenFn() {
    const g = $(".sub-territory-wash > g[transform]");
    const m = /translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/.exec(g?.getAttribute("transform") ?? "");
    if (!m) throw new Error("no sub-territory wash transform to read the camera from");
    const [ox, oy, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return (p) => ({ x: ox + s * p.x, y: oy + s * p.y });
  }
  const station = (id) => W.entries[id]?.capital;
  /** Page coordinates of a point in the map layers' pixel space (for HTML overlays). */
  function layerToPage(p) {
    const svg = $(".sub-territory-wash");
    const r = svg.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }
  function overlay() {
    let o = $(".m3-overlay");
    if (!o) { o = el('<div class="m3-overlay"></div>'); document.body.append(o); o.style.position = "fixed"; }
    return o;
  }
  function tooltip(html, at, { below = false, dx = 0, dy = 0 } = {}) {
    const t = el(`<div class="m3-tooltip${below ? " below" : ""}">${html}</div>`);
    overlay().append(t);
    const r = t.getBoundingClientRect();
    t.style.left = `${at.x + dx}px`;
    t.style.top = `${below ? at.y + dy : at.y - r.height + dy}px`;
    return t;
  }
  function sampleBadge(text, at) {
    const b = el(`<div class="m3-sample">${text}</div>`);
    overlay().append(b);
    b.style.left = `${at.x}px`; b.style.top = `${at.y}px`;
    return b;
  }
  function mapRect() {
    const s = $(".map-surface").getBoundingClientRect();
    const pane = $(".map-pane");
    const pr = pane?.getBoundingClientRect();
    const side = pane?.dataset.layout === "side" && pane?.dataset.open === "true";
    return { left: s.left, top: s.top, right: side ? pr.left : s.right, bottom: s.bottom };
  }

  // ---------- Note 4: sub-territory borders and names everywhere ----------
  function subBorders() {
    document.body.classList.add("m3-subborders");
    const labels = $(".sub-territory-labels");
    if (!labels) return;
    const toScreen = toScreenFn();
    const named = new Set($$(".sub-territory-labels text.sub-territory-name").map((t) => t.closest("[data-sub-territory-label]")?.dataset.subTerritoryLabel));
    for (const [id, e] of Object.entries(W.entries)) {
      if (named.has(id)) continue;
      const sub = W.subs[id];
      const terr = W.territories[sub.territoryId];
      if (terr?.capitalSubTerritoryId === id && sub.cityIds?.length) continue;
      const p = toScreen(e.label);
      const t = document.createElementNS(NS, "text");
      t.setAttribute("class", "sub-territory-name"); t.setAttribute("x", p.x); t.setAttribute("y", p.y); t.textContent = sub.name;
      labels.append(t);
    }
  }

  // ---------- Notes 6, 6a: rail and roads as a graph ----------
  function curve(a, b, side) {
    const dx = b.x - a.x, dy = b.y - a.y, bow = 0.12 * side;
    const cx = (a.x + b.x) / 2 - dy * bow, cy = (a.y + b.y) / 2 + dx * bow;
    return { d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`, mid: { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y } };
  }
  /** Breadth-first over rail edges whose both ends the faction holds. */
  function railReach(from, factionId) {
    const s = state();
    const held = (id) => s.subTerritories[id]?.holder === factionId;
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const at = queue.shift();
      for (const [a, b, rail] of W.graph.edges) {
        if (!rail) continue;
        const next = a === at ? b : b === at ? a : undefined;
        if (next && !seen.has(next) && held(next)) { seen.add(next); queue.push(next); }
      }
    }
    return seen;
  }
  function graph({ roads = true, rail = true, passes = true, passLabels = false, noRoad = false, reach = null, cuts = [], zoomLevel = "operational" } = {}) {
    document.body.classList.add("m3-hide-rail");
    const real = $(".rail-layer:not(.m3-graph)");
    const parent = real?.parentNode ?? $(".sub-territory-wash");
    const toScreen = toScreenFn();
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "rail-layer m3-graph");
    g.setAttribute("aria-hidden", "true");
    const P = (id) => { const p = station(id); return p ? toScreen(p) : undefined; };
    let html = "";
    if (roads) {
      for (const [a, b, , road] of W.graph.edges) {
        if (!road) continue;
        const A = P(a), B = P(b); if (!A || !B) continue;
        const r = reach && reach.has(a) && reach.has(b) ? ' data-reach="true"' : "";
        if (zoomLevel === "overview" && road !== "main") continue;
        const w = road === "main" ? 1.6 : 1.15;
        html += `<path class="m3-road-halo" d="M${A.x} ${A.y} L${B.x} ${B.y}" stroke-width="${w + 1.6}"/><path class="m3-road" data-road="${road}"${r} d="M${A.x} ${A.y} L${B.x} ${B.y}" stroke-width="${w}"/>`;
      }
    }
    if (noRoad) {
      for (const [a, b] of W.graph.noRoad) {
        const A = P(a), B = P(b); if (!A || !B) continue;
        const m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
        html += `<path class="m3-noroad" d="M${A.x} ${A.y} L${B.x} ${B.y}"/><path class="m3-noroad-x-halo" d="M${m.x - 4} ${m.y - 4} L${m.x + 4} ${m.y + 4} M${m.x + 4} ${m.y - 4} L${m.x - 4} ${m.y + 4}"/><path class="m3-noroad-x" d="M${m.x - 4} ${m.y - 4} L${m.x + 4} ${m.y + 4} M${m.x + 4} ${m.y - 4} L${m.x - 4} ${m.y + 4}"/>`;
      }
    }
    const stations = new Set();
    const passAt = [];
    if (rail) {
      const branch = zoomLevel !== "overview";
      // Exactly the live RailLayer's markup: halo, line, ties from level 2, 0.8 + 0.45 per level.
      for (const [a, b, level, , pass] of W.graph.edges) {
        const A = P(a), B = P(b); if (!A || !B) continue;
        const c = curve(A, B, a < b ? 1 : -1);
        if (pass) passAt.push({ name: pass, at: level ? c.mid : { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, rail: level > 0 });
        if (!level || (!branch && level < 2)) continue;
        const width = 0.8 + 0.45 * level;
        const ride = reach && reach.has(a) && reach.has(b);
        html += `<g data-level="${level}"><path class="rail-line-halo" d="${c.d}" stroke-width="${width + 1}"/><path class="rail-line"${ride ? ' data-rideable="true"' : ""} d="${c.d}" stroke-width="${ride ? width + 0.8 : width}"/>${level >= 2 ? `<path class="rail-ties" d="${c.d}" stroke-width="${width + 1.6}"/>` : ""}</g>`;
        stations.add(a); stations.add(b);
      }
      for (const [a, b] of cuts) {
        const A = P(a), B = P(b); if (!A || !B) continue;
        const c = curve(A, B, a < b ? 1 : -1);
        html += `<path class="m3-cut" d="${c.d}"/>`;
      }
      for (const id of stations) {
        const at = P(id); if (!at) continue;
        const size = (state().subTerritories[id]?.rail ?? 1) >= 3 ? 5 : 4;
        const ride = reach && reach.has(id) ? ' data-rideable="true"' : "";
        html += `<rect class="rail-station"${ride} height="${size}" width="${size}" x="${at.x - size / 2}" y="${at.y - size / 2}"/>`;
      }
    }
    if (passes && zoomLevel !== "overview") {
      for (const p of passAt) {
        html += `<g class="m3-pass" transform="translate(${p.at.x.toFixed(1)} ${p.at.y.toFixed(1)})"><circle r="6.5"/><text y="0.5">)(</text>${passLabels ? `<text class="m3-pass-name" x="10" y="-3">${esc(p.name)}</text><text class="m3-pass-cost" x="10" y="9">+1 turn</text>` : ""}</g>`;
      }
    }
    g.innerHTML = html;
    if (real) real.after(g); else parent.append(g);
    return g;
  }
  function graphKey(at, { noRoad = false, reach = false } = {}) {
    const k = el(`<div class="m3-key">
      <b>Transport (illustrative 1936 data)</b>
      <span><svg viewBox="0 0 30 12"><path d="M1 6h28" stroke="#fbf6ea" stroke-opacity=".5" stroke-width="3.2"/><path d="M1 6h28" stroke="#241d18" stroke-opacity=".62" stroke-width="2.15"/><path d="M1 6h28" stroke="#241d18" stroke-opacity=".6" stroke-width="3.7" stroke-dasharray=".9 4"/></svg>Rail: weight is the line's level</span>
      <span><svg viewBox="0 0 30 12"><path d="M1 6h28" stroke="#6b4526" stroke-opacity=".8" stroke-width="1.6"/></svg>Main road</span>
      <span><svg viewBox="0 0 30 12"><path d="M1 6h28" stroke="#6b4526" stroke-opacity=".62" stroke-width="1.15" stroke-dasharray="5 3"/></svg>Minor road</span>
      <span><svg viewBox="0 0 30 14"><circle cx="15" cy="7" r="6" fill="#fbf6ea" stroke="#3b2f26" stroke-width="1.2"/><text x="15" y="7.5" font-size="8" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#3b2f26">)(</text></svg>Mountain pass: costs a turn more</span>
      ${noRoad ? '<span><svg viewBox="0 0 30 12"><path d="M1 6h28" stroke="#8f2f25" stroke-opacity=".55" stroke-dasharray="1 3" stroke-width="1.2"/><path d="M11 2l8 8M19 2l-8 8" stroke="#8f2f25" stroke-width="1.8"/></svg>No road: infantry only</span>' : ""}
      ${reach ? '<span><svg viewBox="0 0 30 12"><path d="M1 6h28" stroke="#1f3550" stroke-width="2.9"/></svg>Rail these units can ride now</span><span><svg viewBox="0 0 30 12"><path d="M1 6h28" stroke="#8f2f25" stroke-width="2" stroke-dasharray="3 3"/></svg>Line cut by enemy ground</span>' : ""}
    </div>`);
    overlay().append(k);
    k.style.left = `${at.x}px`; k.style.top = `${at.y}px`;
    return k;
  }

  // ---------- Note 7: the raid's line ends at its target sub-territory ----------
  function raidToSub(subId) {
    const toScreen = toScreenFn();
    const target = toScreen(station(subId));
    const line = $('.air-mission-line[data-mission="raid"]') ?? $(".air-mission-line");
    let ghost = "";
    if (line) {
      const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((a) => Number(line.getAttribute(a)));
      ghost = `<path class="m3-ghost" d="M${x1} ${y1} L${x2} ${y2}"/><text class="m3-ghost-label" x="${x2 + 8}" y="${y2 + 4}">today: the territory centre</text>`;
      line.setAttribute("x2", target.x); line.setAttribute("y2", target.y);
    }
    // The target sub-territory: its outline from the wash's own path, a crosshair on its town.
    const wash = $(".sub-territory-wash > g[transform]");
    const src = $(`.sub-territory-wash [data-sub-territory-id="${subId}"]`);
    const d = src?.getAttribute("d") ?? src?.querySelector("path")?.getAttribute("d");
    if (d) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("class", "m3-raid-target"); p.setAttribute("d", d); p.setAttribute("fill-rule", "evenodd");
      wash.append(p);
    }
    const svg = line?.ownerSVGElement ?? $(".air-layer-lines");
    const g = svgEl(`${ghost}<circle class="m3-crosshair" cx="${target.x}" cy="${target.y}" r="9"/><path class="m3-crosshair" d="M${target.x - 14} ${target.y}h8M${target.x + 6} ${target.y}h8M${target.x} ${target.y - 14}v8M${target.x} ${target.y + 6}v8"/><text class="m3-raid-label" x="${target.x + 14}" y="${target.y + 20}">Raid: ${esc(subName(subId))}</text>`);
    svg.append(g);
  }

  // ---------- Note 8: map layers ----------
  const layerDefs = [
    ["sub", "Sub-territories"], ["rail", "Rail"], ["road", "Roads"], ["weather", "Weather"],
    ["orders", "Order lines"], ["supply", "Supply"], ["contested", "Contested"], ["battle", "Battles"], ["labels", "Labels"]
  ];
  function layerBar(on) {
    const r = mapRect();
    const bar = el(`<div class="m3-layerbar" role="toolbar" aria-label="Map layers"><span class="m3-layerbar-title">Layers</span>${layerDefs.map(([id, name], i) => `${i === 4 || i === 7 ? '<span class="m3-layer-sep"></span>' : ""}<button class="m3-layer-toggle" aria-pressed="${on.includes(id)}" type="button">${ico(id === "sub" ? "sub" : id)}${name}</button>`).join("")}</div>`);
    overlay().append(bar);
    const w = bar.getBoundingClientRect().width;
    bar.style.left = `${Math.max(r.left + 130, (r.left + r.right) / 2 - w / 2 + 40)}px`;
    bar.style.top = `${r.bottom - 14 - bar.getBoundingClientRect().height}px`;
    bar.style.bottom = "auto";
  }
  function layersPopover(preset, on) {
    const legend = $(".map-legend");
    const lr = legend.getBoundingClientRect();
    const btn = el(`<button class="secondary-button compact-button m3-layers-button" type="button" aria-expanded="true">${ico("layers")}Layers</button>`);
    overlay().append(btn);
    btn.style.left = `${lr.right + 8}px`; btn.style.top = `${lr.top}px`;
    btn.style.height = `${lr.height}px`;
    const pop = el(`<div class="m3-layers-pop" role="dialog" aria-label="Map layers"><h4>Map layers</h4>
      <div class="m3-presets" role="group" aria-label="Presets">${["Orders", "Logistics", "Economy"].map((p) => `<button aria-pressed="${p === preset}" type="button">${p}</button>`).join("")}</div>
      <ul>${layerDefs.map(([id, name]) => `<li data-on="${on.includes(id)}">${ico(id === "sub" ? "sub" : id)}<span>${name}</span><span class="m3-sw" role="switch" aria-checked="${on.includes(id)}"></span></li>`).join("")}</ul>
      <p class="m3-pop-note">${preset}: ${preset === "Logistics" ? "rail, roads, passes and supply; order lines and battle markers off." : preset === "Orders" ? "order lines, contested ground and battles; rail and roads off." : "sub-territories and what each one yields."}</p></div>`);
    overlay().append(pop);
    const pr = pop.getBoundingClientRect();
    pop.style.left = `${lr.right + 8}px`;
    pop.style.top = `${lr.top - pr.height - 8}px`;
  }

  function tooltipAtSub(id, html) { const at = layerToPage(toScreenFn()(station(id))); return tooltip(html, at, { dx: -150, dy: -18 }); }
  return { tooltipAtSub, W, $, $$, el, svgEl, session, state, viewer, subName, terrName, fmtK, esc, ico, toScreenFn, station, layerToPage, overlay, tooltip, sampleBadge, mapRect, subBorders, graph, graphKey, railReach, raidToSub, layerBar, layersPopover };
})();
