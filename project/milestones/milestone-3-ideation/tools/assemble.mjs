// Assembles the Milestone 3 ideation report from the research notes.
// Throwaway ideation tooling, not game code. Needs `marked` (15.x):
//   MARKED=/path/to/node_modules/marked/lib/marked.esm.js node tools/assemble.mjs [--artifact out.html]
// Writes milestone-3-ideation.html (standalone, with a document skeleton) and milestone-3-ideation.md.
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const research = join(root, "research");
const { marked } = await import(pathToFileURL(process.env.MARKED ?? "marked").href);
const artifactOut = process.argv.includes("--artifact") ? process.argv[process.argv.indexOf("--artifact") + 1] : null;

const read = (p) => readFileSync(p, "utf8");
const clusters = ["engine", "process", "map", "economy", "military", "time"];
const ideaTitles = {
  1: "Recruitment and replenishment", 2: "Resources", 3: "Timed turns", 4: "Cities", 5: "Rail",
  6: "Movement and exhaustion", 7: "Sub-partitioning", 8: "Unit types and generals", 9: "d20 and graded outcomes",
  10: "Agentic process", 11: "Simulation harness", 12: "Weather", 13: "Generic engine and data"
};
const layout = JSON.parse(read(join(here, "layout.json")));
const mockups = JSON.parse(read(join(here, "mockups.json")));

// ---- Parse research sections into blocks ----
const blocks = {};      // "idea:7" -> markdown, "mismatch:a" -> markdown
const sources = [];     // { cluster, title, url }
for (const c of clusters) {
  const file = join(research, `${c}.sections.md`);
  if (!existsSync(file)) { console.warn(`missing ${file}`); continue; }
  let text = read(file).replace(/\r\n/g, "\n");
  if (c !== "economy") text = text.replace(/<!--\s*idea:4-resources\s*-->/g, "@@IDEA4RES@@");
  const re = /^<!--\s*(idea:[\w-]+|mismatch:[\w-]+|sources)\s*-->\s*$/gm;
  const marks = [...text.matchAll(re)];
  marks.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    if (m[1] === "sources") {
      for (const line of body.split("\n")) {
        const s = line.match(/^\s*[-*]\s*\[(.+?)\]\((\S+?)\)\s*(.*)$/);
        if (s) sources.push({ cluster: c, title: s[1], url: s[2], note: s[3] });
      }
    } else {
      if (blocks[m[1]]) console.warn(`duplicate block ${m[1]} in ${c}`);
      blocks[m[1]] = body;
    }
  });
}
if (blocks["idea:4"]) {
  const res = blocks["idea:4-resources"] ?? "";
  blocks["idea:4"] = blocks["idea:4"].includes("@@IDEA4RES@@")
    ? blocks["idea:4"].replace("@@IDEA4RES@@", res)
    : blocks["idea:4"].replace(/(### Fit with today's engine)/, `${res}\n\n$1`);
}

// ---- Questions ----
let questions = [];
for (const c of clusters) {
  const file = join(research, `${c}.questions.json`);
  if (!existsSync(file)) continue;
  try { questions.push(...JSON.parse(read(file)).map((q) => ({ ...q, cluster: c }))); }
  catch (e) { console.warn(`bad JSON ${file}: ${e.message}`); }
}
const extraQ = join(here, "questions-extra.json");
if (existsSync(extraQ)) questions.push(...JSON.parse(read(extraQ)).map((q) => ({ ...q, cluster: "coordinator" })));
const seen = new Set();
for (const q of questions) {
  if (seen.has(q.id)) console.warn(`duplicate question id ${q.id}`);
  seen.add(q.id);
  q.idea = String(q.idea);
  const recIdx = q.options.findIndex((o) => o.recommended);
  if (recIdx > 0) { const [r] = q.options.splice(recIdx, 1); q.options.unshift(r); }
  if (!q.multi) q.options.forEach((o, i) => { if (i > 0 && o.recommended) delete o.recommended; });
  if (recIdx < 0) console.warn(`no recommended option in ${q.id}`);
  q.groupTitle = /^\d+$/.test(q.idea) ? `Idea ${q.idea}: ${ideaTitles[q.idea]}` : q.idea.startsWith("mismatch-") ? `Mismatch (${q.idea.slice(9)})` : q.idea === "sequencing" ? "Sequencing" : "Tensions";
}
const order = [];
for (const item of layout) {
  if (item.kind === "idea") order.push(String(item.n));
  if (item.questions) order.push(...item.questions);
}
questions.sort((a, b) => {
  const ia = order.indexOf(a.idea), ib = order.indexOf(b.idea);
  if (ia !== ib) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  const na = Number(a.id.split("-").pop()), nb = Number(b.id.split("-").pop());
  return a.id.replace(/-\d+$/, "").localeCompare(b.id.replace(/-\d+$/, "")) || na - nb;
});

// ---- Markdown -> HTML helpers ----
const imgData = {};
let imageBytes = 0;
function mockupHtml(id) {
  const meta = mockups[id] ?? { caption: id };
  const file = join(root, "images", `${id}.webp`);
  if (!existsSync(file)) return `<p class="missing">Mockup <code>${id}</code> was not produced. ${meta.missing ?? ""}</p>`;
  const b64 = readFileSync(file).toString("base64");
  imageBytes += statSync(file).size;
  imgData[id] = true;
  return `<figure class="mockup"><img decoding="async" src="data:image/webp;base64,${b64}" alt="${escapeAttr(meta.alt ?? meta.caption)}"><figcaption>${escapeHtml(meta.caption)}</figcaption></figure>`;
}
function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
function toHtml(md) {
  let s = md
    .replace(/<!--\s*widget:([\w-]+)\s*-->/g, (_, id) => `\n\n<div class="widget" data-widget="${id}"></div>\n\n`)
    .replace(/<!--\s*mockup:([\w-]+)\s*-->/g, (_, id) => `\n\n${mockupHtml(id)}\n\n`)
    .replace(/<!--\s*questions:([\w-]+)\s*-->/g, (_, id) => `\n\n<div class="questions" data-idea="${id}"></div>\n\n`);
  let html = marked.parse(s, { gfm: true });
  html = html
    .replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>")
    .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
  return html;
}
function toMd(md) {
  return md
    .replace(/<!--\s*widget:([\w-]+)\s*-->/g, (_, id) => `*Interactive widget \`${id}\`: open the HTML report to use it.*`)
    .replace(/<!--\s*mockup:([\w-]+)\s*-->/g, (_, id) => existsSync(join(root, "images", `${id}.webp`)) ? `![${(mockups[id] ?? {}).caption ?? id}](images/${id}.webp)` : `*Mockup \`${id}\` was not produced.*`)
    .replace(/<!--\s*questions:([\w-]+)\s*-->/g, (_, id) => questionsMd(id));
}
function questionsMd(idea) {
  const list = questions.filter((q) => q.idea === String(idea));
  if (!list.length) return "*No questions drafted.*";
  return list.map((q) => [
    `**${q.id}** ${q.text}${q.multi ? " *(choose all that apply)*" : ""}`,
    ...q.options.map((o, i) => `${i + 1}. ${o.label}${o.recommended ? " **(Recommended)**" : ""}${o.rationale ? ` - ${o.rationale}` : ""}`),
    `${q.options.length + 1}. Other / notes: ____`
  ].join("\n")).join("\n\n");
}

// ---- Build ----
const tocItems = [];
const htmlParts = [];
const mdParts = [];
for (const item of layout) {
  if (item.kind === "group") {
    tocItems.push(`<li class="group">${escapeHtml(item.title)}</li>`);
    htmlParts.push(`<header class="group-head"><h2>${escapeHtml(item.title)}</h2>${item.intro ? `<p>${escapeHtml(item.intro)}</p>` : ""}</header>`);
    mdParts.push(`# ${item.title}\n\n${item.intro ?? ""}`);
    continue;
  }
  let md, id, tocLabel, tocCount = "";
  if (item.kind === "idea") {
    md = blocks[`idea:${item.n}`];
    id = `idea-${item.n}`;
    tocLabel = `${item.n}. ${ideaTitles[item.n]}`;
    tocCount = `<span class="count" data-toc-idea="${item.n}"></span>`;
    if (!md) { console.warn(`missing idea ${item.n}`); md = `## Idea ${item.n}: ${ideaTitles[item.n]}\n\nThe research for this idea did not complete. See the coordinator's notes.`; }
    md = md.replace(/^## Idea (\d+):/m, "## <span class=\"idea-no\">$1</span>");
  } else {
    md = read(join(here, item.file));
    md = md.replace(/<!--\s*include:([\w:-]+)\s*-->/g, (_, key) => key === "assumptions" ? assumptionsMd() : key === "coordinator" ? read(join(here, "assumptions-coordinator.md")) : (blocks[key] ?? `*(${key} not available)*`));
    if (item.kind === "sources") md += "\n\n" + sourcesMd();
    id = item.id;
    tocLabel = item.title;
    if (item.questions) tocCount = `<span class="count" data-toc-idea="${item.questions.join(",")}"></span>`;
  }
  tocItems.push(`<li><a href="#${id}"><span>${escapeHtml(tocLabel)}</span>${tocCount}</a></li>`);
  htmlParts.push(`<section class="sheet${item.kind === "intro" ? " masthead" : ""}${item.kind === "sources" ? " sources" : ""}" id="${id}">\n${toHtml(md)}\n</section>`);
  mdParts.push(toMd(md.replace(/<span class="idea-no">(\d+)<\/span>/, "Idea $1:")));
}
function assumptionsMd() {
  const names = { economy: "Economy", map: "Map structure", military: "Military", time: "Time", engine: "Engine and platform", process: "Process" };
  const out = [];
  for (const c of clusters) {
    const file = join(research, `${c}.md`);
    if (!existsSync(file)) continue;
    const items = [];
    let cur = null;
    for (const line of read(file).split("\n")) {
      if (/^\s*-\s+(\*\*)?A-[A-Z]+-\d+/.test(line) || /^\s*-\s+A-[A-Z]+-\d+/.test(line)) { if (cur) items.push(cur); cur = line.replace(/^\s*-\s+/, "").trim(); }
      else if (cur && /^\s+\S/.test(line) && !/^\s*-\s/.test(line)) cur += " " + line.trim();
      else if (cur) { items.push(cur); cur = null; }
    }
    if (cur) items.push(cur);
    if (items.length) out.push(`#### ${names[c]}\n\n${items.map((t) => "- " + t).join("\n")}`);
  }
  return out.join("\n\n");
}
function sourcesMd() {
  const byUrl = new Map();
  for (const s of sources) if (!byUrl.has(s.url)) byUrl.set(s.url, s);
  const groups = {};
  for (const s of byUrl.values()) (groups[s.cluster] ??= []).push(s);
  const names = { economy: "Economy (ideas 1, 2)", map: "Map structure (ideas 4, 5, 7)", military: "Military (ideas 6, 8, 9)", time: "Time (ideas 3, 12)", engine: "Engine and platform (ideas 11, 13)", process: "Process (idea 10)" };
  return clusters.filter((c) => groups[c]).map((c) => `### ${names[c]}\n\n${groups[c].map((s, i) => `${i + 1}. [${s.title}](${s.url})${s.note ? " " + s.note : ""}`).join("\n")}`).join("\n\n")
    + `\n\n${byUrl.size} distinct sources.`;
}

let widgets = "";
for (const c of clusters) {
  const file = join(research, `${c}.widgets.js`);
  if (!existsSync(file)) continue;
  widgets += `\n/* ---- ${c}.widgets.js ---- */\n(function () {\ntry {\n${read(file)}\n} catch (e) { if (window.console) console.error("widgets ${c}", e); }\n})();\n`;
}
widgets = widgets.replace(/<\/script/gi, "<\\/script");
const qJson = JSON.stringify(questions).replace(/</g, "\\u003c");

const page = read(join(here, "template.html"))
  .replace("{{TOC}}", `<ol>${tocItems.join("\n")}</ol>`)
  .replace("{{CONTENT}}", () => htmlParts.join("\n"))
  .replace("{{QUESTIONS_JSON}}", () => qJson)
  .replace("{{WIDGETS_JS}}", () => widgets);

writeFileSync(join(root, "milestone-3-ideation.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${page}\n</html>\n`);
if (artifactOut) writeFileSync(artifactOut, page);
writeFileSync(join(root, "milestone-3-ideation.md"),
  `<!-- Generated by tools/assemble.mjs from research/*.sections.md, research/*.questions.json, and tools/*.md. Diff this file; read the HTML. -->\n\n${mdParts.join("\n\n---\n\n")}\n`);

const nonAscii = [...page].filter((ch) => ch.charCodeAt(0) > 127).length;
console.log(JSON.stringify({ questions: questions.length, byIdea: Object.fromEntries(order.map((k) => [k, questions.filter((q) => q.idea === k).length])), sources: new Set(sources.map((s) => s.url)).size, images: Object.keys(imgData).length, imageKB: Math.round(imageBytes / 1024), pageKB: Math.round(page.length / 1024), nonAscii }, null, 0));
