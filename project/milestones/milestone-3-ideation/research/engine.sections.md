<!-- idea:11 -->
## Idea 11: Headless balance harness

### Summary
A test platform that runs 10, 200, or 1000 all-computer games headlessly and in parallel to evaluate balance and outcomes.

### Findings
- **Today's soak is fast but blind.** One run of `src/test/soak.test.ts` (200 seeded Spain games, 30-turn cap, plus three small runs) took 2.99 s in Vitest (import 2.66 s, which holds the 200-game run because it is called in the `describe` body) and 3.70 s wall clock on one core of a 10-core machine. That is **about 12 ms per game**, so 1000 games take about 12 s on one core. It reports only totals: no per-game rows, no intervals, no battle statistics, no output file. Vitest parallelises by file, so the soak always uses one core ([Vitest pool docs](https://vitest.dev/config/pool)).
- **Parallelism is headroom, not the urgent gap.** It pays off once Milestone 3 rules slow turns, games run longer, or we sweep rule variants.
- **Running TypeScript outside Vitest.** Node 24 strips types but requires explicit file extensions and ignores `tsconfig.json`; it points to `tsx` for full support ([Node.js TypeScript docs](https://nodejs.org/api/typescript.html)). Our `src/main` imports are extensionless and `builtInSources.ts` uses Vite's `import.meta.glob`, so a plain `node` CLI cannot import the engine today. Bundling a Node entry with Vite (already a dependency) avoids both problems (from recall, unverified).
- **How studios balance with data.** Mega Crit logged every decision in Slay the Spire, read pick rates and presence in winning decks, grew from 3 to 90+ graphs, and required a specific question for each analysis ([Game Developer](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)). Hearts of Iron IV has a `-hands_off` AI-only mode that dumps monthly history and logs declared test conditions as pass or fail ([HoI4 1.9 dev diary](https://devtrackers.gg/heartsofiron/p/95e1d0e2-dev-diary-1-9-patchnotes-and-modding-updates)). Research simulators balance Hearthstone and Dominion by playing AI agents against card definitions ([Evolving the Hearthstone Meta](https://arxiv.org/pdf/1907.01623); [Dominion card sets](https://typeset.io/pdf/evolving-card-sets-towards-balancing-dominion-2zsk143ap7.pdf)), and need a stated target to search for ([Metagame Autobalancing](https://arxiv.org/pdf/2006.04419v1.pdf)).
- **Designers' limits.** Cole Wehrle tuned Root with programs that "played through different situations", but a simulation "can only answer questions you can pose precisely" and "cannot tell whether a game is fun" ([Engines of Our Ingenuity](https://engines.egr.uh.edu/episode/3374)); chart distributions, because averages hide outliers ([Skeleton Code Machine](https://www.skeletoncodemachine.com/p/python-game-design)).
- **Intervals (Wilson, 95 percent, [formula](https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval)).** Southern wins 13 of 103 decided games: 7.5 to 20.4 percent, a real weakness. Republic 42 (31.8 to 50.4) versus Northern 48 (37.3 to 56.2) is noise. With half of games decided, a 13 percent share spans 1.7 to 57 percent over 10 games, 7.8 to 20.8 over 200, 10.4 to 16.2 over 1000. Detecting a freeze drop from 58 to 48 percent needs about 390 games per variant (unpaired); 58 to 53 percent needs about 1,550.
- **Elo** rates players, not sides (from recall, unverified): with one computer player on every side, win share per faction with an interval is the measure; Elo suits a later AI ladder.

### Fit with today's engine
- No M-rule changes. A game is already a pure function of scenario, seed, and computer-player weights (M26 seeded streams; the R3 determinism test).
- Move the per-game loop from `src/test/soakRun.ts` to a pure `src/main/sim/playGame.ts` returning one `GameSummary` per seed (winner, length, freeze turn, battles, M16 results by odds column, losses per faction, first-turn moves), plus `src/main/sim/summarize.ts` (aggregates and Wilson intervals). `soak.test.ts` keeps its 200-game S1-S3 checks on the same core.
- New `scripts/sim/cli.ts` and `scripts/sim/worker.ts`, `vite.sim.config.ts` (SSR build to `build/sim-bin/`), `npm run sim -- --games 1000 --workers 8 --scenario spain-1936-07-31 --variant v.json --out build/sim/`. Seeds sharded round-robin over `worker_threads`, merged by seed, so the report is identical for any worker count (tested).
- Packages load through the existing `createScenarioRegistry(sources)` injection; asset checks need only path keys.
- Report: `summary.json`, `games.csv`, and an HTML page; metadata includes git SHA, scenario hash, ruleset and modules, AI profile, seed range, and variant patch.
- Variants are JSON patches over the scenario (for example `combat.diggingIn.max: 2`) run on the same seeds, so A/B comparisons share dice where the games agree.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Vitest only | Keep the soak in Vitest; split seeds over several soak files so the pool runs them in parallel | No new tooling; reports and ad-hoc runs awkward; slows `npm test` | Low | Any scenario Vitest can load |
| B. Vite-bundled CLI with worker threads | `npm run sim` builds a Node bundle with Vite, runs games across workers, writes JSON, CSV, HTML | No new dependency; same resolver as the app; one-second build step | Med | Any scenario and ruleset; variants by JSON patch |
| C. tsx CLI with worker threads | Same CLI run through `tsx`, packages read with `fs` | No build step; new dev dependency; worker loader behaviour unverified | Med | Same as B |
| D. Defer | Keep the 200-game soak as is | Free now; Milestone 3 balance work stays blind | Low | None added |

**Recommendation:** Option B, with the pure game core shared by the CI soak and the CLI, paired-seed variants, and Wilson intervals on every share. It reuses tooling we already trust and makes balance questions answerable in seconds; parallelism is a cheap bonus that matters once Milestone 3 slows turns down.

### Widget
<!-- widget:harness-estimator -->
Estimates wall time for a run from games, turns, workers, and milliseconds per game (default 12 ms, measured on this machine's one soak run), and shows the 95 percent Wilson interval for a faction's win share at that game count.

### Mockup
<!-- mockup:harness-report -->

### Questions
<!-- questions:11 -->

<!-- idea:13 -->
## Idea 13: A generic engine, game modes as data

### Summary
Keep the engine generic so new eras (WW1, WW2, Russian Revolution, Seven Years' War, Napoleonic) are mostly new JSON and images, with a `spain-civil-war-scenario.json` holding this game's details, possibly including AI strategies, resource types, and unit types.

### Findings
- **Named modules with parameters is the proven pattern.** Battle for Wesnoth defines abilities and weapon specials as named tags (`heals`, `leadership`, `drains`, `slow`, `poison`, `firststrike`) tuned by keys such as `value`, `add`, `multiply`; an unknown tag does nothing, which implies the behaviour for each name is coded in the engine ([Wesnoth AbilitiesWML](https://wiki.wesnoth.org/AbilitiesWML)). Ludii, a general game system, writes games as "ludemes" ([arXiv 1905.05013](https://arxiv.org/abs/1905.05013v3)) whose language is generated from the class hierarchy of its source code ([Ludii overview](https://ar5iv.labs.arxiv.org/html/1907.00240)): even the most general system names coded parts rather than encoding algorithms as data.
- **AI weights in data are proven too.** Paradox scripts weight AI choices with `ai_will_do` factors that multiply per applicable modifier (forum threads seen in search results, not opened, e.g. [How do weight factors work](https://admin-forum.paradoxplaza.com/forum/threads/how-do-weight-factors-work.939900)); HoI4 lets modders add AI strategies that override behaviour ([HoI4 1.9 dev diary](https://devtrackers.gg/heartsofiron/p/95e1d0e2-dev-diary-1-9-patchnotes-and-modding-updates)). Our `computerWeights`, `offensiveWeights`, `stakeWeights`, and `victoryAlarm` are numbers in code today.
- **One engine across eras works when differences are units and parameters.** Strategic Command WWI "runs on the same upgraded engine" as the WWII games, adding unit types, trench research, mines, and artillery-spotting recon bombers ([Steam](https://store.steampowered.com/app/1096930/Strategic_Command_World_War_I/)).
- **Each era adds one to three algorithms.** WW1: replacement points, strategic redeployment by rail, trenches (Paths of Glory sections 9.4, 13.0, 11.2, [rulespal](https://rulespal.com/paths-of-glory/rulebook)). Russian Civil War: armoured trains that "may only move, attack or retreat along contiguous rail hexes", rail movement capped per phase, rail as supply lines ([Reds! rulebook](https://rulespal.com/reds/rulebook)). Seven Years' War: logistics phases with supply, sieges, and winter quarters ([Frederick II](https://www.grognard.com/info1/frederickII.doc); [Clash of Monarchs](https://rulespal.com/clash-of-monarchs/rulebook)). Napoleonic: generals with command ratings capping corps, and attrition when a hex holds more corps than its forage value ([campaign rules](https://dantes-game.blogspot.com/p/napoleonic-wars-campaign-rules.html); [The Sun of Austerlitz](https://rulespal.com/the-sun-of-austerlitz/rulebook)). WW2: air missions, oil, production, exploitation moves (from recall, unverified).
- **The tension, for the owner.** `coding-principles.md` says "Avoid premature generic abstractions"; Revision 6 section 1.6 kept the resolution algorithm in code because "encoding the algorithm itself as data would make it untestable". The owner's north star wants eras swappable by data, but hedges ("if our engine is flexible enough", "the other game types will come later"). The middle ground: **parameters in data; named rule modules in code, selected by data, each with its own spec rules and tests.** A new era is new JSON plus at most a few new modules, never an engine fork, and data never holds formulas.

### Fit with today's engine
- Already data: unit values, the combat block (table, below-1:1, digging in, demoralization, faction modifiers), victory shares, factions, board, starting armies. The loader already composes and validates once (L1-L13).
- Moves into data: AI profiles (the four weight constants in `src/main/ai/`, per faction), turn calendar (start date, 14-day turns; no field exists today), resource types, costs and yields, weather tables, unit costs, training turns, and unit effects as a coded list of effect kinds.
- Becomes named modules selected by a new `rules` object: dice and resolution (`d6-table`, `d20-graded`), economy, recruitment, weather, supply, movement, partition. `m2-strength` survives as a preset of those modules.
- Files: `scenarioSchema.ts` and the generated `scenario.schema.json`, `engine/types.ts` (`supportedRulesets`), `loader.ts` (new checks that modules and data blocks match), `ai/computerPlayer.ts`, `ai/offensive.ts`, `ai/assessment.ts`, `project/specs/scenario-package.md` (spec version 2).
- M-rules: M15's die range and row clamp become per dice module (d6 rows 0..6 today); M25 is the rule recruitment relaxes; M26 gains steps for the selected modules (income, recruitment, weather). `map.json` needs a `unitSymbols` entry for every new unit type (L10) and new icons for resources and weather.
- File layout: today one folder per package (`src/main/scenarios/spain-1936-07-31/scenario.json` + `map.json`), found by the glob `*/scenario.json` in `builtInSources.ts`. For Milestone 3, that `scenario.json` plays the role of the owner's `spain-civil-war-scenario.json`, gaining a `rules` section. When a second start date (1937, 1938) is planned, split it into `src/main/modes/spain-civil-war/mode.json` (rules and board) plus `starts/1936-07-31.json`. Using the owner's literal file name instead means changing the glob. The loader composes any layout into today's `Scenario` type, so the engine never sees the difference.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Parameters in data, named modules in code | Data selects coded modules and tunes them; modules have spec rules and tests | Testable; a new era may need a few new modules | Med | High for numbers, Medium for new mechanics |
| B. Rules as data (a small rules language) | Formulas, triggers, and effect scripts in JSON | Eras swap without code; untestable, hard to explain in battle reports; rejected in Revision 6 section 1.6 | High | Highest on paper |
| C. Status quo, generalise on demand | Keep Milestone 3 mechanics in code; move things to data only when a second mode needs them | Cheapest now; Spain-specific assumptions creep into code; AI weights stay constants | Low | Low |

**Recommendation:** Option A, put to the owner as Q-DATA-1: it honours both the north star and the "no premature abstraction" principle, because only things that are already numbers move to data, and every algorithm stays a named, tested module. Move AI weights into data now; it costs little and lets the harness A/B them.

### Widget
<!-- widget:data-or-code -->
Toggle each game element between data, named module, and code to see the estimated schema fields, test surface, and which future eras the engine could then load without an engine fork; estimates are from this cluster's era check.

### Questions
<!-- questions:13 -->

<!-- mismatch:d -->
### Mismatch (d): A new ruleset id and schema fields
Today `ruleset` is the literal `"m2-strength"` and `supportedRulesets` has one entry. Milestone 3 adds independent rule areas (dice, economy, recruitment, weather, supply, movement, sub-regions); one id per combination multiplies, and one id for all of Milestone 3 forces every future scenario to take everything. Proposal: `"ruleset": "m3-modular"` names the base pipeline (simultaneous orders, M1-M27 as amended), and a new `rules` object picks one named module per area, for example `{ "dice": "d20-graded", "economy": "funds-manpower", "recruitment": "capital-training", "weather": "seasonal-zones", "supply": "none", "movement": "one-step", "partition": "none" }`. `m2-strength` stays as a preset meaning all-`none` plus `d6-table`, so the harness can compare old and new rules. New blocks: `calendar { start, turnDays }`, `resources[]`, `unitTypes[].cost / trainingTurns / effects[]`, `ai.profiles[]` and `ai.factionProfiles`, plus the economy and weather blocks other clusters define. New loader rules: L14 module companions present, L15 data blocks match their module, L16 AI profiles resolve. Bump the scenario spec to version 2; migrate both packages (Spain, tiny-front) in one commit and drop version 1, since no saved games exist.

<!-- mismatch:e -->
### Mismatch (e): Balance: the freeze rate and the Southern command
The freeze rate is 58 percent (95 percent interval 51 to 65) against a 20 percent budget, down from 79 (Revision 5) and 70 (Revision 6). The Southern command wins 13 of 103 decided games (7.5 to 20.4 percent), a real gap; the Republic-Northern difference is within noise. The harness turns these into answerable questions: per-faction losses, first-turn moves, and capture maps show whether the computer player or the board causes the Southern weakness, and paired-seed variants test levers such as the digging-in cap, per-faction AI profiles, and recruitment sites, about 400 games per variant for a 10-point change. Support orders (OD-9) were proposed when a held territory could not be taken at all; M17 now lets armies from any number of origins attack as one side, which is most of what a Diplomacy support does. I recommend not adding support orders in Milestone 3: measure the freeze rate with recruitment and the other Milestone 3 rules first, and set explicit balance targets so the harness has something to aim at. The Economy cluster adds the economy's likely effect.

<!-- sources -->
- [Vitest: pool configuration](https://vitest.dev/config/pool)
- [Node.js: Modules: TypeScript](https://nodejs.org/api/typescript.html)
- [GDC 2019: Slay the Spire metrics-driven design and balance](https://gdconf.com/news/learn-slay-spires-successful-metrics-driven-approach-game-balancing-gdc-2019)
- [Game Developer: How Slay the Spire's devs use data to balance](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)
- [Hearts of Iron IV dev diary 1.9 (devtrackers mirror)](https://devtrackers.gg/heartsofiron/p/95e1d0e2-dev-diary-1-9-patchnotes-and-modding-updates)
- [Evolving the Hearthstone Meta (arXiv 1907.01623)](https://arxiv.org/pdf/1907.01623)
- [Mapping Hearthstone Deck Spaces through MAP-Elites (arXiv 1904.10656)](https://arxiv.org/pdf/1904.10656)
- [Evolving Card Sets Towards Balancing Dominion](https://typeset.io/pdf/evolving-card-sets-towards-balancing-dominion-2zsk143ap7.pdf)
- [Metagame Autobalancing for Competitive Multiplayer Games (arXiv 2006.04419)](https://arxiv.org/pdf/2006.04419v1.pdf)
- [Engines of Our Ingenuity 3374: Monte Carlo and board games](https://engines.egr.uh.edu/episode/3374)
- [Skeleton Code Machine: Accelerating tabletop game design with Python](https://www.skeletoncodemachine.com/p/python-game-design)
- [FiveThirtyEight: Designing the best board game on the planet](https://fivethirtyeight.com/features/designing-the-best-board-game-on-the-planet)
- [Wikipedia: Binomial proportion confidence interval](https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval)
- [Battle for Wesnoth: AbilitiesWML](https://wiki.wesnoth.org/AbilitiesWML)
- [Ludii: The Ludemic General Game System (arXiv 1905.05013)](https://arxiv.org/abs/1905.05013v3)
- [An Overview of the Ludii General Game System](https://ar5iv.labs.arxiv.org/html/1907.00240)
- [Paradox forum: How do weight factors work](https://admin-forum.paradoxplaza.com/forum/threads/how-do-weight-factors-work.939900)
- [Steam: Strategic Command World War I](https://store.steampowered.com/app/1096930/Strategic_Command_World_War_I/)
- [Paths of Glory rulebook index (rulespal)](https://rulespal.com/paths-of-glory/rulebook)
- [Paths of Glory rules PDF](https://fgbradleys.com/wp-content/uploads/rules/Paths%20of%20Glory%20-%20rules.pdf)
- [Reds! rulebook (rulespal)](https://rulespal.com/reds/rulebook)
- [Red Star White Eagle rulebook (rulespal)](https://rulespal.com/red-star-white-eagle/rulebook)
- [Frederick II: The Seven Years War (grognard.com)](https://www.grognard.com/info1/frederickII.doc)
- [Clash of Monarchs rulebook (rulespal)](https://rulespal.com/clash-of-monarchs/rulebook)
- [Frederick the Great rulebook (rulespal)](https://rulespal.com/frederick-the-great/rulebook)
- [Napoleonic Wars campaign rules](https://dantes-game.blogspot.com/p/napoleonic-wars-campaign-rules.html)
- [Age of Napoleon rules](https://grognard.com/wargamerfiles/aonv2rules.pdf)
- [The Sun of Austerlitz rulebook (rulespal)](https://rulespal.com/the-sun-of-austerlitz/rulebook)
