# Engine and platform: raw research notes (ideas 11 and 13, mismatches d and e)

Cluster slug: `engine`. Written 19 Nov 2026 against branch `m3-ideation` (main at d7f3006).

Web access worked: 12 searches and 11 fetches (23 total). Two fetches failed: the Paradox forum
(HoI4 Development Diary 54, page did not render) and the tsx documentation (TLS certificate
error). Claims that rest only on a search-result summary, not an opened page, say so.

## Assumptions

- **A-ENGINE-1 (measurement).** Vitest reports the soak run's work under "import", not "tests",
  because `soak.test.ts` calls `soak(spain(), 200, 30)` in the `describe` body, which runs while
  the file is collected. I therefore read the 200-game cost from the import figure (2.66 s) less
  an estimated 0.2 to 0.4 s of module loading (Zod, engine, AI, scenario parse). Result: about
  **12 ms per game** (upper bound 13.3 ms), or about 0.4 ms per game-turn at the 30-turn cap.
  This is an upper bound per turn because the 103 decided games stop before turn 30.
- **A-ENGINE-2.** Turns are two weeks. Nothing in `scenario.json`, `types.ts`, or the specs
  states a turn length or a calendar (grep for week, date, calendar found nothing), so the
  owner's statement is the only source. A `calendar` field is therefore new.
- **A-ENGINE-3.** Milestone 3 rule modules (economy, recruitment, weather, supply, sub-regions,
  a larger computer player) will make a game slower. I guess 2x to 10x per game-turn; there is
  no evidence yet. The widget lets the reader set the factor.
- **A-ENGINE-4.** "Southern command at 13 percent" is 13 of 103 decided games (12.6 percent),
  per the comment in `src/test/soak.test.ts` (Republic 42, Northern 48, Southern 13 of 103
  decided; 116 of 200 games froze). The brief's 41 / 47 / 13 percent are these counts over 103.
- **A-ENGINE-5.** Other clusters own the content of the economy, weather, unit, supply, and
  rail fields. My schema sketch shows where those fields would sit and how they are selected,
  not their final shape.
- **A-ENGINE-6.** A Node CLI can load packages without Vite: `createScenarioRegistry` already
  takes injected `PackageSources` (plain JSON objects plus asset loaders keyed by path), and
  L11 only checks that asset keys exist (`registry.ts` line 76). Only `builtInSources.ts` uses
  `import.meta.glob`.
- **A-ENGINE-7.** No saved games exist (grep of `src/main` for localStorage, sessionStorage,
  indexedDB, persist, saveGame, loadGame found only a doc comment in `session.ts`), so a spec
  version bump has no save-file migration cost. plan.md's "Save/load local game state" epic is
  not built yet.

## 1. Today's soak test (idea 11 baseline)

- `src/test/soakRun.ts` exports `soak(scenario, games, maxTurns, firstSeed = 1)`. For each seed
  it builds a `GameRecord` with every faction assigned `"computer"`, then loops
  `advance` / `nextTurn` from `src/main/state/coordinator.ts`: the real front door (computer
  submission, validation, resolution). It counts early wins (before turn 4), abandonments
  (an objective given up with no loss and no retreat), first-turn control changes, freezes
  (five turns in a row with no control change), decided games, game lengths, and wins per faction.
- It is a plain sequential loop inside one Vitest file. Vitest's unit of parallelism is the test
  file, and the default pool is `forks` ([Vitest pool docs](https://vitest.dev/config/pool)), so the
  soak always occupies one core however many cores exist. `vitest.config.ts` notes that full
  jsdom flows "share the CPU with the 200-game soak" under coverage, which is why
  `testTimeout` is 15 s.
- The run is deterministic per seed (test "is deterministic for a seed (R3)"): battle dice use
  `deriveSeed(game seed, battleStreamTag, turn, battle index)`, the computer players
  `deriveSeed(game seed, turn, faction index)` (spec M26). A game is a pure function of
  (scenario, seed, ruleset, computer-player weights). That is what makes sharding trivial.
- Only aggregates are returned; there is no per-game record, no per-faction loss count, no battle
  statistics, no output file. `lengths` is collected but never asserted or reported.

### Measurement (one run, Revision 6 P3)

Command: `npx vitest run src/test/soak.test.ts --coverage.enabled=false`, run once.

| Line | Value |
|---|---|
| Test files / tests | 1 passed / 6 passed |
| Duration | 2.99 s (transform 96 ms, setup 45 ms, import 2.66 s, tests 72 ms, environment 150 ms) |
| Wall clock (`time`) | 3.70 s total, 3.78 s user, 107 percent CPU (one core) |
| Machine | 10 cores (`sysctl -n hw.ncpu`), Node v24.17.0, Vitest 4.1.9, Vite 8.3.8 |

The six tests include the 200 x 30 Spain soak (collected in `describe`), two 5-game x 10-turn
determinism runs, and a 50-game tiny-front run (both inside "tests", 72 ms together).
Derived: **about 12 ms per 30-turn Spain game, about 80 games per second on one core.**
1000 games would take about 12 to 13 s on one core, about 2 s on 8 workers plus start-up.

**Finding:** today the harness does not need parallelism to be usable; a single core already
runs 1000 games in seconds. Parallelism matters when (a) Milestone 3 rules multiply per-turn
cost (A-ENGINE-3), (b) games run longer (60 to 100 turns for a whole war), or (c) we sweep
variants (six rule variants x 1000 games x 3x slowdown is about 4 minutes on one core and
under 40 s on 8 workers). The bigger gap today is reporting: no per-game data, no intervals,
no A/B comparison.

## 2. Running TypeScript outside Vitest

- Node 24 strips types by default, but "file extensions are mandatory in `import` statements",
  and Node "ignores `tsconfig.json`" ([Node.js TypeScript docs](https://nodejs.org/api/typescript.html)).
  `scripts/*.ts` already use explicit `.ts` imports (tsconfig has `allowImportingTsExtensions`),
  but everything under `src/main` imports extensionless, and `builtInSources.ts` uses Vite's
  `import.meta.glob`. So `node scripts/sim.ts` importing `src/main/...` fails today.
- Node docs name `tsx` as the third-party route for full support (`node --import=tsx file.ts`)
  ([Node.js TypeScript docs](https://nodejs.org/api/typescript.html)). The tsx docs page failed
  to fetch (certificate error); that `--import tsx` passes to workers through `execArgv` is
  (from recall, unverified). tsx would still not understand `import.meta.glob`, so the CLI
  would build `PackageSources` from `fs` (A-ENGINE-6).
- Vite itself can bundle a Node entry (`vite build --ssr`) with the same resolver the app uses,
  including extensionless imports, JSON, and `import.meta.glob` (from recall, unverified; the
  repo already depends on Vite 8). Two entries (`cli`, `worker`) give `build/sim-bin/cli.js`
  and `worker.js`; plain `node` then runs them, and `worker_threads` loads the bundled
  `worker.js`. No new dependency.
- Vitest pools: `threads` (worker_threads) or `forks` (child_process), default `forks`
  ([Vitest pool docs](https://vitest.dev/config/pool)). Parallelism is across files, so a
  Vitest-only harness has to split seeds over generated test files or shards. Workable for a CI
  soak, awkward for an on-demand 1000-game run with JSON output.
- Node `cluster` is built for servers sharing a port (from recall, unverified); it adds nothing
  over `worker_threads` for CPU-bound batch work. `child_process.fork` works but costs a process
  per worker; worker threads are lighter. Each worker parses the scenario once.

### Determinism across workers

- Shard by seed: worker k of W takes seeds `first + k, first + k + W, ...` (round-robin keeps
  shards balanced when long and short games cluster). Each worker returns one `GameSummary`
  per seed; the parent sorts by seed and aggregates. The merged report is then byte-identical
  for any worker count. A unit test asserts `run(workers: 1) == run(workers: 4)` on 20 seeds.
- Record in every report: git SHA, scenario id, a hash of the scenario JSON, ruleset and
  modules, computer-player profile, seed range, turn cap, and any variant patch. Without those,
  two reports cannot be compared.

## 3. Balance evaluation practice (precedents)

- **Slay the Spire (Mega Crit).** GDC 2019 talk "Metrics Driven Design and Balance"
  ([GDC news](https://gdconf.com/news/learn-slay-spires-successful-metrics-driven-approach-game-balancing-gdc-2019)).
  They built a metrics server early that logged every player decision; per card they read pick
  rate and presence in winning decks; graphs grew from three to more than 90, and "each
  analysis needed a specific question"; numbers were weighed against player feedback because
  numbers do not capture feel ([Game Developer](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)).
  Lesson for us: decide the questions first, then the metrics.
- **Hearthstone and Dominion research.** Simulators acting on card definitions are used to
  search for balance changes: "Evolving the Hearthstone Meta" uses evolutionary optimisation to
  test card changes ([arXiv 1907.01623](https://arxiv.org/pdf/1907.01623)); MAP-Elites over the
  SabberStone simulator maps deck spaces ([arXiv 1904.10656](https://arxiv.org/pdf/1904.10656));
  "Evolving Card Sets Towards Balancing Dominion" uses three AI agents as balance judges
  ([CEC 2012](https://typeset.io/pdf/evolving-card-sets-towards-balancing-dominion-2zsk143ap7.pdf));
  "Metagame Autobalancing" lets a designer state a target meta and searches parameters to fit
  ([arXiv 2006.04419](https://arxiv.org/pdf/2006.04419v1.pdf)). (Details from abstracts and
  search excerpts; full texts not opened.) Lesson: a target must be stated before a search
  can hit it.
- **Hearts of Iron IV (Paradox).** A `-hands_off` launch option starts an observed AI-only game,
  writes a monthly history dump, and reports test conditions as pass or fail under the logs'
  tests folder; the History Logger was "developed to observe AI gameplay"
  ([HoI4 1.9 dev diary mirror](https://devtrackers.gg/heartsofiron/p/95e1d0e2-dev-diary-1-9-patchnotes-and-modding-updates)).
  That is the closest commercial analogue to our harness: AI-only runs plus declared checks.
- **Board game designers.** Cole Wehrle "wrote computer programs that played through different
  situations" to tune Root; limits: a simulation "can only answer questions you can pose
  precisely", real players do not act randomly, and it "cannot tell whether a game is fun"
  ([Engines of Our Ingenuity 3374](https://engines.egr.uh.edu/episode/3374)). Skeleton Code
  Machine models one mechanic at a time (100,000 runs for one), charts distributions because
  "averages are not robust against outliers", and says "none of this replaces actual
  playtesting with humans" ([Skeleton Code Machine](https://www.skeletoncodemachine.com/p/python-game-design)).
  Twilight Struggle's designers found side balance, "either side thinks they have a fighting
  chance", tricky to get right ([FiveThirtyEight](https://fivethirtyeight.com/features/designing-the-best-board-game-on-the-planet));
  its online play settles it with an influence bid or a fixed handicap for one side (from a
  Steam discussion seen only in search results; treat as recall, unverified).
- **Elo-like metrics.** Elo and TrueSkill rate players, not sides (from recall, unverified). In
  our harness the same computer player plays every side, so the right balance metric is win
  share per faction with an interval. Elo becomes useful later, to compare computer-player
  versions in an AI-vs-AI ladder.
- **Common random numbers.** Running variant A and variant B on the same seeds (paired) removes
  much of the dice noise from the comparison (standard simulation variance reduction; from
  recall, unverified). Our seeds already make this free. Caveat: a rule change shifts the dice
  stream from the first battle that differs, so pairing helps most for small changes.

### Confidence intervals (computed, Wilson score, 95 percent)

Formula from [Wikipedia: Binomial proportion confidence interval](https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval);
the Wald interval is unreliable for small n or shares near 0 or 1, so I use Wilson.

| Quantity | Observed | 95 percent interval |
|---|---|---|
| Southern wins, of decided games | 13 / 103 = 12.6 % | 7.5 to 20.4 % |
| A 13 % share of decided games, 200 games (about 103 decided) | 13 / 103 | 7.8 to 20.8 % |
| A 13 % share of decided games, 1000 games (about 515 decided) | 67 / 515 | 10.4 to 16.2 % (about +/- 3) |
| A 13 % share of decided games, 10 games (about 5 decided) | under 1 / 5 | 1.7 to 56.5 % |
| For comparison, a 13 % share of all games, n = 200 / 1000 | 26 / 200, 130 / 1000 | 9.0 to 18.4 %, 11.1 to 15.2 % |
| Republic wins, of decided | 42 / 103 = 40.8 % | 31.8 to 50.4 % |
| Northern wins, of decided | 48 / 103 = 46.6 % | 37.3 to 56.2 % |
| Freeze rate | 116 / 200 = 58 % | 51.1 to 64.6 % |
| Decided | 103 / 200 = 51.5 % | 44.6 to 58.3 % |

Reading: the Southern weakness is real (its upper bound, 20 percent, is far below a third), but
the Republic-versus-Northern gap is noise at this sample size. 10 games tell us almost nothing;
200 are enough to see a large imbalance; 1000 narrow a faction's share to about +/- 2 to 3 points.

A/B sample sizes (two-sided 5 percent, 80 percent power, unpaired): detecting a freeze-rate drop
from 58 to 48 percent needs about 388 games per arm; 58 to 53 percent about 1,547 per arm;
58 to 20 percent about 22 per arm; a Southern share rising from 13 to 20 percent about 438
decided games per arm. Pairing seeds lowers these.

## 4. Harness design options (idea 11)

| Option | What | For | Against |
|---|---|---|---|
| A. Vitest only | Keep the soak in Vitest; split seeds over several soak files so the pool parallelises them | No new tooling | Reports awkward, slows `npm test`, no ad-hoc runs |
| B. CLI bundled by Vite + worker threads | `npm run sim -- --games 1000 --workers 8 --scenario spain-1936-07-31 --out build/sim/` builds `build/sim-bin/` with `vite build --ssr`, then `node` runs it; workers via `worker_threads` | No new dependency; same resolver as the app; fast | A build step (about a second) before each run; bundle config to maintain |
| C. CLI with tsx + worker threads | Same CLI, run by `tsx`; workers started with `--import tsx`; packages loaded with `fs` | No build step | New dev dependency; must not touch `import.meta.glob`; worker loader behaviour unverified |
| D. Defer | Keep the 200-game soak; add reporting later | Zero cost now | Milestone 3 balance work is blind |

Shared core in all of A to C: move the per-game loop out of `soakRun.ts` into
`src/main/sim/playGame.ts` (pure: scenario, seed, options in; `GameSummary` out) and
`src/main/sim/summarize.ts` (aggregates, Wilson intervals). `soak.test.ts` keeps its 200-game
assertions on top of the same core, so the CI soak and the CLI can never disagree.

### Metrics the report should carry

- Run metadata (section 2).
- Outcome: decided share; win share per faction, of all games and of decided games, each with a
  Wilson interval; shared victories; early wins (S1); abandonments (S3).
- Stalemate: freeze rate (S2: five quiet turns), turn of first freeze, longest quiet streak,
  control changes per turn (median and 90th percentile by turn number).
- Length: histogram of game length; median and 90th percentile; share reaching the turn cap.
- Combat: battles per turn; distribution of odds columns attacked at; distribution of the seven
  M16 results; attacker success rate by odds column (checks the table behaves as designed);
  men lost and armies destroyed per faction; surrenders.
- Behaviour: first-turn moves per faction; share of armies that never move; most and least
  captured territories (a per-territory capture count feeds a map heat view).
- Economy (once it exists): income, spending, and stockpile per faction per turn; recruits per
  faction; unspent balance at game end. The Economy cluster names the fields.
- Variant comparison: for each metric, A, B, the difference, and its interval; paired by seed.
- Output: `summary.json` (everything above), `games.csv` (one row per seed: winner, length,
  froze, first-freeze turn, battles, losses per faction), and an HTML report page.

## 5. Idea 13: what goes into data

### Precedents

- **Battle for Wesnoth.** Unit abilities and weapon specials are WML tags: abilities `heals`,
  `regenerate`, `leadership`, `skirmisher` and others; specials `drains`, `slow`, `poison`,
  `firststrike`, and more. Keys such as `value`, `add`, `multiply`, `cumulative` tune each one;
  an unrecognised tag is inert ([Wesnoth AbilitiesWML](https://wiki.wesnoth.org/AbilitiesWML)).
  The page implies (does not state) that each tag name selects behaviour coded in the engine.
  This is exactly "named module, parameters in data".
- **Ludii.** A general game system whose games are written as "ludemes", high-level game
  concepts ([arXiv 1905.05013](https://arxiv.org/abs/1905.05013v3)); its description language is
  generated automatically from the class hierarchy of its source code
  ([Ludii overview](https://ar5iv.labs.arxiv.org/html/1907.00240)). Each ludeme is a code module;
  the game file composes them. Even the most general system does not encode algorithms as raw
  data; it names coded parts.
- **Paradox scripts.** AI choices are weighted in script: an `ai_will_do` block starts from a
  base factor and multiplies in each applicable `modifier = { factor = x }`; a modder warns that
  hard-coding AI choices per event makes them hard to change later (Paradox forum threads seen
  in search results, e.g. [How do weight factors work](https://admin-forum.paradoxplaza.com/forum/threads/how-do-weight-factors-work.939900);
  not opened). HoI4 lets modders add AI strategies that override behaviour
  ([HoI4 1.9 dev diary mirror](https://devtrackers.gg/heartsofiron/p/95e1d0e2-dev-diary-1-9-patchnotes-and-modding-updates)).
  So AI weights in data are proven; AI algorithms stay in code.
- **Strategic Command.** Matrix Games' WWI title "runs on the same upgraded engine" as their WWII
  games, reusing the map set-up and adding WWI unit types, trench research, mines, and
  reconnaissance bombers spotting for artillery
  ([Steam: Strategic Command WWI](https://store.steampowered.com/app/1096930/Strategic_Command_World_War_I/)).
  One engine across eras works when the era differences are mostly units and parameters.

### Era sanity check

- **WW1.** Paths of Glory has Replacement Points (section 9.4), Strategic Redeployment (13.0),
  and Trenches (11.2) ([rulespal index](https://rulespal.com/paths-of-glory/rulebook);
  [rules PDF](https://fgbradleys.com/wp-content/uploads/rules/Paths%20of%20Glory%20-%20rules.pdf);
  section contents not read). Strategic Command WWI makes trenches a research line (Steam, above).
  Reuses: odds table, digging in (trench levels are our `diggingIn`), recruitment/replacements,
  rail, seasonal weather. New: little; perhaps artillery barrage effects and trench levels
  bought by research.
- **WW2.** (From recall, unverified, apart from Strategic Command sharing its engine.) Needs air
  units with missions (air superiority, interdiction, strategic bombing), oil as a resource
  that limits operations, production queues, armour exploitation (a second move after
  breakthrough), and naval transport. Reuses: economy, recruitment as production, supply,
  rail, weather. New modules: air, exploitation movement, naval.
- **Russian Civil War.** Reds! is two-player but runs six White groupings as activation chits;
  armoured trains "may only move, attack or retreat along contiguous rail hexes"; rail and river
  strategic movement is unlimited in distance but capped per phase (9 manpower points for the
  Reds); rail lines are supply lines ([Reds! rulebook](https://rulespal.com/reds/rulebook)).
  Red Star White Eagle has armoured-train and rail-net rules and an optional three-player game
  (search summary of [rulespal](https://rulespal.com/red-star-white-eagle/rulebook)). Reuses:
  N factions (already supported), rail with capacity (idea 5), supply. New: a "rail-only" unit
  movement restriction (a named unit effect), possibly faction activation order.
- **Seven Years' War.** Frederick II has a logistics phase with supply, sieges, and winter
  quarters ([grognard.com](https://www.grognard.com/info1/frederickII.doc)); Clash of Monarchs
  has a Winter Quarters phase and supply actions
  ([rulespal](https://rulespal.com/clash-of-monarchs/rulebook)); Frederick the Great has
  Supply, Leaders, Winter, and Fortresses sections
  ([rulespal](https://rulespal.com/frederick-the-great/rulebook)) (search summaries). Reuses:
  supply (traced to depots, i.e. a parameter of "traced to source"), seasonal calendar,
  leaders. New: winter quarters (a season that suspends operations), sieges of fortresses.
- **Napoleonic.** A campaign ruleset caps corps per general by command rating and applies
  attrition when more corps stand in a hex than its forage value
  ([Napoleonic campaign rules](https://dantes-game.blogspot.com/p/napoleonic-wars-campaign-rules.html));
  Age of Napoleon makes the corps the basic unit with march attrition
  ([AoN rules](https://grognard.com/wargamerfiles/aonv2rules.pdf)); The Sun of Austerlitz has
  forage modes, forage ratings, march attrition, and leadership bonus points
  ([rulespal](https://rulespal.com/the-sun-of-austerlitz/rulebook)) (search summaries). Reuses:
  leaders (idea 8 generals), exhaustion (idea 6), weather. New: forage attrition (a supply
  variant keyed to stack size), command limits.

**Pattern:** every era reuses the core simultaneous-orders, odds-table resolution. Each adds one
to three subsystems that are algorithms (air, forage, winter quarters, rail-only movement),
not numbers. Those are exactly what Revision 6 section 1.6 says must stay in code to stay
testable. Parameters (unit values, tables, costs, weights, calendars) are what changes in data.

### The tension (for the owner, not a conclusion)

- `coding-principles.md`: "Avoid premature generic abstractions" and "a new scenario needs no
  code changes unless it needs a new ruleset".
- Revision 6, section 1.6: "The resolution algorithm stays in the engine as named, specified
  rules. Encoding the algorithm itself as data would make it untestable."
- The owner's north star: swap "jpegs and jsons" for WW2, the Russian Revolution, WW1, even the
  Seven Years' War or Napoleon, possibly with AI strategies, resource types, and unit types in
  JSON. The owner also hedges: "if our engine is flexible enough", "the other game types will
  come later".
- Middle ground to put to the owner: **parameters in data; named rule modules in code, selected
  by data; each module with its own tests and spec rules.** A new era then needs new JSON plus,
  at most, a few new named modules, never an engine fork. Data never contains formulas.

### Element-by-element proposal

| Element | Today | Proposal | Why |
|---|---|---|---|
| Unit types: values, names | data (`unitTypes`) | data, plus cost, training turns, recruit tags | numbers only |
| Unit special effects (artillery +1 per 3 points, bombing) | none | data names an effect kind from a coded list (`{ kind: "roll-bonus-per-points", per: 3, bonus: 1 }`) | Wesnoth pattern; each kind unit-tested |
| Resource types | none | data: ids, names, icons; which module produces each is code | resource list varies by era |
| Income, costs, yields | none | data | numbers |
| Combat table, below-1:1, digging in, morale factor | data (`combat`) | data, keyed by dice module | already proven |
| Dice and resolution | code (`m2-strength`) | named module (`d6-table`, `d20-graded`) | algorithm |
| Weather probabilities by month and zone | none | data | numbers |
| Weather effects | none | named effect kinds in data (move cost +1, roll -1) | small coded list |
| Turn calendar (start date, turn length) | none | data | weather needs month |
| Victory thresholds | data | data; victory kinds a coded list | already proven |
| Computer-player weights (`computerWeights`, `offensiveWeights`, `stakeWeights`, `victoryAlarm`) | code constants | data: named AI profiles, per faction | numbers; Paradox precedent; lets the harness A/B weights |
| Computer-player strategy logic | code | code (a profile may name a coded strategy) | algorithm |
| Supply, rail, partition, leaders | none | named modules | algorithms |
| Factions, briefings, colours | data | data | already proven |

### File layout (owner expects `spain-civil-war-scenario.json`)

Today: one folder per package, `src/main/scenarios/spain-1936-07-31/` with `scenario.json`
(rules numbers + board + start) and `map.json` (presentation), both validated by JSON Schemas
generated from Zod (`scenarioSchema.ts`, `mapSchema.ts`), loaded by `import.meta.glob` on
`*/scenario.json`.

| Layout | What | For | Against |
|---|---|---|---|
| 1. One file per scenario, sectioned | Keep `scenario.json`, add top-level `rules` (modules, unit types, combat, resources, weather, AI, calendar) and keep board and start as today | Matches the owner's "one file with everything"; loader barely changes | A 1937 start copies the whole rules block |
| 2. Game-mode file plus start files | `src/main/modes/spain-civil-war/mode.json` (rules + board) shared by `starts/1936-07-31.json`, `starts/1937-...json`; `map.json` beside the mode | No duplication; the mode file is the owner's "spain-civil-war-scenario.json" | Two schemas; loader composes; overkill with one start |
| 3. Inheritance | A scenario file with `extends: "../spain-civil-war/rules.json"` and overrides | Flexible | Override semantics need rules and tests; easy to misread |

The loader in every layout composes the files into today's single validated `Scenario` type,
so the engine never knows which layout was used.

## 6. Mismatch (d): ruleset id and schema fields

- Today `ruleset` is `z.literal("m2-strength")`; `supportedRulesets = ["m2-strength"]`.
- Problem: Milestone 3 adds several independent rule areas (dice, economy, recruitment,
  weather, supply, movement, sub-regions). One id per combination explodes (`m3-d20-economy-
  weather-...`); one id for "all of Milestone 3" forces every future scenario to take all of it.
- Proposal: keep `ruleset` as the id of the base resolution pipeline and add a `rules` object
  that selects one named module per rule area:

```json
{
  "specVersion": 2,
  "ruleset": "m3-modular",
  "rules": {
    "dice": "d20-graded",
    "economy": "funds-manpower",
    "recruitment": "capital-training",
    "weather": "seasonal-zones",
    "supply": "none",
    "movement": "one-step",
    "partition": "none"
  },
  "calendar": { "start": "1936-07-31", "turnDays": 14 },
  "resources": [ { "id": "funds", "name": "Funds" }, { "id": "manpower", "name": "Manpower" } ],
  "unitTypes": [ { "id": "artillery-regiment", "name": "Artillery regiment", "attack": 4, "defence": 3,
                   "cost": { "funds": 3, "manpower": 1 }, "trainingTurns": 2,
                   "effects": [ { "kind": "roll-bonus-per-points", "per": 3, "bonus": 1 } ] } ],
  "combat": { "...": "keyed to the dice module" },
  "weather": { "...": "owned by the Weather cluster" },
  "economy": { "...": "owned by the Economy cluster" },
  "ai": { "profiles": [ { "id": "default", "weights": { "approachObjective": 1.5, "caution": 0.5 },
                          "offensive": { "reach": 3, "stallStep": 1 }, "stakes": { "city": 2 } } ],
          "factionProfiles": { "south": "default" } }
}
```

- `m2-strength` stays a named preset that means `{ dice: "d6-table", economy: "none",
  recruitment: "none", weather: "none", supply: "none", movement: "one-step",
  partition: "none" }`, so the harness can run m2 and m3 rules side by side.
- New validation rules: L14 a module's required companions are present (recruitment needs an
  economy); L15 data blocks match their selected module (a `d20-graded` dice needs a 20-row
  table); L16 every AI profile a faction names exists.
- Spec version 1 to 2 for the scenario package (the `ruleset` meaning and new required blocks
  change). Only two packages exist (Spain, tiny-front) and no saves (A-ENGINE-7), so migrate
  both in one commit and drop v1.

## 7. Mismatch (e): balance

- Freeze rate history: Revision 5 79 percent (m2-movement), Revision 6 70 percent, Revision 7
  58 percent (interval 51 to 65); budget S2 is 20 percent. Strength-based combat (Revision 6)
  was the answer chosen to OD-9; with M27 standing battles and the offensive-planning computer
  player it cut freezes by 21 points over two revisions, but not to the budget.
- Southern command: 13 of 103 decided games (7.5 to 20.4 percent). The cause is not known.
  Candidate levers the harness can test without changing history: computer-player weights per
  faction (AI profile), digging-in cap (3 vs 2), recruitment sites for the Army of Africa,
  sea-connection rules. The harness shows per-faction losses and first-turn moves, which point
  at whether it is the AI or the board.
- Support orders (OD-9, Revision 5): suggested when a held territory could never be taken. Under
  `m2-strength`, M17 already lets every army of one faction moving into a territory attack as one
  side, from any number of origins; that is the main effect of a Diplomacy support. A separate
  support order would add a second order type, new cutting rules, and new UI, for an effect
  combined attacks mostly give already. Recommendation for the owner: not in Milestone 3; first
  measure the freeze rate with recruitment and the other Milestone 3 rules through the harness,
  then decide. (Diplomacy's support-cutting rules from recall, unverified.)
- Economy effect on freezes is two-sided: recruitment can feed attackers (fewer freezes) or let
  defenders refill and dig in (more). Only measurement settles it. The Economy cluster adds its
  paragraph.

## 8. Options, mapping, recommendations

### Idea 11

- Recommended: **Option B** (CLI bundled by Vite, worker threads, seed sharding, deterministic
  merge, JSON + CSV + HTML), with the shared pure core in `src/main/sim/`, and the 200-game soak
  kept in `npm test` on that core. Variants as JSON patches over the scenario, run on paired seeds.
- Engine mapping: no M-rule changes. Touches `src/test/soakRun.ts` (moves to `src/main/sim/`),
  `src/test/soak.test.ts`, new `scripts/sim/cli.ts` and `scripts/sim/worker.ts`,
  `vite.sim.config.ts`, `package.json` script `sim`, output `build/sim/<run-id>/`. Needs the
  resolution outcomes already returned by `nextTurn` (battles, results, retreats).

### Idea 13

- Recommended: **parameters in data, named modules in code** (as the owner's question, Q-DATA-1),
  computer-player weights moved into data as AI profiles, file layout 1 (one sectioned file per
  scenario) for Milestone 3 with layout 2 when a second start date is planned.
- Engine mapping: `scenarioSchema.ts` (new `rules`, `calendar`, `resources`, `ai`, `unitTypes[].
  effects`), `engine/types.ts` (`supportedRulesets`, module ids), `ai/computerPlayer.ts`,
  `ai/offensive.ts`, `ai/assessment.ts` (read weights from the scenario's profile instead of
  constants), `loader.ts` (L14-L16, module composition), spec docs `scenario-package.md`
  (version 2, module sections).

## 9. Draft questions

See `engine.questions.json`: Q-HARN-1 to 7, Q-DATA-1 to 6, Q-MIS-d-1 to 2, Q-MIS-e-1 to 2.
