// Builds the Rev 4 balance question page (review tooling, not game code).
//   MARKED=/path/marked.esm.js node build.mjs [out.html]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const { marked } = await import(pathToFileURL(process.env.MARKED).href);
const out = process.argv[2] ?? join(here, "rev-4-balance-questions.html");
const read = (file) => readFileSync(join(here, file), "utf8");
const titles = { goals: "Goals", strategies: "Strategies and personas", changes: "Changes to the game", sims: "Experiments and sims", run: "Running it", rev4: "Left over from Rev 4" };
const questions = JSON.parse(read("questions.json")).map((question) => { if (!titles[question.idea]) throw new Error(question.idea); return { ...question, groupTitle: titles[question.idea] }; });
const md = read("content.md");
const parts = [...md.matchAll(/<!--\s*section:([\w-]+)\s*-->/g)];
const toc = ["<ol>"];
let content = "";
parts.forEach((part, index) => {
  const key = part[1];
  const body = md.slice(part.index + part[0].length, index + 1 < parts.length ? parts[index + 1].index : md.length).trim();
  const html = marked.parse(body).replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  const heading = (body.match(/^## (.+)$/m) || [])[1];
  if (heading) toc.push(`<li><a href="#${key}"><span>${heading}</span><span class="count"${questions.some((question) => question.idea === key) ? ` data-toc-idea="${key}"` : ""}></span></a></li>`);
  content += `<section class="sheet${key === "intro" ? " masthead-sheet" : ""}" id="${key}">\n${html}\n</section>\n`;
});
toc.push("</ol>");
for (const question of questions) if (!content.includes(`data-idea="${question.idea}"`)) throw new Error(`no section for ${question.idea}`);
let page = readFileSync(join(here, "..", "milestone-3-ideation", "tools", "template.html"), "utf8");
const swap = (from, to) => { if (!page.includes(from)) throw new Error(`template changed: ${from.slice(0, 40)}`); page = page.replace(from, () => to); };
swap("<title>Milestone 3 Ideation</title>", "<title>Rev 4 Balance Plan</title>");
swap('var KEY = "m3-ideation-answers-v1";', 'var KEY = "m3r4-balance-v1";');
swap('["# Milestone 3 ideation answers", ""]', '["# Rev 4 balance answers", ""]');
swap("lg.appendChild(head); fs.appendChild(lg);", 'lg.appendChild(head); if (q.context) lg.appendChild(el("p", "q-ctx", q.context)); fs.appendChild(lg);');
swap(".q .q-text { font-weight: 600; flex: 1 1 260px; }", ".q .q-text { font-weight: 600; flex: 1 1 260px; }\n.q .q-ctx { font-size: 0.84rem; color: var(--ink-soft); margin: 0 0 8px; max-width: 72ch; }\n.q .opt > span { min-width: 0; overflow-wrap: anywhere; }\n.sheet h2 + .questions, .questions { margin-top: 1.4rem; }");
swap("{{TOC}}", toc.join("\n"));
swap("{{CONTENT}}", content);
swap("{{QUESTIONS_JSON}}", JSON.stringify(questions).replace(/</g, "\\u003c"));
swap("{{WIDGETS_JS}}", "window.M3W = {};");
writeFileSync(out, page);
console.log(`wrote ${out}: ${questions.length} questions, ${parts.length} sections, ${(page.length / 1024).toFixed(0)} KB`);
