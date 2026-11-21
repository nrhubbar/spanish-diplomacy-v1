# M3 Rev 2 research: game design

> Internal research for the design review of `owner-notes.md`. Not player-facing.
> Researcher: `m3r2-research`, 20 Nov 2026.
> Tags as in `history.md`:
> - **[V]**: verified this session.
> - **[S]**: search snippet only.
> - **[P]**: from earlier project research.
> - **[C]**: from this repository's code or data.
> - **[U]**: unverified.
> - **[D]**: design reasoning with no external source.

Several of the owner's UI notes (4, 8–11, 15, 16) have few citable precedents. Fetches of the Paradox wikis and Civilization wikis failed (script-error pages, HTTP 402), so most of that material is labelled [D] instead of padded with weak citations.

---

## Note 1: no movement through hostile sub-territories

- **Paths of Glory.** Strategic redeployment may pass only through friendly-controlled spaces (13.1.5). Control changes when units enter a space, not when they pass near it (11.1.14, 12.7.9) [V] ([Paths of Glory rules](https://rulespal.com/paths-of-glory/rulebook)).
- **Bearing.**
  - **Supports** the owner. A path of friendly sub-territories is the standard legality test for both moves and supply.
  - The real fix is in the map data. Málaga has no friendly neighbour because coastal Granada is missing (see `history.md`, note 1). If that is fixed, the rule produces the historical corridor and its chokepoint [D].

## Note 2: balance by removing units

- **The current counts [C].** Ground units number Republic 16, North 14 and South 9. North includes three besieged or pinned garrisons (Oviedo ×2, Gijón).
- **Designer guidance on cuts versus constraints.**
  - Soren Johnson warns against piling on units ("the temptation to pile extra units and buildings ... onto an already complete design is strong") [P] ([Game Developer, 7 deadly sins](https://gamedeveloper.com/game-platforms/opinion-7-deadly-sins-for-strategy-games)).
  - Removing units is the simplest lever. A **constraint** that reflects history keeps flavour and fixes balance at once:
    - a static garrison on Mallorca;
    - Oviedo pinned until relieved;
    - a North ammunition shortage for the first N turns.

  [D]

## Notes 3 and 7: fighters and bombers as units with orders

### Precedents

- **Axis & Allies (air as pieces).**
  - Fighters attack at 3 and defend at 4. Bombers attack at 4 and defend at 1.
  - Air units must land in a territory that was friendly at the start of the turn.
  - "Only infantry, artillery, and tanks can capture hostile territories."
  - A strategic bombing raid is "a direct attack on an industrial complex". Each complex rolls one die per bomber, and damage is capped at twice the territory's value.
  - A raiding bomber "cannot participate in any other combat this turn" [V] ([Axis & Allies rules](https://rulespal.com/axis-and-allies/rulebook)).
  - **Takeaways:** air cannot take ground; a mission is exclusive for the turn; bombing damage is capped.
- **Europe Engulfed (air as a capped roll bonus).**
  - Ground-support air gives a hit bonus to one ground unit, only in Clear or Light Mud weather.
  - At most three ground units per side are supported in a round. Air can dogfight instead [P] ([Europe Engulfed rules](https://rulespal.com/europe-engulfed/rulebook)).
- **Hearts of Iron IV (air abstracted to regions).**
  - Wings fly missions over a strategic region, not a province: air superiority, close air support, interdiction, strategic bombing and naval strike.
  - Community sources put the enemy-air-superiority penalty at up to **35 percent** to defence and breakthrough at full superiority (0.7 percent per point above 50), plus up to 30 percent slower movement. Another guide gives different tiers, and values have changed between patches [S] ([Guild Order, Air Superiority and Ground Support](https://guildorder.com/games/hoi4/wiki/air-superiority-and-ground-support); [Steam discussion](https://steamcommunity.com/app/394360/discussions/0/3820780968130114965)). Treat this as low confidence. The HoI4 wiki and the dev diary pages failed to load.
- **Unity of Command and OCS.** Not re-verified this session. The UoC II manual is image-only [P].
- **Strategic Command and PTO/ETO-style air.** Not researched [U].

### History check (see `history.md`)

- Air decided battles locally: Guadalajara, the Ebro bridges, Asturias with 200 aircraft against 35.
- It did lift: the airlift.
- It interdicted roads and bridges: Guernica, and the Málaga road.
- City bombing was counterproductive.

### Current data [C]

- `air.raidTable` on the d20: 1–3 air eliminated, 4–10 nothing hit, 11–16 income cut, 17–20 building hit.
- `interceptRoll` is −2.
- Units exist for Republican fighters, Republican bombers and South Ju 52 bombers, plus two recon flights.

### Synthesis for note 3 [D]

- **Order types** (one per air unit per turn, Axis & Allies style):
  1. **Air superiority / Patrol** (fighters) over a territory. It intercepts enemy air there and cancels enemy Ground Support.
  2. **Ground Support** (fighters or bombers) on one territory's battle. It adds to that side's d20 score.
  3. **Interdict** (bombers) on a sub-territory or an edge. Enemy road or rail moves through it are blocked or cost more, and units there gain fatigue. This is what Guernica and the Málaga road actually were.
  4. **Raid** (bombers) on a sub-territory building or port, using the existing `raidTable`.
  5. **Airlift / Transport** (Ju 52, scenario-gated) moves a small unit between airfields.
  6. **Recon**, as today.
- **Die effect.**
  - In this table, **3 d20 points equal one odds column** [C] (`d20.note`: "Column k reads grade floor((score + 3k + 4) / 3)").
  - Ground Support of **+3 per wing** (one column), **capped at one or two wings per side**, matches Europe Engulfed's cap.
  - Fighters on Patrol cancel enemy support one-for-one.
  - Weather grounds air in mud or snow turns.
- **Air never takes or holds ground.**
- **Risk of over-detailing.**
  - Earlier project research recorded the owner's own "lets not muddy this too much" [P] (`military.md`).
  - Keep it to five or six orders, no air-to-air dogfight subgame, and no range bands beyond "airfield within N territories".

### Note 7

- Raid and Interdict lines should end at the **target sub-territory** (or the edge) [D].
- That is also where the historical effect lands: the bridge, the road junction, the port.

---

## Note 4: show sub-territory boundaries above 250% zoom

- No external source was fetched [D].
- Paradox titles use zoom-dependent detail: borders and labels change with the camera.
- Tying the sub-territory layer to a zoom threshold **and** to a Map Layers toggle (note 8) keeps the two consistent.

## Note 5: a building list per sub-territory

- Precedents for site-restricted builds:
  - Axis & Allies mobilises non-infantry only at industrial complexes [P] (`economy.md`).
  - Diplomacy builds only at home supply centres [P] ([Diplomacy rules](https://en.wikibooks.org/wiki/Diplomacy/Rules)).
  - The data already restricts factories: `capitalOnly` and `cityOnly` on `factory` [C].
- **Bearing: supports.** Two design choices [D]:
  - Make eligibility a **data predicate**: coastal for ports, city for factories, an airfield needs open terrain.
  - Or make it an explicit `buildable[]` list on each sub-territory.
  - A predicate scales to other eras (the owner's 7 Years' War and WW1 aim). An explicit list is easier to hand-tune.
  - A hybrid works: a predicate by default, overridable per sub-territory.

---

## Note 6: rail as a graph

### Precedents

- **Paths of Glory.**
  - Strategic redeployment is a points budget: one point per corps, four per army (13.1.2).
  - Routes pass only through friendly-controlled spaces (13.1.5) [V] ([Paths of Glory rules](https://rulespal.com/paths-of-glory/rulebook)).
  - This is "rail as a capacity pool", where the map's connectivity matters but individual track does not.
- **Hearts of Iron IV.**
  - Supply flows from the capital along railways to hubs. The railway level is the throughput bottleneck, roughly 15 at level 1 to 35 at level 5, limited by the weakest segment [P] ([Guild Order, HoI4 supply](https://guildorder.com/games/hoi4/wiki/supply-and-logistics); [Paradox dev diary](https://admin-forum.paradoxplaza.com/forum/developer-diary/hoi4-dev-diary-early-look-at-at-supply-and-the-coming-year.1466076/page-3)).
  - Rail is built and upgraded along edges, as the owner proposes.
- **Unity of Command.** Supply spreads along rail from sources. Truck sources are separate [P] ([UoC forum](https://unityofcommand.net/forums/viewtopic.php?p=19457)).
- **Reds! (Russian Civil War).**
  - Armoured trains "may only move, attack or retreat along contiguous rail hexes".
  - Rail movement is capped per phase [P] ([Reds! rules](https://rulespal.com/reds/rulebook), cited in `engine.md`).
- **Building rail in wartime.** Historically it took most of a year: the Vía Negrín's 91 km [P] (`map.md`). At two weeks per turn, a new rail edge should cost many turns. Upgrades to an existing edge can be cheaper [D].

### Synthesis [D]

- Store `edges[] {a, b, road: level, rail: level, terrainCost}` between **sub-territories**. A rail move needs a path of rail edges through friendly, uncontested sub-territories from the source to the destination territory.
- The adjacency table in `history.md` is a starting graph. Its I and U edges need a check against a 1936 map.
- Keep the visual the owner likes. Draw only edges with rail.
- **Keep it from becoming bookkeeping:**
  - No per-train accounting.
  - Capacity is a per-faction budget (Paths of Glory) or a per-edge level (HoI4), not both.
  - The planner should show the reachable set when a unit is selected, not make the player trace paths.

## Note 6a: roads, terrain and trucks

### Precedents

- **OCS (The Gamers).**
  - Units have three mobility types: **Leg, Truck, Tracked**. Each pays movement points per hex from the Terrain Effects Chart by type.
  - When a hex has several terrain types the costliest applies, "except when following a road".
  - Enemy zones of control stop Truck units unless negated [S] ([OCS 4.3, 6.0 Ground Movement](https://dornshuld.chemistry.msstate.edu/rules/ocs-4.3/6-0-ground-movement/)).
  - The full terrain chart was not read, so whether trucks are *prohibited* in mountains is [U].
- **COIN (A Distant Plain).** Lines of Communication are road spaces in their own right, and they carry economic value [S] ([A Distant Plain rules, GMT 2018](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/adistantplain/ADP-RULES-2018-FINAL_corrected.pdf)). This is the precedent for making roads first-class map data.
- **Combat Commander.** Not researched. It is tactical and not a close fit [U].

### History check

- Motorised columns did advance along the main roads: the Extremadura road, the CTV on the Málaga road.
- They bogged down in mud at Guadalajara.
- The northern mountains gave defenders strong positions.

See `history.md`, notes 6 and 6a.

### Synthesis [D]

- **Refines the owner's binary rule.**
  - "Only infantry crosses off-road" is the OCS model reduced to a ban. A cost difference is more flexible and fits other eras better:
    - Leg units: cost 1 per edge on roads, 2 off-road.
    - Motorised and armoured units: cost 1 on roads, prohibited or 3 off-road.
  - A binary ban is acceptable if the game has no movement points, and today it has one move per turn. In that case "no road edge, so no non-infantry crossing" is the simplest legible rule.
- **"Road plus trucks acts like rail" is a good, era-generic idea.** Paths of Glory, HoI4 and UoC all separate a fast strategic mode from tactical movement.
  - Make it a **Motor move** order: a two-edge road move for units stacked with a truck unit.
  - Cap it by the number of trucks, not by the edge.
  - It must not enter contested ground.
- **Terrain cost on edges** (pass, river, mountain) makes the northern mountains expensive, which the owner wants. Name the passes on edges so the map can show them: Somosierra, Alto del León, Pajares, Despeñaperros.

---

## Note 8: a Map Layers toolbar

- EU4 map modes and Civilization VI lenses are the usual references. Their wiki fetches failed this session [U].
- Victoria 3's UX dev diary calls nested tooltips essential. A search snippet lists customisable tooltip-lock behaviours [S] ([Victoria 3 Dev Diary #29, User Experience](https://forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-29-user-experience.1506484/page-5)).
- **[D]:**
  - Offer a small set of **exclusive modes**: Political (default), Terrain, Supply/Rail, Economy.
  - Add independent **toggles**: sub-territory borders, rail lines, road edges, order lines, unit counters, air ranges.
  - Keep each mode to one question ("who holds what", "where can I move by rail"). Too many modes is a known complaint.
  - Auto-switch to the relevant layer while giving an order. Civilization VI does this with the Settler lens: it activates when a Settler is selected [U] (fetch failed; recall).

## Note 9: queue and progress display in Territory Info

- Victoria 3 classes construction as a temporary expenditure, shown separately from fixed costs in its budget [S] ([Victoria 3 Dev Diary #12, Treasury](https://forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-12-treasury.1488588/)).
- **[D]:** one row per queue item, showing an icon, the name, a progress bar labelled "turn 2 of 4", and "+N queued" chips. Show the first item expanded and collapse the rest. Use the same component per sub-territory card (note 15) and in the Orders tab grouping.

## Note 10: turn summary grouped by player

- **[D]:** group by faction first, with headers in faction colour, then by event kind. That matches how Diplomacy adjudication results are read power by power [U]. Add a "Mine first" option.

## Note 11: Replenish UX and selection after an order

- **[D]:**
  - Batch orders need a stable **selection set** and an action that applies to all eligible members. Report ineligible ones with a reason ("fought this turn") instead of silently skipping them.
  - After an order is issued, clear the selection, so the next click starts fresh.
  - The owner's "select none" is the common RTS and Paradox convention for one-shot orders. Shift-click adds to the selection [U] (no source fetched).

---

## Note 12: dug-in magnitude on a d20

### What the code does today [C]

This section is a code reading. The scenario's `rules.dice` is `d20-graded`, so `usesD20` is true. `engine/works.ts` adds `perTurn` to `level`, and `engine/d20/modifiers.ts` applies `roll: -works.level`. The coordinator should still confirm what the owner actually sees on screen.

- `d20.modifiers.worksPerTurn` is 3 and `worksMax` is 9. Works grow by 3 per quiet turn.
- The counter badge (`WorksBadge`) and the label (`dugInLabel`: "Dug in +N") show the **works value itself**. So players see 3, 6 or 9 pips, at −3, −6 or −9 on the attacker's score.
- The legacy `combat.diggingIn` is `{perTurn 1, max 3}`. `CounterLayer` still reads `combat.diggingIn.max` for the badge's slot count.
- **The owner's 2/4/6 is therefore a softening of today's 3/6/9, not a buff.** Separating pips (level 1–3) from the roll (2/4/6) also fixes the display mismatch.
- The **Fortifications building** gives only `defence-roll +1`. That is weaker than one turn of digging, and is worth a look in the same change.

### Effect on the existing table [C]

Computed from `d20.table`, with die 1–20 and the score clamped to 0–20. Columns go from <1:1 to 6:1. One column equals 3 points.

| Works modifier | 1:1 take any ground / take all / attacker beaten | 2:1 any / all | 3:1 any / all | 4:1 any / all |
|---|---|---|---|---|
| 0 | 50 / 20 / 5 % | 65 / 35 % | 80 / 50 % | 95 / 65 % |
| −2 (owner level 1) | 40 / 10 / 15 % | 55 / 25 % | 70 / 40 % | 85 / 55 % |
| −3 (today level 1) | 35 / 5 / 20 % | 50 / 20 % | 65 / 35 % | 80 / 50 % |
| −4 (owner level 2) | 30 / 0 / 25 % | 45 / 15 % | 60 / 30 % | 75 / 45 % |
| −6 (owner level 3 = today level 2) | 20 / 0 / 35 % | 35 / 5 % | 50 / 20 % | 65 / 35 % |
| −9 (today level 3) | 5 / 0 / 50 % | 20 / 0 % | 35 / 5 % | 50 / 20 % |
| −10 (owner level 3 + popular resistance 3 + barricades 1) | 0 / 0 / 55 % | 15 / 0 % | 30 / 0 % | 45 / 15 % |
| −13 (today level 3 + popular resistance 3 + barricades 1) | 0 / 0 / 70 % | 0 / 0 % | 15 / 0 % | 30 / 0 % |

**The stacking case.** Works stack with the Republic's `popular-resistance` (+3 defence while it holds a city in the territory) and `barricades` (+1 when the defender holds a city) [C] (`d20.factionModifiers`, `engine/d20/modifiers.ts`).
- **Today.** A fully dug-in Republican city territory is at −13. Below 5:1, nothing takes the whole territory.
  - At 5:1 and 6:1, "any ground" is 100 percent, because those columns' lowest grades already give ground. Full take is only 15–30 percent.
- **Owner's proposal.** At −10, full take is possible from 4:1 (15 percent).
- This is the Madrid-type case, where the stalemate risk is worst.

### What the numbers mean

- **Today's maximum dig-in turns 2:1 into "almost never takes the whole territory" (0 percent).**
- **3:1 against full works takes all ground only 5 percent of the time.**
- That is a WW1-style stalemate engine, and it contradicts the 1936–39 record. Prepared lines fell in days to concentrated artillery and air: the Iron Belt in under two days, and the Ebro ridges in six counter-offensives (`history.md`, note 12).
- At the owner's 2/4/6, a 3:1 attack on full works still takes all ground 20 percent of the time, and some ground 50 percent of the time.

### WWI precedent

- In **Paths of Glory**, trenches cap at level 2. Each attempt is a die roll against the army's Loss Factor, not automatic.
- Trenches block flank attacks, and defenders in trenches may ignore a retreat by taking an extra step loss (12.5.3).
- Entering a level 2 space leaves an enemy level 1 trench. Attrition removes level 1 [V] ([Paths of Glory rules](https://rulespal.com/paths-of-glory/rulebook)).
- **WWI games cope with stalemate by making trenches costly to obtain and by giving attackers tools that cancel them (flanks, cards), not by capping the bonus low.**

### Designer view on d20 modifiers

- Large modifiers overwhelm a flat d20, and 5 percent steps are not felt [P] ([Blood and Spectacles, the false granularity of the d20](https://bloodandspectacles.blogspot.com/2017/03/wargame-design-false-granularity-of-d20.html)).
- On this table **only multiples of 3 change the column**. A −2 or −4 is a 10–15 percent swing that players will not perceive as a level. [D]: consider 3/6 with a cap at level 2, or keep 2/4/6 and let artillery and Ground Support (note 3) cancel works one-for-one.

### Bearing

- **Supports** the owner's direction: softer than today.
- **Refines:** tie the cap to terrain, so mountains and cities allow level 3 while open ground caps at 2. Give attackers counters: artillery, air and flanking from two sub-territories.

---

## Note 13: a factory also costs manpower

- **History supports it.** Catalonia's war industry used 50,000–80,000 workers, and conscription competed for them (`history.md`, note 13).
- **Design.**
  - "Several resources make better trade-offs, but only if each forces a distinct decision" [P] ([GameDev.net thread](https://www.gamedev.net/forums/topic/595844-multiple-vs-one-resource/?page=0)).
  - The project's earlier synthesis: the two distinct decisions here are "what to buy with money" and "where men go" [P] (`economy.md`).
  - A Manpower cost on a factory **creates exactly that tension**: men in the factory are not at the front.
  - [D]: make it one-time (construction labour) **or** upkeep (a permanent drain on Manpower income), not both. An upkeep version is more historical and more interesting, but it adds a line to the ledger (note 16).

## Note 14: control when one side leaves or is destroyed

- **Axis & Allies.**
  - A territory changes hands if "you have one or more surviving land units there". Air and sea units cannot take control.
  - "If all units on both sides were destroyed, the territory remains in the defender's control" [V] ([Axis & Allies rules](https://rulespal.com/axis-and-allies/rulebook)).
- **COIN.**
  - A faction controls a space when its pieces **exceed all other factions' pieces combined**. Otherwise the space is uncontrolled [S] ([A Distant Plain rules, GMT](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/adistantplain/ADP-RULES-2018-FINAL_corrected.pdf); [COIN overview](https://www.Wikipedia.org/wiki/COIN_(board_game))).
- **Paths of Glory.**
  - "Retreating does not change control". Control changes only when attacking units advance into the space (12.5.7), or when an enemy unit enters a space with no friendly fort (§2.0) [V] ([Paths of Glory rules](https://rulespal.com/paths-of-glory/rulebook)).
- **Diplomacy.** Supply-centre ownership changes only when a unit occupies it at the end of a Fall turn [U]. This is recall: the Wikibooks page was cited earlier for builds only.
- **Bearing: supports the owner.**
  - Contested status should be derived from **who has ground units present at end of turn**, not stored as a sticky flag.
  - Refinement, from Axis & Allies: if **both** sides are wiped out, the prior holder keeps it.
  - Refinement, from Paths of Glory: a sub-territory flips only when the remaining side's units are actually in it. An emptied sub-territory stays with its holder until entered.
  - Air units never count (note 3).

## Note 15: the Orders tab and the Territory Info pane

- **[D]:**
  - Separate "what I've ordered this turn" (Orders, with group-by) from "what is here" (Territory Info, with Units, Buildings, Recruit and Production tabs). That is the standard Paradox outliner versus province-window split [U] (Paradox wiki fetches failed).
  - Deep-linking from a sub-territory click to Buildings, with that card expanded, matches Victoria 3's goal of reaching detail through nested drill-down [S] (Dev Diary #29 snippet).
- **Cohesion risk.** Four tabs plus group-by modes plus expandable cards is a lot for one pane. Keep one queue component (note 9) and reuse it everywhere.

## Note 16: Funds and Manpower balance views

- Victoria 3: "There is one piece of technology we can not see this game without: Nested Tooltips", used "for getting more detailed breakdowns of numbers" [S] (Dev Diary #29, via search snippet).
- Victoria 3's weekly tally of income and expenses, applied to reserves or debt, with construction shown as a temporary expenditure [S] (Dev Diary #12, via search snippet).
- Victoria 3 removed red/green colouring from one balance view to make the system clearer [S] ([Victoria 3 Dev Diary #61, Data Visualization](https://admin-forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-61-data-visualization.1546730/page-3)).
- **[D]:**
  - One row per territory: gross, a contested deduction, and net. Example: "Andalucía +4 (−4 contested) = 0".
  - Then expense rows: upkeep, queued builds, replenishment.
  - End with a total that matches the chip exactly.
  - Make each row a nested tooltip down to the sub-territory.

## Note 17

Out of scope for this research.

---

## Unverified items (consolidated)

- HoI4 air numbers (community sources, conflicting).
- OCS truck prohibition in mountains.
- EU4 map modes and Civilization VI lenses (fetches failed).
- Diplomacy's control rule (recall).
- Strategic Command, PTO/ETO and Combat Commander (not researched).
- UI selection conventions (no source).
