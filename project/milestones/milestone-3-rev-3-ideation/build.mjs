// Builds the Milestone 3 Rev 3 review page (review tooling, not game code).
//   node tools/extract.mjs; node make-questions.mjs; MARKED=/path/marked.esm.js node build.mjs [out.html]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const { marked } = await import(pathToFileURL(process.env.MARKED).href);
// ROUND=2 builds the second review page from its own content and questions.
const round = process.env.ROUND ?? "1"; const two = round !== "1";
const out = process.argv[2] ?? join(here, two ? `milestone-3-rev-3-round-${round}.html` : "milestone-3-rev-3-review.html");
const read = (f) => readFileSync(join(here, f), "utf8");
const titles = { upkeep: "Upkeep", values: "Troop values", payback: "Payback", republic: "Popular Resistance", ai: "Computer player", music: "Music", sfx: "Sound effects", bandwidth: "Bandwidth",
  markers: "Aircraft markers", recruit: "Recruit page", battle: "Battle sheet", invade: "Invasion pane", casualties: "Casualties", pruning: "Pruning", carry: "Left open from Rev 2", plan: "How Rev 3 runs",
  units: "Your unit table", shortage: "When Manpower runs out", buildings: "Buildings", moves: "Rail", endturn: "End-turn sound", militia: "Militia", arms: "Mixed armies", factory: "The merged Factory", south: "The South" };
const questions = JSON.parse(read(two ? `questions-round-${round}.json` : "questions.json")).map((q) => { if (!titles[q.idea]) throw new Error(q.idea); return { ...q, groupTitle: titles[q.idea] }; });
const md = read(two ? `content-round-${round}.md` : "content.md").replaceAll("{{IMG}}", "images/")
  .replace(/<img src="([^"]+)"[^>]*>/g, (m, src) => `<a href="${src}" target="_blank" rel="noopener" title="Open full size">${m}</a>`)
  .replace(/<!--\s*widget:([\w-]+)\s*-->/g, (_, id) => `\n\n<div class="widget" data-widget="${id}"></div>\n\n`);
const parts = [...md.matchAll(/<!--\s*section:([\w-]+)\s*-->/g)];
const toc = ["<ol>"]; let content = "";
parts.forEach((m, i) => {
  const key = m[1]; const body = md.slice(m.index + m[0].length, i + 1 < parts.length ? parts[i + 1].index : md.length).trim();
  const html = marked.parse(body).replace(/(<div class="table-wrap">)?<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>(\s*<\/div>)?/g, "</table></div>");
  const h2 = (body.match(/^## (.+)$/m) || [])[1];
  if (h2) toc.push(`<li><a href="#${key}"><span>${h2}</span><span class="count"${questions.some((q) => q.idea === key) ? ` data-toc-idea="${key}"` : ""}></span></a></li>`);
  content += `<section class="sheet${key === "intro" ? " masthead-sheet" : ""}" id="${key}">\n${html}\n</section>\n`;
});
toc.push("</ol>");
for (const q of questions) if (!content.includes(`data-idea="${q.idea}"`)) throw new Error("no section for " + q.idea);
let page = readFileSync(join(here, "..", "milestone-3-ideation", "tools", "template.html"), "utf8");
const swap = (a, b) => { if (!page.includes(a)) throw new Error("template changed: " + a.slice(0, 40)); page = page.replace(a, () => b); };
swap("<title>Milestone 3 Ideation</title>", two ? `<title>Rev 3 Round ${round}</title>` : "<title>Milestone 3 Rev 3 Review</title>");
swap('var KEY = "m3-ideation-answers-v1";', two ? `var KEY = "m3r3-round${round}-answers-v1";` : 'var KEY = "m3r3-review-answers-v1";');
swap('["# Milestone 3 ideation answers", ""]', two ? `["# Milestone 3 Rev 3 round ${round} answers", ""]` : '["# Milestone 3 Rev 3 review answers", ""]');
swap("lg.appendChild(head); fs.appendChild(lg);", 'lg.appendChild(head); if (q.context) lg.appendChild(el("p", "q-ctx", q.context)); fs.appendChild(lg);');
swap(".q .q-text { font-weight: 600; flex: 1 1 260px; }", ".q .q-text { font-weight: 600; flex: 1 1 260px; }\n.q .q-ctx { font-size: 0.84rem; color: var(--ink-soft); margin: 0 0 8px; max-width: 72ch; }\n.q .opt > span { min-width: 0; overflow-wrap: anywhere; }\nfigure.mockup img { cursor: zoom-in; width: auto; max-width: 100%; }\n.sheet audio { max-width: 100%; }\n.w-btn { font: inherit; font-size: 0.85rem; padding: 4px 12px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface-2); color: var(--ink); cursor: pointer; }\n.w-btn:hover, .w-btn:focus-visible { border-color: var(--accent); }\n.sheet h2 + .questions, .questions { margin-top: 1.4rem; }");
swap("{{TOC}}", toc.join("\n")); swap("{{CONTENT}}", content);
swap("{{QUESTIONS_JSON}}", JSON.stringify(questions).replace(/</g, "\\u003c"));
const js = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const manifest = JSON.parse(read("audio-candidates/manifest.json")).map(({ src, ...m }) => m);
swap("{{WIDGETS_JS}}", `window.M3W = window.M3W || {};\nwindow.M3W_DATA = ${js(JSON.parse(read("tools/econ-data.json")))};\nwindow.M3W_AUDIO = ${js(manifest)};\nwindow.M3W_AUDIO3 = ${js(JSON.parse(read("audio-candidates/manifest-round-3.json")).map(({ id, kind, label, file, seconds, modified, parts }) => ({ id, kind, label, file, seconds, modified, parts: parts.map(({ source, author, licence, licenceUrl, url }) => ({ source, author, licence, licenceUrl, url })) })))};\n${read("widgets.js")}\n${read("widgets-audio.js")}`);
writeFileSync(out, page);
console.log(`wrote ${out}: ${questions.length} questions, ${parts.length} sections, ${(page.length / 1024).toFixed(0)} KB`);
