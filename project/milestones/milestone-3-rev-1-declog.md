# Milestone 3 Revision 1 Decision Log

> Internal. Nothing here may be imported into or rendered by the player-facing application.

This log records the decisions and assumptions made while carrying out `milestone-3-rev-1-tasks.md`. Each one is numbered for reference.
- The product decisions (section 1 of the tasks document) come from the owner's answers.
- This log says how they were carried out, and records integrator defaults where the answers left a gap.
- Workers return their decisions in their checkpoint and hand-off reports; the integrator copies them here under the stream's heading.

## Process

**D1. Branches, worktrees and ports.** Integration happens on `milestone-3-rev-1`, in `../spanish-diplomacy-v1-m3r1`, on port 5300. Each stream is cut from the integration branch when it starts, on branch `m3r1-<slug>`, in the worktree `../spanish-diplomacy-v1-m3r1-<slug>`, with the port in tasks section 3.2. Agents are named in lower-kebab-case after their stream (`m3r1-contract`), and so are their reviewers (`m3r1-contract-review`) and the supervisor (`m3r1-supervisor`). The worktrees are created by the integrator with `git worktree add`, not by the agent tool's isolation option, so branch names follow this convention and cleanup follows the workspace README.

**D2. Baseline.** `milestone-3-rev-1` was cut from `m3-ideation` at `8cf06ea`, which is `main` (`d7f3006`) plus the Milestone 3 ideation documents, the three answer files, the UX mockups and `project/testing-screenshots.md`. `git diff main m3-ideation -- src e2e assets scripts package.json` was empty. `milestone3.md` is marked superseded by the tasks document.

**D3. `m2-strength` stays as a preset (E2).** The owner kept `m2-strength` as a preset (Q-MIS-d-1). The tiny-front fixture uses it, with the d6 table and none of the new systems, so the Milestone 2 engine tests keep testing real behaviour through the new phase pipeline. Spain uses `m3-modular`.

**D4. Supervisor and checkpoints.** The owner asked for a coordinator, a supervisor and N workers, with token checkpoints. It runs like this:
- Each worker stops at the end of each checkpoint in its stream and returns a short report.
- `m3r1-supervisor` reviews the report and the diff since the last checkpoint, then answers continue, redirect or stop.
- The integrator resumes the worker with that answer.
- Before hand-off, a read-only `m3r1-<slug>-review` agent checks correctness against the decisions the stream owns.

**D5. Several generals on one side (U6).** The owner's answers make a general a unit in his own right, whose effect applies to the army he is in. They do not say what happens with two generals in one army, or on one side of a battle. Default: only the best single general's +1 counts, per army for the rally and per side for the roll. Traits apply only for the general whose +1 counts. This is reported to the owner as an open question.

**D6. Fatigue on a mixed side (C6).** Fatigue belongs to units, but a battle rolls one die per side. Default: the side takes "Fatigued −2" when fatigued units (level 2) carry at least half of its attack value. This mirrors the half-of-value rule for demoralization.

**D7. Smaller defaults, to be tuned by the harness.** All of these are values in scenario data:
- Recruiting: at most 2 Recruit orders per territory per turn, plus 1 with a Factory.
- Rail: range in territories is twice the lowest rail level on the route.
- Ports: a port lands as many armies per turn as its level.
- Replenish: a Hospital gives +25 percent men per turn, and a Depot gives +25 percent cap.
- Frostbite: a unit that moves in Severe cold loses 5 percent of its men.
- Recon: reveals last one turn.
- Generals: a replacement general (after a death or a sacking) appears the next turn in the faction's seat territory, a new faction field in scenario data. A general rallies the demoralized units of the army he is in, or the units holding with him, at the end of the turn.
- Harness: the default turn limit is 66 turns, which is about April 1939.

## Streams

(Filled in as checkpoints and hand-offs arrive.)

**D8. Sub-territory ids, agreed before phase 0 starts.** These ids are shared by `m3r1-contract` (scenario data) and `m3r1-map-provinces` (geometry):
- The ids in `milestone-3-ideation/ux-pass/provinces.json`, as lowercase kebab-case province names: a-coruna, lugo, ourense, pontevedra, asturias, cantabria, bizkaia, gipuzkoa, alava, navarra, la-rioja, zaragoza, huesca, teruel, madrid, burgos, valladolid, leon, palencia, zamora, salamanca, avila, segovia, soria, toledo, ciudad-real, cuenca, guadalajara, albacete, badajoz, caceres, barcelona, girona, lleida, tarragona, valencia, castellon, alicante, sevilla, cadiz, huelva, cordoba, granada, malaga, jaen, almeria, murcia, ceuta, melilla, mallorca, menorca and ibiza.
- Asturias splits into `oviedo` (the capital pocket around the city) and `asturias` (the rest).
- Madrid splits into three: `madrid` (the capital, with the city and the south), `guadarrama` (the Sierra to the north-west) and `henares` (the Henares valley to the east, Alcala).
- Baleares is `mallorca` (its capital), `menorca` and `ibiza`.
- `m3r1-map-provinces` draws the splits; `m3r1-contract` writes the data for those ids.

**D9. Which stall measure H7 uses.** The harness reports two:
- "freeze": no winner by the turn limit (66 turns);
- "stalled": 5 or more quiet turns in a row, Revision 7's S2.

H7's 15 percent target is measured as **freeze**, because the owner's goal is games that end. "Stalled" stays in every report so results compare with Revision 7, which measured 58 percent.

**D10. AI data pointers.** The blunder chance is `/ai/blunderChance` (H6's word), and the per-faction profiles are `/ai/profiles/<factionId>`, a record keyed by faction id (E7). Both the contract and the harness use these.

**D11. Province data licence.** The ADM2 province boundaries vendored from geoBoundaries (revision `9469f09`) come from Spain's statistics office (INE), under the INE Data License, not CC BY 4.0 as the tasks assumed. INE allows reuse, commercial or not, on these conditions:
- the source is cited and the date given;
- the meaning is not distorted;
- nothing implies INE endorses the reuse.

`assets/maps/ATTRIBUTION.md` quotes the terms. The Settings attribution carries the required citation and the 2018 date. The Madrid split lines were traced from geoBoundaries ADM3 municipal borders (IGN, CC BY 4.0), which the existing IGN credit covers. Reported to the owner.

**D12. Sub-territory splits as drawn (P9, D8):**
- **Oviedo** is the municipality, about 187 km², an island inside `asturias`. It is the pocket held from 19 July to October 1936.
- **Madrid** splits at Talamanca de Jarama:
  - `guadarrama` is the Sierra Norte, the Sierra de Guadarrama and El Escorial: 62 municipalities, about 2,070 km². This is wider than D8's "north-west": it takes the whole Sierra front, Somosierra included.
  - `henares` is the Henares valley and the Jarama-Henares plain around Alcala: 26 municipalities, about 870 km².
  - `madrid` is the city, the west and the south.
- **Baleares** splits by island. Formentera goes with `ibiza`; Cabrera and Dragonera go with `mallorca`.

The outer edges of all sub-territories are the region rings, vertex for vertex. The paths are in a lazily loaded `assets/maps/iberia-sub-territories.svg`, so the initial chunk does not grow.

**D13. Process change: make it work, then make it right (owner, 19 November 2026).** The owner asked to start every feature stream at once and to make it green later in the merge cycle, rather than early, because the checkpoint cycle was turning over too soon. From here on the work runs in three passes:
- **Make it work:** every feature stream runs at once from the interim integration base, each in its own worktree. Workers build each feature end to end without stopping at checkpoints. They commit often and keep their progress note current. They stop only when blocked, or when they would need another stream's files. Per-checkpoint supervisor reviews are paused.
- **Make it right:** the last phase of this revision. Stream reviewers, the supervisor, full green checks (lint, typecheck, coverage of at least 90 percent, e2e, axe), visual baselines and the declog. All the section 5 production-bar items still apply; they move to this phase.
- **Make it fast:** the chunk budget and frame costs, after that.

**D14. Interim integration base.** Before the feature streams were cut, the integrator merged into `milestone-3-rev-1`:
- `m3r1-contract` through `0b7f1d5`: CP1 to CP3, plus the first CP4 commit (lazy packages and the budgets file);
- `m3r1-map-provinces`;
- `m3r1-sim-harness`.

Merge fixes:
- The topology file moved into the new scenario folder.
- `scripts/map/iberia-1936.ts` points at it.
- The generated borders, connection entries and city placement were copied into `scenario.json`, and a test keeps them equal.
- The harness was updated for the order and battle unions, and its blunder pointer set to `/ai/blunderChance`.

Lint and typecheck pass. Six harness tests that assumed blunders were "pending" are known red, and are left for the make-it-right pass. The contract's remaining CP4 work (cross-area hooks, open turn draft, per-viewer outcomes, UI slots, splits, blunder logic) merges into `milestone-3-rev-1` when it finishes. The feature streams then merge that branch in.

**D15. Contract fully merged.** `m3r1-contract` CP4 (`8b1b36b`) merged into `milestone-3-rev-1` with no conflicts. It brings:
- the cross-area hooks (`engine/hooks.ts`);
- per-area turn scratch;
- `viewFor`, `outcomesFor` and `ordersFor`, with `visibleSession` used by every screen;
- the UI slots;
- the hotspot splits (H9);
- `project/budgets.json` with `npm run budgets:check`;
- the blunder logic (H6).

Lint and typecheck pass. The same six harness tests as in D14 are red, as known. The feature streams were told to merge `milestone-3-rev-1`.

**D16. First paint still waits for the lazy scenario chunk (contract CT-50).** The initial chunk is 102.99 kB against the 155 kB budget, so the budget is met. `main.tsx` still awaits the registry before the first render. Moving that wait to the setup screen means reworking the app shell, which is deferred to the make-it-fast phase (D13).
