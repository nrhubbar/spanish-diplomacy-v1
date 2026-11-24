// Builds questions.json from the researchers' candidates plus the coordinator's own questions.
import { readFileSync, writeFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`research/${f}-questions.json`, import.meta.url), "utf8"));
const all = Object.fromEntries(["economy", "audio", "prune", "ux"].flatMap(load).map((q) => [q.id, q]));
const pick = (from, id, idea, extra = {}) => { const q = all[from]; if (!q) throw new Error(from); return { ...q, ...extra, id, idea, options: (extra.options ?? q.options).map((o) => ({ label: o.label, ...(o.recommended ? { recommended: true } : {}), ...(o.rationale ? { rationale: o.rationale } : {}) })) }; };
const manifest = JSON.parse(readFileSync(new URL("audio-candidates/manifest.json", import.meta.url), "utf8"));
const recommendedSounds = new Set(["order-b", "recruit-a", "build-a", "air-a", "rail-a", "truck-a", "march-a", "end-a", "battle-a", "blocked-a"]);
const out = [
  pick("Q-R3-EC1", "Q-R3-6a", "upkeep"),
  pick("Q-R3-EC2", "Q-R3-6b", "upkeep"),
  pick("Q-R3-EC3", "Q-R3-6c", "values"),
  pick("Q-R3-EC4", "Q-R3-6d", "values"),
  pick("Q-R3-EC5", "Q-R3-6e", "values"),
  pick("Q-R3-EC6", "Q-R3-7a", "payback"),
  pick("Q-R3-EC7", "Q-R3-7b", "payback"),
  pick("Q-R3-EC8", "Q-R3-11", "republic"),
  pick("Q-R3-AI1", "Q-R3-10a", "ai"),
  pick("Q-R3-AI2", "Q-R3-10b", "ai"),
  pick("Q-R3-MUSIC-FILES", "Q-R3-3a", "music"),
  pick("Q-R3-MUSIC-QUALITY", "Q-R3-3b", "music", { context: "All four tracks: Opus 64 is 10.8 MB, Opus 96 is 16.3 MB. iPhones use a separate AAC copy (16.2 MB at 96). Listen to the samples above in headphones first." }),
  pick("Q-R3-MUSIC-START", "Q-R3-3c", "music"),
  pick("Q-R3-SFX-SET", "Q-R3-3d", "sfx"),
  { id: "Q-R3-3e", idea: "sfx", multi: true, text: "Which candidate sounds do you like? Tick every one to keep.", context: "Play them in the board above. The ticks for the recommended set are a starting guess: no one on the research team could listen. Leave out anything that sounds wrong and I'll find another.",
    options: manifest.map((m) => ({ label: `${m.action.replace(/ \(.*\)/, "")}: ${m.label}`, ...(recommendedSounds.has(m.id) ? { recommended: true } : {}) })) },
  pick("Q-R3-SFX-RULES", "Q-R3-3f", "sfx"),
  pick("Q-R3-MAP-IMAGE", "Q-R3-3.a-1", "bandwidth"),
  pick("Q-R3-SIZE-GATE", "Q-R3-3.a-2", "bandwidth"),
  pick("Q-R3-UX-3", "Q-R3-2", "markers"),
  pick("Q-R3-UX-5", "Q-R3-4", "recruit"),
  pick("Q-R3-BT-2", "Q-R3-5", "battle"),
  pick("Q-R3-UX-7", "Q-R3-8", "invade"),
  pick("Q-R3-CA-1", "Q-R3-9a", "casualties"),
  pick("Q-R3-UX-8", "Q-R3-9b", "casualties"),
  pick("Q-R3-PR-1", "Q-R3-P1", "pruning"),
  { id: "Q-R3-P2", idea: "pruning", text: "When should the pruning happen?", context: "The safe removals are small and touch many files, so they collide with feature work if both run at once.", options: [
    { label: "Safe removals first, before the feature work starts", recommended: true, rationale: "Everyone builds on the smaller code, and the unused-code check then stops regrowth." },
    { label: "A pass at the end", rationale: "Also catches what Rev 3 leaves behind, but merges are harder." },
    { label: "Both", rationale: "Cleanest result, and about twice the pruning cost." }] },
  { id: "Q-R3-C1", idea: "carry", text: "Should a paved airfield still let aircraft fly in rain and snow?", context: "Open since Rev 2. You chose \"rain and snow ground all air\", but the building has no other use.", options: [
    { label: "Yes, keep the exception", recommended: true, rationale: "Gives the upgrade a purpose, and it costs only 4 Funds in the Moderate package." },
    { label: "No: ground everything and remove the building", rationale: "Simpler, and one more thing pruned." }] },
  { id: "Q-R3-C2", idea: "carry", text: "Should trucks move on any road, not only main roads?", context: "Open since Rev 2. On the opening map only Madrid to Valencia is main road all the way, and the Republic has no trucks. You also asked for a truck sound, which would almost never play.", options: [
    { label: "Yes, any road, but still not across a mountain pass", recommended: true, rationale: "Trucks become worth buying at the new price." },
    { label: "No, leave it rare", rationale: "Truer to 1936; trucks stay a niche." }] },
  { id: "Q-R3-S1", idea: "plan", text: "May I run balance sims on the finished economy?", context: "Nothing here predicts win rates. A 400-game run would take roughly half an hour of this Mac's time (estimated from the 10-game unit test) and few tokens. Sims only show computer against computer, so they can't prove that a person's militia spam is beaten; your playtest does that.", options: [
    { label: "Yes: one run on the finished build, and one more after a single correction", recommended: true, rationale: "Removing Popular Resistance and adding upkeep both push the Republic down from 10 to 16 percent of wins, by an unknown amount." },
    { label: "Only after I've playtested", rationale: "Your feel first, numbers second." },
    { label: "No sims in Rev 3", rationale: "Playtests and the tenet checks only." }] },
];
const ids = new Set();
for (const q of out) { if (ids.has(q.id)) throw new Error("dup " + q.id); ids.add(q.id); const r = q.options.filter((o) => o.recommended).length; if (r === 0 || (!q.multi && r !== 1)) throw new Error("recommended " + q.id + " " + r); }
writeFileSync(new URL("questions.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(out.length + " questions");
