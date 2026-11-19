# Milestone 2 Revision 6: Tasks

> Internal product and implementation plan. Nothing in this document, including research notes, balance decisions, or design rationale, may be imported into or rendered by the player-facing application.

**Baseline:** `main` at `cf3138d` (Milestone 2 Revision 5, one squashed commit).

**Inputs:** the product owner's Revision 6 brief (five items), the research report "Rev 6 Briefing" and the answers saved from it on 18 November 2026, `poc-web-grid-combat` (`src/soldier/soldier.ts`, `src/combat/combatResolution.ts`, `src/combat/results.ts`), `milestone-2-rev-5.md`, and `coding-principles.md`.

**Scope change:** Revision 5 listed strength-based combat, retreats, and unit-type combat values as non-goals (section 2). Revision 6 brings them into Milestone 2. Recruitment, reinforcements (new armies), and replacements (recovering lost men) stay in Milestone 3.

Milestone 2 is complete only when every workstream below is merged and the Definition of Done in section 6 holds.

## 1. Decisions

Answers from the research report. "Rec" means the product owner kept the recommendation; "Changed" means they chose differently or added a note that changes it.

### 1.1 Rivers (workstream A)

| ID | Decision | |
|---|---|---|
| R1 | Rivers are vector water in the map SVG, above the territory wash and below borders, labels, routes, and counters, so they keep the sea colour under every faction. | Rec |
| R2 | The eight main rivers (Ebro, Tajo, Duero, Guadiana, Guadalquivir, Júcar, Segura, Miño) at every zoom; major tributaries from the operational zoom. | Rec |
| R3 | Rivers are scenery. They have no rules effect. | Rec |
| R4 | Source: Natural Earth 1:10m rivers and its Europe supplement (public domain), vendored with checksums like the other map sources. | Rec |
| R5 | Main rivers carry Spanish labels ("Río Ebro") from the operational zoom. | Rec |

Rivers stop at the Spanish border. Widths are fixed in screen pixels (about 2.4 px main, 1.4 px tributary), tapering into the sea. Colour comes from the relief's shore water (`#76929c`) with a paler centre line for texture.

### 1.2 Names (workstream A)

| ID | Decision | |
|---|---|---|
| W1 | All 25 proposed water names, in three tiers (section 2.A). | Rec |
| W2 | Every map label is Spanish: water, rivers, neighbouring countries (Francia, Marruecos, Portugal), and territory and city names with accents (Andalucía, Castilla y León, Cádiz, Córdoba, Málaga). Menus, buttons, and reports stay in English. | Rec |
| W3 | Castilian forms throughout: Cataluña, País Vasco, Islas Baleares. | Rec |
| W4 | Accents are stored as `\u` escapes in JSON, so the ASCII-only source rule stands. The pipeline writes them; nobody types them. | Rec |
| W5 | Open seas curve along the coast and are widely letter-spaced; gulfs and bays sit straight. | Rec |

### 1.3 Turn flow (workstream B)

| ID | Decision | |
|---|---|---|
| T1 | After the last local player ends the turn, the game resolves at once and shows the turn results; Start Next Turn stays. The `ready-to-resolve` phase and the Reveal screen are removed. | Rec |
| T2 | The button says End Turn for every player, including when another local player still has to plan. | Rec |
| T3 | No confirmation and no hold count on the button. Armies without orders hold, as today. | Changed |

The handoff screen between local players stays; it keeps each player's orders private.

### 1.4 Briefing (workstream C)

| ID | Decision | |
|---|---|---|
| B1 | An "i" button under the zoom controls toggles a Briefing view in the in-map pane. | Rec |
| B2 | Contents: objective, live victory progress, first-move hint, how battles work, and map controls. | Changed (controls instead of a history note) |
| B3 | Hints are written per faction in `scenario.json`, for turn 1 only. | Rec |
| B4 | The Briefing opens by itself once for each human player on turn 1. | Rec |
| B5 | Hints give the player ideas and a choice, not a move to copy. They read like an intelligence report that ends in a question (section 2.C). | Changed (owner's note) |

### 1.5 Combat (workstreams D, E, F, G)

| ID | Decision | |
|---|---|---|
| C1 | A new ruleset, `m2-strength`, replaces `m2-movement` everywhere, including the test scenario. | Rec |
| C2 | The prototype's results table, with its 2:1 column corrected so each odds step is one result better for the attacker. | Rec |
| C2a | Attrition and demoralization are different and attrition is worse. Attrition removes men for good, from the strongest armies first. Demoralization halves values for a while, and falls on the weakest armies first. | Changed (owner's note) |
| C3 | Below 1:1, the roll takes -1 for each halving (1:2 is -1, 1:4 is -2). | Rec |
| C4 | Attack and defence values are set per unit type in `scenario.json`. Every army is its own instance with its own men, morale, and history; what happens to one regiment never happens to another of the same type. | Rec, with owner's note |
| C5 | Each army's values are rounded to the nearest whole number, minimum 1. What the counter shows is exactly what fights. | Rec |
| C6 | Demoralized armies fight at half values and cannot attack. They recover after one full turn without moving or being demoralized again; a new demoralization restarts the clock. | Changed |
| C7 | Digging in: +1 defence per quiet turn, up to +3, held by the territory for the faction that holds it. | Rec |
| C8 | Several factions attacking one territory are resolved without any order, by the proposal in section 1.6. | Confirmed 18 Nov 2026 |
| C9 | Head-on swaps between factions are a meeting battle: the stronger side attacks, with no digging-in bonus. | Rec |
| C10 | Armies moving into territory their faction controls always arrive and join its defence that turn. | Rec |
| C11 | Retreats are automatic: to the adjacent territory the army's faction controls that holds the most of its armies. With nowhere to go, the army surrenders. | Rec |
| C12 | Superseded by C2a: attrition takes men from the strongest armies first. | Changed |
| C13 | Lost men and lost armies never come back in Milestone 2. Recruitment and reinforcements arrive in Milestone 3. Only morale recovers (C6). | Changed |
| C14 | The turn report shows odds, the die roll, every modifier, and the result for each battle. | Rec |
| C15 | Highlighted destinations show the odds and the chance to take them before the order is committed. | Rec |
| C16 | Army sizes are researched from sources for 31 July 1936 and the armies rescaled to them. | Rec |
| C17 | The Republican edge is "popular resistance": +1 defence in a territory holding a city the Republic controls. It appears in battle breakdowns as a named modifier; nothing in the game calls it a balance change. | Rec |
| C18 | Computer players score each possible attack by its chance to take the territory and its expected losses, and prefer reinforcing threatened territory. | Rec |

### 1.6 Pushback on C8: battles with several attackers

**The owner's suggestion:** the attackers first fight each other, each using its attack value as its defence. Whoever is left attacks the defender together. If the defender is eliminated, the strongest attacker occupies the territory, and a tie sends every attacker back. The owner asked for pushback.

**Concerns:**

1. *Hostile factions would pool their strength.* The Republic, the Northern command, and the Southern command are enemies inside the game. If the survivors attack together, piling onto a territory someone else is attacking gets a faction a free partner. That rewards opportunism, not planning.
2. *Two rounds of dice per battle.* Every multi-party battle would roll once among the attackers and again against the defender. That doubles the luck in exactly the battles that are already hardest to read, and the report needs two stages to explain one result.
3. *The first round still needs an order.* With three attackers, "fight each other first" is either three pairwise battles, which raises the same ordering question, or an N-way table the prototype does not have.

**Proposal: independent battles against one snapshot.** No order is needed, and every roll is the ordinary two-sided roll players already understand.

1. **Defended territory.** Each attacking faction fights the defender separately, and every battle is computed from the same start-of-battle values, so the order never matters. The defender takes every result it receives: losses add up, any demoralizing result demoralizes it, and any result that removes it from the territory removes it.
2. **Who occupies.** Attackers whose battle succeeded (defender demoralized, exchange, or eliminated) claim the territory. With one claimant, it moves in. With several, the claimant with the greatest attack left after its own losses moves in, and the others bounce home without further loss. With a tie for greatest, every claimant bounces and the territory is left empty. That is the owner's tie rule.
3. **Empty territory, several factions entering.** The entrant with the greatest attack stands as the defender, using its attack as its defence with no digging-in bonus, and each other entrant fights it as in step 1. With a tie for greatest, everyone bounces, as today.
4. **Explanation.** A battle card with more than two sides gets an info tooltip listing these three steps with the actual numbers.

The owner approved this proposal on 18 November 2026.

**Data, not code:** the results table, the below-1:1 penalty, the digging-in step and cap, the demoralization factor, and faction modifiers such as popular resistance live in a `combat` block in `scenario.json`, so a WW2 scenario can tune them. The resolution algorithm stays in the engine as named, specified rules. Encoding the algorithm itself as data would make it untestable.

### 1.7 Delivery

| ID | Decision | |
|---|---|---|
| I1 | Map medallions plus larger engraved emblems for the turn report. | Rec |
| I2 | Restrained field-dispatch tone for flavor text. | Rec |
| I3 | Flavor text in English with Spanish place names. | Rec |
| P1 | Contract first, then parallel workstreams (section 2). | Rec |
| P2 | One integrator merges every stream, regenerates the visual baselines once, and keeps every commit green. | Rec |
| P3 | No balance target in Milestone 2. The soak test keeps its existing checks and the freeze budget (S2: under 20 percent of games freeze for five turns). Do not spend tokens iterating on balance: run the soak test at most twice per workstream, and read only its summary line. | Changed (owner's note) |

### 1.8 Interpretations to confirm

These follow from the owner's notes. The owner approved all of them on 18 November 2026.

- **Demoralization reach (C2a).** A demoralizing result demoralizes armies from the weakest up until the demoralized armies carry at least half of that side's combat value. A side with one army demoralizes that army. Demoralized defenders that must retreat move together.
- **Attrition size (C2a).** The losing side loses men worth the opposing side's combat value. One point is worth `fullStrength / baseValue` men of the army that pays, so a 740-man regiment rated 4-6 loses 185 men per attack point. Losses come from the strongest army first, and an army reduced to under one point is destroyed.
- **Demoralized movement (C6).** A demoralized army may move into empty or friendly territory, but not into a territory another faction holds. Planning offers only those destinations, and the computer player respects the same limit.
- **Head-on winner (C9).** The meeting battle's winner continues its move as if the other side were not on the road, and is then resolved against its destination like any other move. The loser bounces and takes its result.
- **Popular resistance (C17).** It applies when the defended territory contains at least one city the Republic controls at the start of the turn.

## 2. Workstreams

Each workstream is one agent on one branch (`m2r6-<letter>-<slug>`) in its own worktree and dev-server port. Each owns a set of files; editing a file another stream owns needs a note in the hand-off.

**Order:**
- D lands first.
- A, B, C, and H can start at once.
- E and F start when D merges.
- G starts its research at once and its data and computer-player work when E merges.
- I merges everything.

Every stream ends with lint, typecheck, unit tests, build, and `npm run test:e2e` passing on its branch, except for visual baseline diffs. Only I regenerates baselines.

### A. Map pipeline: rivers and names

**Owns:**
- `scripts/map/**` and `scripts/sources/naturalearth/**`
- `src/main/scenarios/spain-1936-07-31/map.json` and `src/main/scenarios/schema/mapSchema.ts` (plus the generated schema)
- `project/specs/map-package.md`, `assets/maps/**`
- a new `src/main/map/WaterLayer.tsx`
- water and river styles in `src/main/style.scss`
- the `name` fields of territories and cities in `scenario.json`

**Tasks:**
1. Vendor the Natural Earth 1:10m rivers and the Europe supplement subset for Iberia. Record their checksums in `scripts/sources/manifest.json`.
2. Project the rivers in `build-map.ts`, clip them to Spain, classify them as main or tributary, and write a `rivers` list to `map.json`: Spanish name, class, and simplified path in kilometres.
3. Add `waterLabels` to `map.json`: Spanish name, tier, and either a point or a curve. Use these 25 names:
   - **Overview:** Océano Atlántico, Mar Mediterráneo, Mar Cantábrico.
   - **Operational:** Golfo de Vizcaya, Mar de Alborán, Estrecho de Gibraltar, Golfo de Cádiz, Mar Balear, Golfo de León, Golfo de Valencia.
   - **Detail:** Golfo Ártabro, Ría de Ferrol, Ría de Arousa, Ría de Vigo, Bahía de Santander, Abra de Bilbao, Golfo de Rosas, Albufera de Valencia, Mar Menor, Golfo de Mazarrón, Golfo de Almería, Bahía de Algeciras, Bahía de Cádiz, Bahía de Palma, Bahía de Alcudia.
4. Spanish names for the context labels (Francia, Marruecos, Portugal), and Castilian, accented territory and city names in `scenario.json` (W2, W3). Ids do not change.
5. Draw rivers and water labels in `WaterLayer.tsx`, called from `VectorLayer.tsx`:
   - Rivers sit above the wash and below the borders.
   - Water labels sit below the territory labels, follow their tier, and use the existing rule that hides a label cut by the edge or covered by a counter.
   - River labels appear from the operational zoom.
6. Update the map spec, schema, `ATTRIBUTION.md`, and checksums. `npm run maps:build` must still reproduce every asset byte for byte.

**Acceptance:**
- A unit test checks that every river point lies inside Spain's land mask, using the coastline registration approach.
- Capture screenshots at all three zoom levels show sea-coloured rivers under every faction's wash.
- Every water name renders in its tier, and no label is clipped.
- The e2e suite passes with the accented names.

### B. Turn flow

**Owns:**
- `src/main/state/{session,coordinator,routing,gameSlice}.ts`
- `src/main/app.tsx`, and deleting `src/main/screens/RevealScreen.tsx`
- the End Turn label in `src/main/screens/OrdersScreen.tsx`
- `readme.md` play steps

**Tasks:**
1. Remove the `ready-to-resolve` phase, its route and guard, `RevealScreen`, and `revealAndResolve`. The last local player's End Turn resolves immediately and routes to the turn results (T1).
2. Rename Submit Orders to End Turn everywhere it appears, including the readme and tests (T2, T3).
3. Keep the handoff between local players unchanged.

**Acceptance:**
- State tests cover:
  - one local player: End Turn goes straight to results;
  - two local players: End Turn, then handoff, then planning, then End Turn, then results;
  - an all-computer game.
- e2e and capture specs no longer reference Reveal.
- Routing tests prove the old reveal path redirects.

### C. Briefing view

**Owns:**
- a new `src/main/screens/BriefingView.tsx`
- the "i" control in `src/main/map/CampaignMap.tsx` and its pane wiring in `MapPane.tsx`
- a victory-progress selector in `src/main/state/selectors.ts`
- a `briefing` block per faction in the scenario schema, spec, and data

C rebases on D for the schema file.

**Tasks:**
1. Add `briefing: { objective, firstTurnHint }` to each faction in the schema and spec. Write the Spain text below and the fixture's own.
2. The "i" button toggles a Briefing view in the pane. It contains:
   - the objective;
   - live progress for territories and cities against the victory thresholds (for Spain, 10 of 18 territories or 19 of 25 cities);
   - the hint on turn 1;
   - a "How battles work" card, which uses the odds example once E lands and is a placeholder before;
   - map controls, moved from Settings into the pane, with Settings keeping its copy.
3. Open the Briefing automatically once per human player on turn 1 (B4).

**Draft text** (B5: ideas and a choice, never a move to copy):

- **Republican Government.**
  - *Objective:* Hold the Republic together. You keep Madrid, Barcelona, Valencia, and the northern coast, but the rising has split the country in two. Win by holding 10 of 18 territories or 19 of 25 cities.
  - *Hint:* Reports from Toledo say columns are moving north out of Andalucía, and the northern command is gathering beyond the Sierra de Guadarrama. Madrid has two regiments. Do we keep both in the capital, or send one forward to meet the southern columns before they arrive?
- **Northern Insurgent Command.**
  - *Objective:* Link the insurgent zone and take Madrid. You hold Castilla y León, Navarra, Galicia, and Zaragoza; Republican Asturias and the Basque coast sit behind your lines.
  - *Hint:* Zaragoza's garrison reports regiments assembling in Barcelona, and Aragón is still contested. Do we secure Aragón first, or strike south toward Madrid while Barcelona hesitates?
- **Southern Insurgent Command.**
  - *Objective:* Bring the Army of Africa across the Strait and march on Madrid. You hold Seville, Cádiz, and Granada; the Legion and the Regulares wait in Ceuta and Melilla.
  - *Hint:* Every day the Legion and the Regulares stay in Africa, the Republic has more time to organize. Do we bring them across now, or push the Andalusian regiments north first and let Africa follow?

The objectives must not name the Republican edge (C17). Workstream G re-checks the numbers in the objectives after rescaling.

**Acceptance:**
- An app test covers opening, closing, and turn-1 auto-open, once per player.
- A selector test checks progress against `victory.ts`.
- axe reports nothing on the open view.
- The capture adds the Briefing at desktop and phone sizes.

### D. Combat contract (first; small)

**Owns:**
- `src/main/engine/types.ts`
- the `m2-strength` rules section of `project/specs/scenario-package.md`
- the `combat` block, unit-type values, and per-army strength fields in `scenarioSchema.ts` and the generated schema
- loader validation rules for them
- a new `src/main/presentation/outcomes.ts`, holding outcome keys only, no text

**Tasks:**
1. Types:
   - **Data:** `UnitTypeDefinition` gains `attack` and `defence`. `UnitDefinition` gains `strength` (men at the snapshot) and `fullStrength`; this replaces `approximateStrength`.
   - **State:** `UnitState` gains `strength`, and `morale: { demoralized: boolean; quietTurns: number }`. `GameState` gains `fortification: Record<TerritoryId, { factionId; level }>`.
   - **Outcomes:** a `BattleOutcome` records:
     - the sides, with each side's armies and values;
     - the column, die, modifiers, and result;
     - losses per army, armies demoralized, retreats, and surrenders;
     - who occupies.
     `TurnOutcome` gains it, plus reinforcement-arrived and recovered outcomes.
2. A `combat` block in `scenario.json`:
   - the results table (seven columns by seven rolls);
   - the below-1:1 rule;
   - digging-in `{ perTurn, max }`;
   - the demoralization factor;
   - faction modifiers, for example `{ factionId: "republic", when: "holds-controlled-city", defence: 1 }`.
3. Loader rules:
   - every army's type exists and has values;
   - `strength` is no greater than `fullStrength`;
   - the table is 7 by 7 and uses known results;
   - faction modifiers name real factions.
4. Spec: rewrite the ruleset section as `m2-strength`, with numbered rules covering:
   - movement, as today;
   - reinforcement priority (C10);
   - battles and values (C4, C5);
   - the table (C2, C3);
   - results (C2a);
   - several sides (section 1.6);
   - head-on (C9);
   - retreats and surrender (C11);
   - morale (C6);
   - digging in (C7);
   - no recovery of men (C13);
   - control (M7) and victory (M10), unchanged.
5. Outcome keys for the seven results and five statuses, used by F for icons and by H for text. They are fixed in section 2.1.

**Acceptance:**
- Loader tests cover every new rule.
- The fixture and Spain scenarios load with placeholder values. G replaces Spain's.
- The engine still compiles with a stub `m2-strength` resolver that reproduces today's movement rules, so D can merge green.

### E. Combat engine

**Owns:**
- `src/main/engine/{resolution,validation,victory,lookup}.ts`
- new `src/main/engine/combat.ts`
- `src/test/engine*.ts` and `src/test/consolidation.test.tsx` (engine part)

**Tasks:**
1. Dice:
   - one seeded stream per turn, `deriveSeed(game seed, turn, battle index)`;
   - battles indexed in a stable territory-id order, so replays match;
   - never `Math.random`.
2. Values:
   - per army: type value times `strength / fullStrength`, halved when demoralized, rounded, minimum 1;
   - sides summed across every origin of one faction.
3. The table, columns, below-1:1 penalty, overflow above 6:1 added to the roll, and clamping, all from the `combat` block.
4. Resolution inside simultaneous orders, in the spec's order:
   - reinforcements;
   - head-on meeting battles;
   - battles, including section 1.6;
   - results;
   - retreats and surrender;
   - control;
   - morale recovery and digging in;
   - victory.
5. Rule C6: demoralized armies' attack orders are invalid in validation.

**Acceptance:**
- A table test pins every column and roll.
- One test per numbered rule, including:
  - three-way battles;
  - empty-territory meetings;
  - ties;
  - head-on swaps;
  - reinforcement against an attack;
  - retreat with nowhere to go.
- A replay test checks that the same seed gives the same game.
- The soak test still runs; S2 is reported (P3).
- Branch coverage stays at or above 93 percent.

### F. Combat presentation

**Owns:**
- `src/main/map/{CounterLayer,RouteLayer}.tsx`
- `src/main/screens/{ResultPanels,OrderBuilder}.tsx`
- `src/main/presentation/{text,glyphs}.ts`
- counter, battle-card, and odds styles in `style.scss`

**Tasks:**
1. Counters show:
   - the current values;
   - the full values struck through in small type when they differ;
   - a strength bar and men (for example 370/740);
   - status badges for demoralized and dug-in levels 1 to 3.

   Counters must stay at or above 11 px text and pass the mobile WebKit target-size check.
2. Odds on highlighted destinations, for example "2:1, 50% to take", from an engine helper that E exports.
3. Turn report battle cards show:
   - the sides;
   - the values;
   - the column;
   - the die;
   - each modifier by name ("Dug in +2", "Popular resistance +1");
   - the result medallion and flavor text.

   Cards with more than two sides get the section 1.6 tooltip.
4. Map medallions for battle results on routes, replacing the bounce and loss icons where a battle happened.

**Acceptance:**
- Presentation tests cover each outcome key.
- axe reports nothing on cards and tooltips.
- Captures cover:
  - a full-strength counter;
  - a half-strength counter;
  - a demoralized counter;
  - a dug-in counter;
  - the odds on destinations;
  - a three-sided battle card.

### G. History, data, and computer players

**Owns:**
- `project/scenarios/spain-1936-07-31-research.md`
- army and unit-type data in `spain-1936-07-31/scenario.json`
- `src/main/ai/computerPlayer.ts` and its tests

**Tasks:**
1. Research strengths for 31 July 1936 from the existing sources (Nafziger, the Ministry of Defence study) and at least one more. Record each army's men with a citation and page in the research note. Unit types:
   - infantry regiment 4-6;
   - militia column 3-4;
   - colonial veterans (Legion, Regulares) 6-5;
   - security forces (Guardia Civil, Asalto) 3-5.

   Adjust the values with reasons in the note.
2. Rescale or split armies where the research requires it. Flag every judgement for the historical review (OD-3).
3. Popular resistance data (C17). The research note records it as a designed edge, internal only.
4. Computer player (C18):
   - scores attacks by take chance and expected losses;
   - reinforces threatened territory;
   - never orders demoralized armies to attack.

**Acceptance:**
- Every army has a sourced strength.
- Computer-player tests cover attack choice, reinforcement, and morale limits.
- One soak run reports S1 to S3. No balance tuning loop (P3).

### H. Art and words

**Owns:**
- `src/main/assets/outcomes/**` (new)
- the outcome text table in `src/main/presentation/outcomeText.ts` (new)

**Tasks:**
1. Final map medallions for the seven results and five statuses (demoralized, dug in with one to three pips, recovered, reinforcement arrived, surrendered), refined from the report's drafts. Same ring and body grammar as today's bounce and loss icons.
2. Engraved emblems for the turn report (I1), about 96 px. These are SVG drawn in the period engraving style, built from the medallion shapes, and must be legible in both themes.
3. Flavor text: two or three lines per result and status, in the restrained dispatch tone (I2, I3), with placeholders:
   - `{attacker}`, `{defender}`, `{army}`;
   - `{territory}`, `{city}`;
   - `{origin}`, `{retreat}`, `{losses}`.

   No atrocity imagery. Avoid words like "massacre".

**Acceptance:**
- Every outcome key from D has an icon, an emblem, and at least two lines.
- A test checks that every placeholder used is one the presenter supplies.

### I. Integration

**Owns:** merges, `e2e/baselines/**`, the Rev 6 decision log, and the final verify.

**Tasks:**
1. Merge in the order D, then A, B, C, H, then E, then F, then G. Each merge commit, or its immediate fix-up squashed into it, passes every check.
2. Regenerate visual baselines once, after the last merge. Review every changed image.
3. Run `npm run verify` from a clean checkout with `CI=1`, and the production smoke test.
4. Write `milestone-2-rev-6-declog.md` with every agent's decisions and assumptions.

### 2.1 Outcome Keys

Fixed now so D, F, and H can work in parallel:

- **Results:** `attacker-eliminated`, `attacker-attrition`, `attacker-demoralized`, `both-demoralized`, `defender-demoralized`, `defender-exchange`, `defender-eliminated`.
- **Statuses:** `demoralized`, `dug-in`, `recovered`, `reinforcement-arrived`, `surrendered`.

## 3. Shared Rules For Every Agent

- Work in your own worktree and branch, with your own `E2E_PORT`. Never touch the main checkout.
- Use the fast loop: `npm run e2e:capture` against your own dev server for screenshots, then lint, typecheck, and unit tests. Run the full e2e suite before hand-off.
- Every commit passes lint, typecheck, and unit tests. Gate on exit codes, not on grepping output.
- Do not regenerate visual baselines; only I does.
- Keep sources ASCII; accents in JSON are `\u` escapes.
- Map units are kilometres, and every on-screen size is in screen pixels.
- Use the seeded generator for every random number.
- Nothing from `project/` reaches the app, and nothing in the app mentions balance.
- Token budget: run the soak test at most twice, and read only its summary line. Do not paste large test output into hand-offs.
- Hand-off report:
  - what changed;
  - decisions and assumptions, numbered;
  - checks run, with results;
  - files outside your ownership that you touched;
  - screenshots to look at.

## 4. Risks

| Risk | Mitigation |
|---|---|
| Digging in at +3 recreates the Rev 5 stalemate. At 3:1 against a fully dug-in defender, the attacker takes the territory about one time in six. | E reports S2 from one soak run. If more than 20 percent of games freeze, I raises it with the owner instead of tuning. |
| Historical strengths make the Southern command dominant. | Popular resistance is the designed counterweight. There is no balance target in Milestone 2 (P3), so this is reported, not tuned. |
| Accented names break e2e selectors. | A updates the selectors in the same change; I checks after the merge. |
| Counter changes reopen the mobile WebKit target-size failure fixed in Rev 5. | F's acceptance includes that check on the mobile projects. |
| Turn reports grow long with battle cards. | Cards are collapsed by default after the first two; the summary line stays at the top. |

## 5. Not In Revision 6

- Recruiting new armies, or recovering lost men (Milestone 3).
- Support, convoy, or hold orders.
- Naval and air units.
- Terrain or river modifiers in battle (R3).
- Online play.

## 6. Definition Of Done

Milestone 2 is complete when:

1. Workstreams A to H are merged by I, with every commit green.
2. `npm run verify` passes from a clean checkout. The production smoke test passes against a served build.
3. The decisions in section 1, including section 1.6, are implemented, each with a test or a capture a reviewer can check.
4. The coding-principles rubric averages at least 4.5, with no row below 4, re-scored with evidence in the decision log.
5. One soak run reports S1 and S3 met and S2 under 20 percent, or reports the miss to the owner (P3).
6. The manual checks still open from Revision 5 (screen reader, 200 percent zoom, Windows high contrast) are done or explicitly deferred by the owner.
