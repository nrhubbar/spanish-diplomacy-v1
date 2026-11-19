// Builds the Milestone 3 mechanics review page from content.md and questions.json,
// reusing the ideation report's template (answer saving, copy, progress).
// Throwaway review tooling, not game code. Needs `marked` (15.x):
//   MARKED=/path/to/node_modules/marked/lib/marked.esm.js node build.mjs [out.html]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { marked } = await import(pathToFileURL(process.env.MARKED ?? "marked").href);
const out = process.argv[2] ?? join(here, "mechanics-review.html");

const titles = {
  contested: "Contested ground", combat: "Combat numbers", economy: "Income and balance",
  movement: "Movement, rail, ports", units: "Armies, units, air", weather: "Weather and calendar", harness: "Harness, data, scope"
};
const questions = JSON.parse(readFileSync(join(here, "questions.json"), "utf8")).map((q) => {
  const strip = (s) => (s == null ? s : s.replace(/`/g, ""));
  return { ...q, groupTitle: titles[q.idea], text: strip(q.text), context: strip(q.context),
    options: q.options.map((o) => ({ ...o, label: strip(o.label), rationale: strip(o.rationale) })) };
});
const ids = new Set();
for (const q of questions) { if (ids.has(q.id)) throw new Error("duplicate " + q.id); ids.add(q.id); }

const md = readFileSync(join(here, "content.md"), "utf8");
const parts = [...md.matchAll(/<!--\s*section:([\w-]+)\s*-->/g)];
const toc = ['<ol>'];
let content = "";
parts.forEach((m, i) => {
  const key = m[1];
  const body = md.slice(m.index + m[0].length, i + 1 < parts.length ? parts[i + 1].index : md.length).trim();
  const html = marked.parse(body).replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  const h2 = (body.match(/^## (.+)$/m) || [])[1];
  if (h2) {
    const rest = h2.replace(/^Contradictions: /, ""); const label = rest[0].toUpperCase() + rest.slice(1);
    const counted = questions.some((q) => q.idea === key);
    toc.push(`<li><a href="#${key}"><span>${label}</span><span class="count"${counted ? ` data-toc-idea="${key}"` : ""}></span></a></li>`);
  }
  content += `<section class="sheet${key === "intro" ? " masthead-sheet" : ""}" id="${key}">\n${html}\n</section>\n`;
});
toc.push("</ol>");

let page = readFileSync(join(here, "..", "tools", "template.html"), "utf8");
const swap = (a, b) => { if (!page.includes(a)) throw new Error("template changed: " + a.slice(0, 40)); page = page.replace(a, b); };
swap("<title>Milestone 3 Ideation</title>", "<title>Milestone 3 Mechanics Review</title>");
swap('var KEY = "m3-ideation-answers-v1";', 'var KEY = "m3-mechanics-answers-v1";');
swap('["# Milestone 3 ideation answers", ""]', '["# Milestone 3 mechanics review answers", ""]');
swap("lg.appendChild(head); fs.appendChild(lg);", 'lg.appendChild(head); if (q.context) lg.appendChild(el("p", "q-ctx", q.context)); fs.appendChild(lg);');
swap(".q .q-text { font-weight: 600; flex: 1 1 260px; }", ".q .q-text { font-weight: 600; flex: 1 1 260px; }\n.q .q-ctx { font-size: 0.84rem; color: var(--ink-soft); margin: 0 0 8px; max-width: 72ch; }\n.q .opt > span { min-width: 0; overflow-wrap: anywhere; }");
swap("{{TOC}}", toc.join("\n"));
swap("{{CONTENT}}", content);
swap("{{QUESTIONS_JSON}}", JSON.stringify(questions).replace(/</g, "\\u003c"));
swap("{{WIDGETS_JS}}", "");
writeFileSync(out, page);
console.log(`wrote ${out}: ${questions.length} questions, ${parts.length} sections`);
