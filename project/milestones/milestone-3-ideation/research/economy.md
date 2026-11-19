# Economy cluster: raw research notes (ideas 1, 2, and the resource half of 4)

Agent: Economy. Date: 2026-11-19. These are working notes. The report sections are in `economy.sections.md`.

## Web access log

- **WebSearch and WebFetch both worked.** I used about 30 calls: about 20 searches and 10 fetches.
- **Three fetches failed:**
  - The GMT Paths of Glory rules PDF on fgbradleys.com returned HTTP 403.
  - The Board Game Bliss page for Crusade and Revolution returned HTTP 429, so I have only the search snippet.
  - The extracted Paths of Glory rules text was cut off at 100,000 characters, before section 17 (Replacements). I have the section 9.4 and 6.0 text only.
- **Searches that found nothing usable:**
  - Nothing for "Spain 1936" by VR Designs, or for "Brother Against Brother" as a Spanish Civil War game. The Espana 1936 listings name Devir and Antonio Catalan as publisher and designer.
  - No wartime Asturian coal figures.
  - No Nationalist alferez provisional recruitment details.
  - No training-week figures for the Popular Army.
  - No official Strategic Command reinforcement costs; I found forum posts only.

## What the repo already says

- **Old draft.** `project/milestones/milestone3.md` has income from objectives, "recruitment orders", "reinforcement orders", secret spending, refunds, and a nine-step resolution order. It defers trade, foreign aid, production queues, and research.
- **Scenario spec.** In `project/specs/scenario-package.md`:
  - M11 "Reinforcement" is a move into friendly ground, reported as `reinforcement-arrived`. This is the naming clash in mismatch (a).
  - M12 values scale with `strength / fullStrength`, are rounded once with halves up, and are never below 1.
  - M16 attrition: one point costs `fullStrength / base` men. For a 740-man 4-6 regiment that is 185 men per attack point.
  - M22: every army has exactly one order (Move, Entrench, or Rest).
  - M25: no recovery of men, with "Recruitment and reinforcements arrive in Milestone 3".
  - M26 gives the resolution order. L12 requires `strength <= fullStrength`.
- **Revision 7, O5.** Entrench and Rest are derived, not submitted, and orders stay `MoveOrder[]`. Any Replenish or Recruit order is therefore the first non-move submission. That is a dependency on mismatch (d), which the Engine agent owns.
- **Scenario facts** (`src/main/scenarios/spain-1936-07-31/scenario.json`):
  - `combat.demoralizationFactor` is 0.5.
  - Unit types are infantry-regiment 4-6, militia-column 3-4, colonial-veterans 6-5, and security-forces 3-5.
  - Every army starts at full strength (`strength == fullStrength`). The 740-man 4-6 regiment is `rep-castilla-3`, "Castilla Infantry Regiment No. 3", in Extremadura.
  - Four territories have no city: `la-rioja`, `islas-baleares`, `ceuta`, `melilla`. Any rule that recruits only "in cities" cannot recruit in Morocco, where the Southern command's colonial veterans came from.
  - There is no "territory capital" field.
  - The scenario has no turn-length field. The owner says turns are two weeks.
- **Plan.** `project/plan.md` section 8 says "controlled centers produce resources, unlock unit types, reinforcement orders spend resources". Examples given: an industrial city produces money and allows infantry and artillery; a mountain region allows guerrilla recruitment.
- **Balance** (Revision 7 declog D32): freezes are at 58 percent. Decided games split Republic 41, Northern 47, Southern 13 percent.

## Precedents (cited)

### Recruitment and replacements
- **Paths of Glory (GMT).**
  - A strategy card is played for exactly one of four uses: Operations, Strategic Redeployment, Replacement Points, or Event. Rebuilds must be "in supply and at appropriate locations" ([rules summary](https://lehi-innovation.github.io/boardgame-rules/rules/paths-of-glory/)).
  - Section 9.4: RPs are recorded per nationality on the General Records Track. An RP play uses the whole action round and cannot be made in consecutive rounds. RPs are spent in the Replacement Phase, and section 6.0 says "Any RPs not spent are lost" ([rules text](https://lehi-innovation.github.io/boardgame-rules/extracted/paths-of-glory-rules.txt)).
  - Lesson: replacements compete with offensive actions for the same budget.
- **Strategic Command (Matrix/Slitherine).**
  - Forum posts say reinforcing costs 50 percent of a unit's base cost, so a new unit costs twice as much as topping one up.
  - The maximum reinforcement depends on supply and available MPP ([Battlefront forum](https://community.battlefront.com/topic/35430-too-big-cost-difference-between-building-and-reinforcing)).
  - These are forum claims, not the manual.
- **Diplomacy.**
  - Builds happen in the winter adjustment, only at home supply centres, when centres exceed units. Disbands happen when units exceed centres.
  - Builds and disbands are written secretly and revealed together ([Wikibooks rules](https://en.wikibooks.org/wiki/Diplomacy/Rules)).
  - Lesson: the economy is just a count of centres; growth comes only from conquest.
- **Axis & Allies.**
  - There is a Purchase phase and a later Mobilize phase. Non-infantry units are mobilized at industrial complexes.
  - A complex's production limit is tied to its territory's IPC value and limits placement, not purchase ([A&A forum](https://axisandallies.org/forums/post/237404); also [Global rules PDF](https://www.axisandallies.org/forums/assets/uploads/files/1648348009442-axis-amp-allies-global-rules.pdf), not opened).
  - Lesson: "production capacity" can be a placement cap, not a stockpiled resource.
- **Unity of Command II.** Prestige is the strategic currency, spent on HQ upgrades, theatre assets, and recruiting reinforcements ([Cultured Vultures](https://culturedvultures.com/?p=121191)).
- **Crusade and Revolution: The Spanish Civil War 1936-1939 (Compass, David Gomez Relloso).**
  - Players choose between using an event, attacking in a vulnerable zone, moving units, or accumulating replacements to recover from losses.
  - Reinforcements came from within Spain and from Germany, Italy, and Russia ([Board Game Bliss](https://www.boardgamebliss.com/collections/top-war-games/products/crusade-and-revolution-the-spanish-civil-war-1936-1939), search snippet only).
- **Arriba Espana (Decision Games / Microgame Design Group, 1997, Brian Train).**
  - In a simultaneous foreign-support phase, players compete for the support of seven nations. That support yields reinforcements and "economic points, that you may use to build your units". Italy and Portugal can send combat units to the Rebel player.
  - The reviewer recommends it for players who want strategy "without too much complexity in the rules" ([Grognard review](https://grognard.com/reviews1/arriba1.txt); designer per [boardgamematcher](https://boardgamematcher.com/game/%C2%A1arriba-espa%C3%B1a!)).
- **Espana 1936 (Devir, Antonio Catalan, 2007).** The review covers movement, combat, support, and area control, and calls the game long with a stiff learning curve. I found no economy details ([Zatu review](https://zatu.com/blogs/reviews/espana-1936-review)).
- **For the People (GMT).** It uses strategy cards with replacement values, and Strategic Will (from recall, unverified).

### Resources and their count
- **Axis & Allies.** A single currency (IPCs), where income is the sum of territory values (from recall, unverified; rulebook index at [RulesPal](https://rulespal.com/axis-and-allies/rulebook), not opened).
- **Twilight Struggle.** Each card has an Ops value from 1 to 4, spent on influence, realignment, coups, or space race ([rules summary](https://lehi-innovation.github.io/boardgame-rules/rules/twilight-struggle/)). Ops points are a per-turn action budget.
- **Hearts of Iron IV.** "Military factories produce equipment, while dockyards build ships". These are built by civilian factories. Political power is "an abstract resource". Divisions "require equipment and manpower" ([Wikipedia](https://en.wikipedia.org/wiki/Hearts_of_Iron_IV)).
- **Supremacy 1914.**
  - Seven resources: grain, fish, iron, lumber, coal, oil, gas. Money is separate and comes from provinces in proportion to morale ([Magic Game World](https://www.magicgameworld.com/supremacy-1914-economy/); [Supremacy forum](https://www.playsupremacy.com/en/forums/1914/1914-general-discussion/resources-and-morale-1029e6b6)).
  - Players say "fish and gas seem to be useless" ([forum](https://www.playsupremacy.com/en/forums/1914/1914-archive/fish-and-gas-855246ae)).
- **Call of War.**
  - Food, goods, metal, oil, rare materials, and manpower, plus money.
  - All provinces produce money and manpower. Urban provinces produce more than rural ones (a double icon), and every unit costs manpower ([CoW economic guide 2024](https://www.playsupremacy.com/en/forums/call-of-war-1942/call-of-war-1942-community-guides-videos/cow-economic-guide-2024-updated-08356f66)).
  - This is the closest precedent for "cities yield more, rural yields something else".
- **Civilization.** It splits tile yields into food, production, and gold, with science and culture later (from recall, unverified).
- **On count versus complexity:**
  - Soren Johnson, former lead designer of Civilization 4: "putting too many choices on the table makes it impossible to understand the possibility space", and "the temptation to pile extra units and buildings ... onto an already complete design is strong" ([Game Developer](https://gamedeveloper.com/game-platforms/opinion-7-deadly-sins-for-strategy-games)).
  - About seven options is the most a player can hold in mind, which Blizzard reportedly uses as a limit ([Designer Notes](https://www.designer-notes.com/?p=40)).
  - The Hyrule Conquest mod merged four resources into one after feedback that "there are too many resources" ([PPM forums](https://ppmforums.com/post-613606/hyrule-conquest-streamlining-resources/)).
  - Several resources make better trade-offs, but only if each forces a distinct decision ([GameDev.net](https://www.gamedev.net/forums/topic/595844-multiple-vs-one-resource/?page=0)).
  - A board-game guide warns that eight resource types quickly add hundreds of components ([BGDF](https://www.bgdf.com/node/18978), search snippet only).
- **My synthesis.** Every resource must create a decision that no other resource creates. In this game the two distinct decisions are "what to buy with money" and "where men go". Oil and food would be upkeep, which is bookkeeping and not choice. Political capital needs an event catalogue to spend it on, and action points overlap idea 6.

### History
- **Zones.** The Republic held "the centre, the Levant, Catalonia, and the Basque industrial zones". The Nationalists held "the food-producing areas", which caused an increasingly acute food shortage in the Republican zone ([Britannica](https://www.britannica.com/place/Spain/The-Civil-War)).
- **Basque iron and steel** strengthened the Nationalist economy after the north fell ([HistClo](https://histclo.com/essay/war/ww2/camp/eur/ea/scw/camp/scw-camp36.html)).
- **Asturian coal** was Spain's main coalfield (from recall, unverified; the search found no figures).
- **The Moscow gold.**
  - Just over 510 tonnes, worth $518 million at 1936 prices, left Cartagena on 25 October 1936 for Odessa ([Wikipedia](https://en.wikipedia.org/wiki/Moscow_Gold_(Spain)), search snippet).
  - That was about 72.6 percent of the reserves ([GMIC](https://gmic.co.uk/topic/13543-moscow-gold), search snippet), which in May 1936 were the fourth largest in the world (search snippet). The 510-tonne and 25 October figures are also from search snippets; I did not open the Wikipedia page.
  - Another 194 tonnes went to France.
- **Oil.**
  - Spain had negligible domestic oil. The Republic depended on Standard Oil and Shell for cash, and later on Soviet barter.
  - By 1938 the Republic's fuel situation was critical and its air force was at times grounded ([Explaining History](https://explaininghistory.org/2026/01/09/the-battle-for-oil-petroleum-politics-and-the-economic-chokehold-in-the-spanish-civil-war/), secondary).
- **Texaco.**
  - Torkild Rieber met Franco in August 1936 and agreed to supply oil on credit "until the war ended". Wikipedia gives "3.5 million tons" worth "$20 million". Texaco was fined $22,000 ([Wikipedia](https://en.wikipedia.org/wiki/Torkild_Rieber)).
  - A mirror of Wikipedia's Texaco article gives 3,500,000 barrels instead. The two figures conflict and I did not resolve them.
- **Axis aid.** It included petroleum, and Portugal served as a transshipment route ([Explaining History](https://explaininghistory.org/2026/01/09/the-battle-for-oil-petroleum-politics-and-the-economic-chokehold-in-the-spanish-civil-war/)). The Italian CTV and German Condor Legion arrived from late 1936 ([CTV](https://www.wikipedia.org/wiki/Corpo_Truppe_Volontari), search snippet only).
- **Manpower, Republic.**
  - The government decided in October 1936 to turn the militias into a Popular Army. The first six mixed brigades were formed on 18 October 1936 from militia units around Madrid.
  - By spring 1937 there were 40 active brigades and 15 in training, at about 3,500 men each ([Mixed brigade](https://en.wikipedia.org/wiki/Mixed_Brigade); [Google Arts and Culture](https://artsandculture.google.com/story/iQXRt9sVbUMeUw)).
  - There was no time for specialist training ([IBMT](https://international-brigades.org.uk/news-and-blog/content-story-ej%C3%A9rcito-popular/)).
- **Manpower, Nationalist.** The Army of Africa had about 30,000 in 1936 and roughly doubled to about 60,000 ([Army of Africa](https://en.wikipedia.org/wiki/Army_of_Africa_(Spain))). The scenario's own airlift source `enwiki-airlift-1936` covers the July-August 1936 airlift.
- **Fast militia formation** (from recall, unverified): the Navarrese requetes mobilized within days, and the Barcelona CNT columns, such as the Durruti Column, left within a week of the rising. This argues for militia training speed tied to place.
- **Scale check** (my arithmetic, not a source): 55 brigades of about 3,500 men is about 190,000 men raised over roughly 12 two-week turns, about 16,000 men a turn. Republican rural plus city Manpower of 11 (thousand men) a turn under the illustrative table is the same order of magnitude.

## Assumptions

- **A-ECON-1.** Turns are two weeks, per the owner; the scenario has no field for it. Any aid schedule given in turns rests on this. For example, turn 1 is 31 July 1936, so Soviet deliveries paid by the gold begin around turn 7, late October 1936.
- **A-ECON-2.** Recruitment sites are territory-level (`territories[].recruitment`), because four territories have no city and there is no capital field. If idea 4 moves recruitment into cities, Ceuta and Melilla need a city or depot entry. That is a Map-agent data change, which I flag but do not make.
- **A-ECON-3.** A Replenish order is an army's one order for the turn (a fourth kind beside Move, Entrench, and Rest). A replenishing army holds and defends normally, but it does not entrench, and if demoralized it does not rest. It is submitted, not derived, which is a dependency on mismatch (d).
- **A-ECON-4.** Replenished men and finished recruits arrive at a new M26 step 8a, after control (8) and before morale recovery and digging in (9). They never fight in the turn they are ordered.
- **A-ECON-5.** Replenishment fails, with a refund, if the army fought a meeting or territory battle (M17-M20) that turn, retreated, or was destroyed. Standing battles (M27) do not cancel it: Asturias and Andalucia start shared and fight one almost every turn, so otherwise their armies, including the Southern command's main body, could never replenish.
- **A-ECON-6.** Replenishment is capped at half of `fullStrength` per turn. One value point is `fullStrength / attack` men, matching M16's attacking point. A new army costs twice the Funds per point (a Strategic Command forum claim, used only as a starting idea).
- **A-ECON-7.** Manpower is counted in men in the engine and shown in thousands in the yield tables. Funds is an abstract currency, not pesetas.
- **A-ECON-8.** Income is added after victory (M10) in cleanup, as in the old draft. Balances are public, spending is secret until reveal, and unspent balances carry over.
- **A-ECON-9.** In a contested territory, its cities pay their own controller (`initialController`, then M7). Its rural yield pays nobody until idea 7's sub-regions exist, after which each sub-region pays its holder.
- **A-ECON-10.** The engine is generic over resource ids (yields and costs are maps keyed by id from `resources[]`), but implements no resource behaviours such as upkeep or decay. This satisfies the North Star (idea 13) without a premature abstraction.

## Illustrative yields and the measurement

- **Script.** Scratch script `econ_income.py` (in the session scratchpad, not committed) applies the idea-4 table to `scenario.json` initial control.
- **City yields (Funds, Manpower):**
  - Madrid 3,1; Barcelona 4,1; Bilbao 3,0; Valencia 2,1; Seville 2,1.
  - Oviedo, Gijon, Zaragoza, Cartagena, Malaga and Cadiz 1,0 each; every other city 1,0.
- **Rural yields (Funds, Manpower):**
  - Castilla y Leon 1,3; Andalucia 1,3; Castilla-La Mancha 1,2; Galicia 0,2.
  - Extremadura 1,1; Valencia 1,1.
  - Ceuta 0,2; Melilla 0,2.
  - Every other territory 0,1.

Turn-1 income (Funds, Manpower in thousands):

| Rule for contested rural yield | Republic | Northern | Southern |
|---|---|---|---|
| Pays nobody (recommended) | 23, 11 | 9, 7 | 5, 5 |
| Split evenly | 24, 14.5 | 9, 8 | 6, 7.5 |

- **The Republic's income lead is historically right but heavy.** The Republic held industry and the gold.
- **The Southern command is weakest.** All four of its cities (Seville, Cordoba, Granada, Cadiz) are in contested Andalucia, and Ceuta and Melilla have no city.
- **Data-only levers:**
  - A colonial-veterans recruitment tag on Ceuta and Melilla.
  - A foreign-aid schedule (Axis airlift and Italian aid to the South early on).
  - The Republic's starting gold as a one-off treasury rather than income.
- **These are design abstractions with notes, not changes to historical starting data** (the Revision 5 OD-10 guidance against rebalancing by changing history).

## Options and tradeoffs

### Idea 1 (recruitment and replenishment)
- **A. Diplomacy builds.** Free, conquest-driven, and cannot restore men.
- **B. Recruit and Replenish orders paid from resources** (recommended). Two order kinds, every number in data, and one order per army preserved.
- **C. Paths of Glory replacement-point pool.** Needs supply (mismatch (c)) and a separate phase.
- **D. Automatic recovery.** No decisions, and probably more freezes.

### Idea 2 (resources)
- **A. Funds only.** Simplest, but loses the men-versus-arms asymmetry.
- **B. Funds and Manpower, plus a placement cap per site** (recommended). Two counters, matching the owner's city and rural split.
- **C. Adds Materiel.** It overlaps Funds.
- **D. Full set** (Funds, Manpower, Oil, Food, Political capital). Upkeep rules and an event system; too heavy for a phone.

## Mapping onto the engine

- **Ruleset.** A new ruleset id (the Engine agent names it, mismatch (d)). `m2-strength` stays unchanged.
- **Rules:**
  - M25 is replaced by M28 Replenish in the new ruleset.
  - M22 gains Replenish as a fourth order.
  - M26 gains step 8a (recruits and replenishment) and a cleanup income step after M10.
  - M9 covers impossible economic orders, such as overspending against start-of-turn balances or recruiting at a site that is not eligible.
  - M12 and M16 are unchanged.
- **Schema (`scenario.json`):**
  - `resources[] {id, name}`.
  - `cities[].yield {resourceId: n}`.
  - `territories[].ruralYield {resourceId: n}`, replaced by sub-region yields after idea 7.
  - `territories[].recruitment {unitTypeIds[], capacity, trainingTurns?}`.
  - `unitTypes[].cost {resourceId: perPoint}` and `unitTypes[].trainingTurns`.
  - `factions[].startingResources` and `factions[].aid[] {fromTurn, toTurn, amount{}, sourceIds, designNote}`.
- **New loader rules:**
  - Resource ids resolve.
  - Recruitment unit types resolve.
  - Costs are greater than 0.
  - Aid turn ranges are valid.
- **State.**
  - Per-faction balances.
  - A pending-recruit queue (unit type, site, turn due).
  - Deterministic new-unit ids, for example `<factionId>-r<turn>-<territoryId>-<n>`.
- **Modules:**
  - `engine/types.ts`: orders, state, and the `supportedRulesets` entry.
  - `engine/resolution.ts`.
  - A new `engine/economy.ts`.
  - `ai/computerPlayer.ts`: spend, never hoard, prefer replenishing threatened armies near objectives, recruit near the active offensive target.
  - The planning order builder and resolution report: outcomes `army-recruited` and `army-replenished`, plus an income summary.
  - `soak.test.ts` bands.
- **UI mockup marker:** `planning-resources` (ideas 1 and 2).

## Recommendation

- **Idea 1: Option B, with the names Recruit and Replenish.**
  - Sites are territory-level tags.
  - Training turns per type: militia 1, other types 2.
  - Militia training speed is set by place tags (Navarra, Catalunya, Madrid), not by faction.
  - Replenishing costs half the Funds per point of recruiting new, is capped at half of establishment per turn, arrives at step 8a, and fails in battle.
- **Idea 2: Option B.**
  - Funds and Manpower, plus a per-site placement cap.
  - Oil and food are folded into Funds and foreign aid.
  - Political capital, research, and action points are deferred.

## Draft questions

The questions are in `economy.questions.json`:
- Q-RECR-1 to 7 (model, sites, training, militia speed, replenish timing, price ratio, destroyed armies).
- Q-ECON-1 to 7 (set, optional resources, aid, income sources, contested territories, carry-over, visibility).
- Q-MIS-a-1 (naming).
- Q-MIS-b-1 and Q-MIS-b-2 (M25, morale).
