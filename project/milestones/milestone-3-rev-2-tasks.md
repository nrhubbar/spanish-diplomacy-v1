# Milestone 3 Revision 2: Tasks

> Internal product and implementation plan. Nothing in this document may be imported into or rendered by the player-facing application.

**Baseline:** `milestone-3-rev-2` cut from `main` at `93e4c71` (Rev 1 plus the Claude Code tooling), with the docs-only `m3r2-ideation` branch merged (`a782889`).

**Goal:** every decision below implemented at the production bar, in one revision, for the owner to playtest.

**Budget:** 5M tokens for the whole revision, all agents and the coordinator included. Rev 1 spent 9.27M. Each worker has a cap (section 4); at the cap it commits and hands back what is done and what is left.

**Inputs** (the source of truth; cite them):
- `project/milestones/milestone-3-rev-2-ideation/answers-r2.md`: the owner's answers, both rounds. A note overrides its tick, and the "Resolved" tables say how.
- `project/milestones/milestone-3-rev-2-ideation/closeout.md` and `images/r2-b-*.webp`: the locked rules, with numbers, and the approved UI. `content.md` and `images/r2-*.webp` are the first-round review. The `ux-pass/` mock code is a visual reference only.
- `project/milestones/milestone-3-rev-2-ideation/research/history.md`: the 1936 rail table, the passes and their sources.
- `project/coding-principles.md`, `project/specs/*.md`, `project/testing-screenshots.md`, and `CLAUDE.md`.

## 1. Decisions

### 1.1 Data model

| ID | Decision |
|---|---|
| D1 | **Typed entries.** Every discriminated union in the scenario and map JSON is written `{"@type": "<kind>", "@data": {...}}`. That covers control, unit effects, building effects, weather effects, trait effects, connections (land and sea) and the new link modifiers. The Zod schema converts each entry at parse time to today's internal `{kind, ...data}` shape, so the engine types don't change. The published JSON Schema (`spec:build`, input side) shows the `@type`/`@data` form; this has been checked with Zod 4.6.7. Both packages migrate: Spain and the tiny-front fixture. |
| D2 | **Links.** `links`: one record per pair of bordering sub-territories, `{"a", "b", "modifiers": [...]}`. Its modifiers are typed entries: `road` (`@data.level`: `"track"` or `"main"`), `rail` (`@data.level`: `"single"` or `"main"`), and `pass` (`@data.name`). No `road` modifier means no road. The scenario defines each modifier kind's effects in `linkModifiers`, also typed, e.g. `pass`: `noMotor: true`, `defenderRoll: -2`, `lostToFlanking: true`. Spain ships road, rail and pass only. |
| D3 | **Link data** comes from `research/history.md`'s 1936 table. Every inferred or unknown link is checked against the sources there before shipping, and each link's source or design note sits in the data like other values. The per-sub-territory `rail` level is replaced by the links. |
| D4 | **Explicit building lists.** Every sub-territory lists what it may build (`buildable: [...]`); there are no rule defaults. Madrid lists no port. |
| D5 | **Blunders removed** everywhere: `ai/blunder.ts`, `blunderChance` in the schema and scenario, the coordinator's `blunder` roll stream, the scenario note, the sim's `--blunders` option and default, and the tests that pin them. |

### 1.2 Rules

| ID | Decision |
|---|---|
| R1 | **Pockets.** In a contested territory, each side's armies belong to a pocket: a connected group of sub-territories that side holds. Armies leave only across that pocket's borders, and the P6 withdraw path through other pockets is gone. An arriving army joins the pocket on the side of the border it crosses. Uncontested territories work as today. |
| R2 | **Control flip.** At the end of each turn, a territory where only one side has ground armies flips whole to that side. If both sides are wiped out, the holders keep what they held. Aircraft never count. Every starting contested territory is checked against the turn-1 flip, and garrisons are added where history needs them (logged). |
| R3 | **Málaga** is sealed by land. A sea lane joins it to the Republic's ports: Andalucía to Murcia, entry ports Málaga and Murcia, unless the schema allows a lane inside one territory (Málaga to Almería). Log which. |
| R4 | **The North loses two units:** `north-la-victoria-28` (the Salamanca regiment) and `north-sierra-column`. Mallorca is unchanged. |
| R5 | **Move modes.** **March:** one territory; across a link with no road, only foot units (a unit-type flag in data). **Motor:** two territories along main roads, with trucks (today's truck rule caps it). It never enters contested ground and never crosses a pass. **Rail:** along rail links through ground your side holds, with range by the weakest level on the route (data `rangeByLevel`, default single 2 and main 4). **Sea:** as today. |
| R6 | **Passes.** No Motor across a pass, and no extra turn. A battle where every attacking ground unit crosses a pass gives the attacker −2, which stacks with dug-in. One attacking ground unit over a non-pass link cancels it (flanking). |
| R7 | **Building links.** New rail lines (many turns), rail upgrades (cheaper) and road upgrades are build projects on a link. Costs and turns are set in data, scaled to the existing catalogue, with design notes. |
| R8 | **Dug-in.** Pips 1/2/3; the roll takes −2/−4/−6; level 3 everywhere. Fortifications stay at +1. |
| R9 | **The factory** costs a one-time 6 Manpower on top of its current price. |
| R10 | **Air orders:** Patrol (fighters; replaces intercept and still intercepts raids), Ground Support (fighters or bombers), Raid (bombers) and Recon. There is no Airlift or Interdict. Rain and snow ground all air. Air never takes or holds ground. |
| R11 | **Ground Support** is +3 per aircraft unit, at most 2 per side, and **only one side gets it.** There is an **air battle** first when both sides have aircraft over the battle (Ground Support or Patrol), or one side's Ground Support faces the defender's AA. Each side rolls d20 + 2 per fighter + 1 per bomber, and the defender adds its AA as a plus. The higher total wins the air and its Ground Support applies; a tie means neither side's does. Nobody loses aircraft. Recon doesn't take part. Rolls come from their own seeded stream. |
| R12 | **The AI is able to use every action** a human can, but doesn't have to use each one. A coverage guard test lists every order kind, air mission, move mode and build project, and fails when the AI has no code path that can produce one. |

### 1.3 UI

| ID | Decision |
|---|---|
| U1 | **Top bar** above the map: date and readiness, then the Funds and Manpower chips; then **Last turn**, **Recruitment (n)**, **Building (n)**; then **End Turn**, orange-red with an hourglass icon; then a **hamburger menu** (Settings opens the existing `SettingsScreen`, Save is disabled with "Coming later", Exit Game asks to confirm). On a phone, End Turn sits in the collapsed pane bar, which is renamed "This turn". |
| U2 | **End Turn asks to confirm only when some armies have no order,** listing them, with **End anyway** and **Back**. |
| U3 | **The pane is a stack of views** with a back link: This turn (the default: orders given so far, grouped by type or region), Territory Info, Invade, Reinforce, Build, Recruit, Recruitment, Building and Last turn. One Redux slice owns it. |
| U4 | **Selection bar:** the pane's sticky footer is the action bar for the selection ("3 units selected · Move · Replenish · Entrench"). It replaces the floating "Give Selected Units Order" button. End Turn leaves the pane. After an order, the selection resets to **none** (bug, note 11). |
| U5 | **Quick actions:** right-click on desktop (a dropdown at the cursor) and long-press on a phone (a wheel) offer **Invade, Reinforce, Recruit, Build, Info**. Invade is offered on enemy or contested ground and Reinforce on friendly or contested ground. An unavailable action is greyed out, with its reason on hover. |
| U6 | **Invade pane:** a live odds bar that includes the air battle and the pass bonus; cards for every unit that can reach the target, grouped by source territory, each with a tick box, strength, dug-in chip and a move-mode chip (March, Motor or Rail, with an unavailable one struck through and its reason); "already here" units in your pocket; a **Ground Support** group of aircraft in range, at most 2; and **Order N units to invade**. **Reinforce** has the same layout for friendly ground, with "Defence after reinforcing" in place of odds. |
| U7 | **Reach.** While you give an order, reachable territories light up. An unreachable one says why only on **hover** (desktop), or in a **modal** card when tapped (phone). |
| U8 | **Order lines follow the links they use, in every mode, March included** (no more Bézier curves). Roads are drawn as quiet lines in the Logistics preset, main roads thicker; passes get a chevron; the rail drawing is unchanged. |
| U9 | **Global Recruitment and Global Building** views open from the top bar. They're grouped by territory (Building: then by sub-territory) and show the active item with a progress bar and turns left, the queue behind it, and paused contested queues marked as paused. Territory Info uses the same queue component (note 9), with Units, Buildings, Recruit and Production tabs. |
| U10 | **Last turn** shows last turn's report in the pane, grouped by faction with your own first. The turn report itself is grouped the same way. Battle cards show the air battle (both rolls, the winner, the support applied). |
| U11 | **Balance view** (from the Funds and Manpower chips): one flat list of territory rows, with a contested row's loss inline on that row, then expense rows (builds under way, Replenish, upkeep), and a total that matches the chip. |
| U12 | **Replenish:** one action for the whole selection, naming skipped units and why. |
| U13 | **Map Layers toolbar** at the bottom on desktop: the presets Orders, Logistics and Economy, then More, which holds the individual switches. Layers switch on automatically while you give an order. Sub-territory borders show past 250% zoom. |
| U14 | **Air on the map.** A raid line ends on the target sub-territory (bug, note 7). Selecting an aircraft counter offers only air orders, named Patrol, Ground Support, Raid and Recon. |

### 1.4 Not in Rev 2

- The Playwright suites (**`test:e2e`**, the visual baselines and the production smoke test). Don't run them to gate work and don't fix them; the owner handles them. The vitest jsdom flow tests (`app.test.tsx` and others) are unit tests here and must pass. When one pins old UI, update the test to the new UI; never keep old UI alive for a test.
- Rev 1's leftover review minors and its "make it fast" items.
- Balance sims, unless the owner asks.

## 2. Shared functions (one owner each; phase 0 stubs them)

Phase 0 writes each signature with a stub that compiles and is marked `TODO(<owner>)`. Owners implement; everyone else calls them and never re-implements them.

| Function | File | Owner | Used by |
|---|---|---|---|
| `reachFor(scenario, state, factionId, unitIds): ReadonlyMap<TerritoryId, Reach>`, where `Reach` is `{ok: true, mode, path: LinkStep[]}` or `{ok: false, reasons: UnreachableReason[]}` | `engine/network/reach.ts` | network-engine | movement validation, AI, Invade and Reinforce, hover notes, routed lines |
| `linkBetween`, `linkModifiers(link)`, `isPass(link)` | `engine/network/links.ts` | network-engine | combat (pass bonus), map |
| `pocketsOf(scenario, state, territoryId, factionId): Pocket[]`, `pocketOfArmy(...)`, `arrivalPocket(scenario, state, fromTerritory, toTerritory, factionId)` | `engine/partition/pockets.ts` | pockets-control | withdraw, retreat, control, Invade and Reinforce, AI |
| `airBattle(input, rolls): AirBattleResult` and `airBattleOdds(input): {attackerWins, defenderWins, tie}` | `engine/air/airBattle.ts` | air-rules | combat resolution, odds estimate, Invade pane, report |
| The pane-stack slice (`pushView`, `popView`, `resetPane`, the view union) | `state/paneSlice.ts` | ui-shell | every UI stream |

The order union and the report events change in phase 0, all at once: `AirMission` `intercept` becomes `patrol`, `support` is allowed for fighters, new link-build projects are added, and new events `air-battle`, `pocket-cut` and `territory-flipped` are added.

## 3. Workstreams

### 3.1 Roles

- **Coordinator (the main session):** owns this document, the declog (`milestone-3-rev-2-declog.md`), merges into `milestone-3-rev-2`, the token ledger and the reports to the owner.
- **Supervisor (`m3r2-supervisor`):** one persistent read-only agent. When a worker hands back early (it's stuck, at its cap, or out of scope), the coordinator sends it the report and the diff summary. It answers **continue**, **redirect** (with what to change) or **stop**, and says when to call the principal engineer.
- **Principal engineer (`m3r2-principal`):** on call. A worker hands back when it has failed to reach coverage on a file three times. The principal engineer then refactors that file: logic moves out of components into pure functions beside the existing `src/main/presentation/` modules (or `state/planning/`), with unit tests, leaving the components thin. It also handles cross-stream design snags the supervisor escalates.
- **Workers (`m3r2-<slug>`):** one per stream, on branch `m3r2-<slug>` in `../spanish-diplomacy-v1-m3r2-<slug>`, cut from `milestone-3-rev-2` when the stream starts. Each runs build, test and fix on its own, **commits on its own branch** (committing is part of the job; pushing is not), and writes a short `project/milestones/m3r2-progress/<slug>.md` covering what's done, decisions made, checks run and what's left.
- **Reviewer:** the `diff-reviewer` agent, once per stream, on that stream's diff only, before it merges.

### 3.2 Phases

| Phase | Stream | Port | Cap | Starts |
|---|---|---|---|---|
| 0 | `contract` | 5321 | 450k | at once |
| 0 | `ui-shell` | 5322 | 400k | at once |
| 1 | `network-engine` | 5323 | 400k | after `contract` merges |
| 1 | `pockets-control` | 5324 | 300k | after `contract` merges |
| 1 | `air-rules` | 5325 | 350k | after `contract` merges |
| 1 | `ui-economy` | 5326 | 350k | after `ui-shell` merges |
| 2 | `map-orders` | 5327 | 400k | after `network-engine` and `ui-shell` merge |
| 2 | `map-layers` | 5328 | 300k | after `network-engine` merges |
| 2 | `ai` | 5329 | 300k | after `network-engine`, `pockets-control` and `air-rules` merge |
| 3 | close-out (coordinator, with the principal engineer as needed) | 5320 | | after all merge |

At most four workers run at once.

### 3.3 Streams

**`contract`** owns `src/scenarios/**`, `src/main/scenarios/**` (schema and loader), `engine/types*`, the order union, the report-event union, `project/specs/scenario-package.md` and `map-package.md`, `src/sim/args.ts` (blunders), `ai/blunder.ts` (to delete) and the stubs from section 2.
- It does D1–D5, plus the data for R3, R4, R5 (the foot flag, `rangeByLevel`), R6 (the `pass` modifier effects), R7 (project costs), R8 (the dug-in values) and R9 (the factory's Manpower).
- It runs the turn-1 contested check (R2) and adds garrisons where needed.
- It updates every existing test the migration touches. Behaviour stays unchanged apart from the data changes listed.
- **Must not** implement rules owned by a later stream.

**`network-engine`** owns `engine/network/**`, `engine/movement/**`, the link build projects in `engine/economy/**`, and the pass modifier in combat (a hook, not a rewrite of `combat/**`).
- It does R5, R6 and R7, plus `reachFor` with its reasons, and the link path every order line draws.
- Rail capacity rules from Rev 1 (departures and landings) stay.

**`pockets-control`** owns `engine/partition/**`, `engine/control.ts`, `engine/retreat.ts` and the withdraw path.
- It does R1 and R2, plus the Málaga test.
- It copies `src/test/m3r2-probe/engineBugs.test.ts` from branch `m3r2-probe` as its acceptance tests for notes 1 and 14, then makes them pass.

**`air-rules`** owns `engine/air/**`, the air and support hooks in combat, `engine/works.ts` (dug-in) and the factory cost in `engine/economy/**`.
- It does R8, R9, R10 and R11, plus the air-battle report events and the battle card's air section (`presentation/battle*`, `screens/report/` battle card only).
- It copies `src/test/m3r2-probe/worksPips.test.tsx`.

**`ai`** owns `src/main/ai/**`.
- It does R12, and teaches the AI March, Motor and Rail with passes, pocket exits, joint attacks across source territories, factories, link builds, Patrol, and fighters on Ground Support, weighing the air battle.
- **The AI should be able to, not required to:** don't force builds that aren't useful.

**`ui-shell`** owns `components/GameHeader.tsx`, `components/header/**`, `state/paneSlice.ts`, the pane frame (`screens/MapScreenFrame.tsx` and `OrdersScreen.tsx`), `OrderCommand.tsx`, `ArmyPicker.tsx`, `state/planning/selection.ts` and `orders.ts`, and `screens/report/**` (grouping).
- It does U1, U2, U3, U4 (including the selection-none bug) and U10 (Last turn and grouping; the battle card's air section belongs to air-rules).
- It copies the note-11 cases from `src/test/m3r2-probe/uiBugs.test.tsx`.

**`ui-economy`** owns `screens/pane/**` (Territory Info), new `screens/queues/**`, the resource chip detail (`screens/report/Treasury.tsx` if that's where it lives; otherwise `header/` resource chips, coordinated through the slice), and `state/planning/recruitment.ts` (Replenish).
- It does U9, U11 and U12. It registers its views in the pane slice.

**`map-orders`** owns new `screens/actions/**` (the quick-action menu and wheel, and the Invade and Reinforce panes), the reach hover and modal, and the order-line rendering in `map/routes.ts` and `map/RouteLayer.tsx`.
- It does U5, U6, U7 and U8 (lines). It uses `reachFor`, `pocketsOf`, `airBattleOdds` and the pane slice.

**`map-layers`** owns `map/layers/**` (except the rail drawing, which stays), `map/MapLegend.tsx`, the layers toolbar and the zoom border rule.
- It does U8 (roads drawn, pass chevrons), U13 and U14.
- It copies the note-7 cases from `src/test/m3r2-probe/uiBugs.test.tsx`.

**Files outside a stream's list:** a one-line wiring change is fine. Anything bigger is a hand-back.

## 4. Rules for every worker

- **Read only what you need.** Use the TypeScript language server (go to definition, find references) and grep. Don't read whole folders.
- **Checks before hand-off:**
  - `npm run lint`;
  - `npm run typecheck`;
  - `npx vitest run` on the folders you touched;
  - then once, the full `npm run test:unit`.
  - No `test:e2e`, no baselines, no sims.
- **Coverage is per file.** Every file you add or change meets 93% branches and 92% lines and functions in the coverage report. A file that was already below doesn't go lower. On a third failed attempt at one file, stop and hand back, naming the file, so the principal engineer can step in.
- **Stuck:** the same failing check three times without progress means stop and hand back.
- **Cap:** near your cap, commit what works, write the progress file and hand back with what's left.
- **Player-facing text** is plain English, with no ids or rule codes.
- **Git:** stage by path; never use bare `git stash`; commit on your branch; don't push; don't merge other branches in (the coordinator does that).
- **Hand-back report:** under 300 words, covering the commits, the checks with results, any coverage shortfalls by file, the decisions you made, and what's left.

## 5. Production bar (the close-out checks)

- `npm run lint`, `typecheck`, `test:unit` (with the coverage gate) and `build` are all green on `milestone-3-rev-2`.
- Every R and U decision above is implemented, or listed in the sitrep as not done, with the reason.
- The AI coverage guard passes.
- A new game runs headless from start to finish with no errors: one short `npm run sim -- --games 1` smoke, which is a run, not a balance study.
- Fresh review captures (`regen-screenshots`) back a sitrep with the token ledger.
