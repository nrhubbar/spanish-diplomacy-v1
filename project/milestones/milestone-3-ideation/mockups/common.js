// Shared helpers for the mockup pages (classic script: pages load over file://).
// Counters reuse the app's real classes from app.css; NATO glyphs follow assets/icons/nato/*.svg
// (600 x 400 frame, black 10 px strokes), recoloured the way src/main/map/markup.ts does.

const FACTIONS = {
  rep: { abbr: "REP", color: "#b1493f", name: "Republican Government" },
  nic: { abbr: "NIC", color: "#b39232", name: "Northern Insurgent Command" },
  sic: { abbr: "SIC", color: "#665089", name: "Southern Insurgent Command" }
};

const X = '<path d="M595,395 5,5 M595,5 5,395" fill="none" stroke="#000" stroke-width="10"/>';
const PROP = '<path d="M300,200 C250,118 140,112 140,200 C140,288 250,282 300,200 C350,118 460,112 460,200 C460,288 350,282 300,200 Z" fill="none" stroke="#000" stroke-width="20" stroke-linejoin="round"/>';
const letter = (text) => `<text x="300" y="372" font-family="Inter, system-ui, sans-serif" font-size="120" font-weight="800" text-anchor="middle">${text}</text>`;

// Existing glyphs are copied from assets/icons/nato; cavalry, armour, and artillery exist there
// already but no scenario uses them yet. AA and the aviation glyphs are drawn for this mockup.
const GLYPHS = {
  "infantry": X,
  "militia": '<path d="M595,395 5,5 M595,5 5,395" fill="none" stroke="#000" stroke-width="40" stroke-dasharray="88,62"/>',
  "colonial": X + '<path d="M336,30 A88,88 0 1 0 336,182 A68,68 0 1 1 336,30 Z" fill="#000"/>',
  "security": X + '<path d="M300,115 L428,200 L300,285 L172,200 Z" fill="#000"/>',
  "cavalry": '<path d="M595,5 5,395" fill="none" stroke="#000" stroke-width="10"/>',
  "tank": '<path d="M210.8,298.3 c-54.3,0 -98.3,-44 -98.3,-98.3 0,-54.3 44,-98.3 98.3,-98.3 h178.4 c54.3,0 98.3,44 98.3,98.3 0,54.3 -44,98.3 -98.3,98.3 z" fill="none" stroke="#000" stroke-width="16"/>',
  "artillery": '<circle cx="300" cy="200" r="84.6" fill="#000"/>',
  "aa": '<path d="M120,330 A180,170 0 0 1 480,330" fill="none" stroke="#000" stroke-width="24"/><circle cx="300" cy="262" r="46" fill="#000"/>',
  "fighter": PROP + letter("F"),
  "bomber": PROP + letter("B"),
  "recon": PROP + '<path d="M595,5 5,395" fill="none" stroke="#000" stroke-width="10"/>'
};

const TYPES = {
  "infantry": { name: "Infantry regiment", values: "4-6" },
  "militia": { name: "Militia column", values: "3-4" },
  "colonial": { name: "Colonial veterans", values: "6-5" },
  "security": { name: "Security forces", values: "3-5" },
  "cavalry": { name: "Cavalry", values: "3-3" },
  "tank": { name: "Tank", values: "5-3" },
  "artillery": { name: "Artillery", values: "4-2" },
  "aa": { name: "Anti-air", values: "1-3" },
  "fighter": { name: "Fighter", values: "2-2" },
  "bomber": { name: "Bomber", values: "3-1" },
  "recon": { name: "Recon aircraft", values: "0-1" }
};

function symbol(type, color) {
  return `<svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`
    + `<path d="M5,5H595V395H5Z" style="fill:${color};fill-opacity:0.92;stroke:#241d18;stroke-width:14;stroke-linejoin:miter"/>`
    + GLYPHS[type]
    + `<path d="M5,5H595V395H5Z" fill="none" stroke="#000" stroke-width="10"/></svg>`;
}

function worksBadge(level, max = 3) {
  const slots = Math.max(level, Math.min(max, 4));
  const width = 15 + slots * 4.4;
  let pips = "";
  for (let i = 0; i < slots; i += 1) {
    pips += `<circle cx="${15.6 + i * 4.4}" cy="6.5" r="1.6" fill="${i < level ? "#fffaf0" : "none"}" stroke="#fffaf0" stroke-width="${i < level ? 0 : 0.9}"/>`;
  }
  return `<svg class="unit-counter-works" width="${width}" height="13" viewBox="0 0 ${width} 13"><rect fill="#241d18" height="11.6" rx="3" stroke="#fffaf0" stroke-width="1.4" width="${width - 1.4}" x="0.7" y="0.7"/><path d="M3.4 9.6 V3.8 H5.2 V5.4 H6.8 V3.8 H8.6 V5.4 H10.2 V3.8 H12 V9.6 Z" fill="#fffaf0"/>${pips}</svg>`;
}

const DEMORALIZED = '<svg viewBox="-12.5 -12.5 25 25"><circle r="11.5" fill="RING" stroke="#241d18" stroke-width="1.2"/><circle r="8.2" fill="#c07a14" stroke="#fffaf0" stroke-width="1.4"/><g fill="none" stroke="#fffaf0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M -5 -3.6 L -1.6 -0.2 L 0.4 -2.2 L 4.4 1.8"/><path d="M 1 2.2 L 4.6 2 L 4.4 -1.6"/></g></svg>';

/**
 * One counter as the app prints it. Options: f (faction key), type, des, values, full (struck
 * values when reduced), men, share (0..1), x, y, w, h, count (stack tab), works, demor, ordered,
 * selected, extra (HTML appended inside the counter).
 */
function counter(o) {
  const faction = FACTIONS[o.f];
  const share = o.share ?? 1;
  const reduced = o.full !== undefined;
  const style = `--faction-color:${faction.color};--strength-share:${share.toFixed(3)};left:${o.x}px;top:${o.y}px;width:${o.w ?? 52}px;height:${o.h ?? 40}px;${o.style ?? ""}`;
  const long = (o.values ?? TYPES[o.type].values).length >= 5;
  return `<span class="unit-counter${o.count ? " unit-counter-group" : ""}" data-long="${long}" data-selected="${o.selected ? "true" : "false"}" data-ordered="${o.ordered ? "true" : "false"}" data-demoralized="${o.demor ? "true" : "false"}" style="${style}">`
    + `<span class="unit-counter-head"><span class="unit-counter-symbol">${symbol(o.type, faction.color)}</span><span class="unit-counter-designation">${o.des ?? ""}</span></span>`
    + `<span class="unit-counter-values"><span class="unit-counter-current">${o.values ?? TYPES[o.type].values}</span>${reduced ? `<s class="unit-counter-full">${o.full}</s>` : ""}</span>`
    + `<span class="unit-counter-men">${o.men ?? ""}</span><span class="unit-counter-bar"></span>`
    + (o.demor ? `<span class="unit-counter-demoralized">${DEMORALIZED.replace("RING", faction.color)}</span>` : "")
    + (o.works ? worksBadge(o.works) : "")
    + (o.count ? `<span class="unit-counter-count">\u00d7${o.count}</span>` : "")
    + (o.ordered ? '<span class="unit-counter-badge">\u2713</span>' : "")
    + (o.extra ?? "")
    + "</span>";
}

/** Fills every [data-symbol="type:faction"] element with that NATO symbol. */
function mountCounters() {
  document.querySelectorAll("[data-symbol]").forEach((element) => {
    const [type, f] = element.getAttribute("data-symbol").split(":");
    element.innerHTML = symbol(type, FACTIONS[f].color);
  });
}

/** The Orders pane, redrawn opaque over today's pane so new content can replace its body. */
function pane({ title = "Orders", toggle = "Hide orders", body = "", footer = "End Turn", footerExtra = "" }) {
  return `<aside class="pane-cover"><div class="map-pane-header"><h2 class="map-pane-title">${title}</h2>`
    + `<button class="map-pane-toggle" type="button"><span class="map-pane-toggle-icon"></span>${toggle}</button></div>`
    + `<div class="map-pane-body">${body}</div>`
    + `<div class="map-pane-footer" style="display:flex;gap:0.5rem;align-items:center">${footerExtra}<button class="primary-action" type="button" style="flex:1">${footer}</button></div></aside>`;
}

function mark(style) {
  return `<div class="mock-mark" style="${style}">Mockup - illustrative</div>`;
}

document.addEventListener("DOMContentLoaded", mountCounters);
