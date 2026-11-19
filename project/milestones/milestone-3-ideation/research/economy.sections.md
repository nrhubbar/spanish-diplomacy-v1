<!-- idea:1 -->
## Idea 1: Recruitment and replenishment

### Summary
The owner wants players to raise new armies and to restore men to armies that have lost them.

### Findings
- **Wargames treat restoring a unit and raising a new one as two separate actions.** In Paths of Glory a card is played for exactly one of four uses: operations, strategic redeployment, replacement points (RP), or its event. RPs are spent in a replacement phase to rebuild reduced or eliminated units, which must be in supply ([PoG rules summary](https://lehi-innovation.github.io/boardgame-rules/rules/paths-of-glory/)). "Any RPs not spent are lost" ([PoG rules text](https://lehi-innovation.github.io/boardgame-rules/extracted/paths-of-glory-rules.txt)).
- **Strategic Command charges less to top up a unit than to build one.** Forum posts say reinforcing costs half the price of a new unit and is capped by supply and the points on hand ([Battlefront forum](https://community.battlefront.com/topic/35430-too-big-cost-difference-between-building-and-reinforcing)). That is a forum claim, not the manual.
- **Diplomacy builds only at home supply centres.** Builds happen in the winter adjustment, when a power has more centres than units, and they are written in secret and revealed together ([Diplomacy rules](https://en.wikibooks.org/wiki/Diplomacy/Rules)).
- **Axis & Allies places new units at industrial complexes.** Units are bought in the purchase phase and placed at the end of the turn. Each complex's placement limit is tied to its territory's income value ([A&A forum](https://axisandallies.org/forums/post/237404)).
- **Unity of Command II spends prestige to recruit reinforcements** ([Cultured Vultures](https://culturedvultures.com/?p=121191)).
- **Two Spanish Civil War games tie replacements to cards or foreign aid.**
  - In Crusade and Revolution (Compass), each turn the player chooses between an event, an attack, moving units, or saving up replacements. Reinforcements come from inside Spain and from Germany, Italy and the USSR ([Board Game Bliss listing](https://www.boardgamebliss.com/collections/top-war-games/products/crusade-and-revolution-the-spanish-civil-war-1936-1939), search snippet only, because the fetch was refused).
  - In Arriba Espana (Brian Train), a foreign-support phase yields reinforcements and economic points that build units ([Grognard review](https://grognard.com/reviews1/arriba1.txt)).
- **Gaps:** I found no economy details for Espana 1936 (Devir; [Zatu review](https://zatu.com/blogs/reviews/espana-1936-review)), and no trace at all of "Spain 1936" by VR Designs or of "Brother Against Brother".
- **History.**
  - The Republic decreed its first mixed brigades in October 1936 (18 October is the date of the first document); about 15 were deployed by December 1936, and many more by spring 1937 ([Mixed brigade](https://en.wikipedia.org/wiki/Mixed_Brigade)). There was little time for training ([IBMT](https://international-brigades.org.uk/news-and-blog/content-story-ej%C3%A9rcito-popular/)).
  - The Army of Africa grew from about 30,000 men to about 60,000 ([Army of Africa](https://en.wikipedia.org/wiki/Army_of_Africa_(Spain))).
  - Navarrese requetes and the union militias of Barcelona and Madrid formed within days of the rising (from recall, unverified). That supports fast militia training tied to the place, not to the faction.

### Fit with today's engine
- **M25 changes.** M25 (no recovery of men) stays in `m2-strength`. A new ruleset drops it in favour of a new rule, M28 Replenish. The "destroyed armies never return" half of M25 is kept: a lost army comes back only as a freshly recruited one.
- **M22 gains a fourth order.** Replenish joins Move, Entrench and Rest. It would be the first order a player submits that is not a move: today submissions are `MoveOrder[]` (Revision 7, O5). That is a dependency on mismatch (d).
- **M26 gains a step.** A new step 8a, after control and before morale and digging in, delivers recruits and replenished men.
- **Unchanged rules.** M12 rounding and L12 (`strength <= fullStrength`) stay as they are. M9 rejects impossible economic orders.
- **Schema additions.**
  - `unitTypes[].cost` (per value point, keyed by resource id) and `unitTypes[].trainingTurns`.
  - `territories[].recruitment` (`{ unitTypeIds, capacity, trainingTurns? }`).
  - The game state gains a pending-recruit queue and deterministic new-unit ids.
- **Recruitment sites.** "Territory capitals" has no field today, so recruitment is a territory-level tag. Ceuta, Melilla, La Rioja and the Baleares have no city. If idea 4 moves recruitment into cities, those territories need depot (and, for Ceuta and Melilla, port) entries in data.
- **Shared territories.** Standing battles (M27) recur in Asturias and Andalucia, so Replenish must not fail on them, or the Southern command's main body could never refill.
- **Modules affected:** `engine/resolution.ts`, a new `engine/economy.ts`, `ai/computerPlayer.ts`, and the planning and resolution UI.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Diplomacy builds | A free army at a home site whenever a faction holds more objectives than armies. No currency. | Simple, and builds come from conquest. Cannot restore men, and ignores the owner's "money for sure". | Low | High |
| B. Recruit and Replenish orders, paid from resources | Recruit raises a new army at a tagged territory after `trainingTurns`. Replenish (an army's one order) restores up to half its establishment per turn, delivered at step 8a. | Real choices: new army or stronger old one, front or rear. Two new order kinds. | Med | High: costs, sites and times are data |
| C. Replacement-point pool (Paths of Glory) | Each faction earns replacement points per turn and spends them in a replacement phase on any army in supply. | No per-army order. Needs a supply rule, which is mismatch (c), and a separate phase in the UI. | Med | Med |
| D. Automatic recovery | Armies in friendly territory regain a fixed share of their men each turn, with no cost. | No decisions, and probably makes stalemates worse. | Low | High |

**Recommendation:** Option B. It gives the owner both actions with clear names and keeps "one order per army". Every cost, site and training time lives in `scenario.json`. Replenishment that fails when the army fights that turn keeps attacks worthwhile.

### Widget
<!-- widget:recruit-cost -->
Pick a real army from the Spain scenario, set its men now and the men to restore, and see the Funds and Manpower cost, the turns needed, and the resulting attack and defence (M12 rounding, demoralization factor 0.5 from `scenario.json`). Prices are illustrative.

### Mockup
<!-- mockup:planning-resources -->

### Questions
<!-- questions:1 -->

<!-- idea:2 -->
## Idea 2: Resource generation

### Summary
The owner wants money for sure, and possibly oil, food, or point pools, but few enough resources to stay simple. He asked for research on what to include.

### Findings
- **One-currency games.**
  - Axis & Allies runs on one currency, IPCs, collected from the territories a power holds (from recall, unverified) and spent in a purchase phase ([RulesPal index](https://rulespal.com/axis-and-allies/rulebook), not opened).
  - Diplomacy has no currency at all: supply centres decide builds ([Diplomacy rules](https://en.wikibooks.org/wiki/Diplomacy/Rules)).
- **Small sets.**
  - Twilight Struggle gives each card 1 to 4 operations points ([TS rules](https://lehi-innovation.github.io/boardgame-rules/rules/twilight-struggle/)).
  - Hearts of Iron IV uses political power, manpower, and civilian and military factories ([HOI4](https://en.wikipedia.org/wiki/Hearts_of_Iron_IV)).
- **Large sets.**
  - Supremacy 1914 has seven resources plus money ([Magic Game World](https://www.magicgameworld.com/supremacy-1914-economy/)). Players say fish and gas "seem to be useless" ([Supremacy forum](https://www.playsupremacy.com/en/forums/1914/1914-archive/fish-and-gas-855246ae)).
  - Call of War has six resources plus money. Every province yields money and manpower, and urban provinces yield more than rural ones ([CoW guide](https://www.playsupremacy.com/en/forums/call-of-war-1942/call-of-war-1942-community-guides-videos/cow-economic-guide-2024-updated-08356f66)).
- **On resource count versus complexity:**
  - Soren Johnson: "putting too many choices on the table makes it impossible to understand the possibility space" ([Game Developer](https://gamedeveloper.com/game-platforms/opinion-7-deadly-sins-for-strategy-games)).
  - Designers cite about seven options as the limit a player can hold in mind ([Designer Notes](https://www.designer-notes.com/?p=40)).
  - The Hyrule Conquest mod merged four resources into one after players said there were too many ([PPM forums](https://ppmforums.com/post-613606/hyrule-conquest-streamlining-resources/)).
  - Several resources only pay off when each one forces a distinct trade-off ([GameDev.net](https://www.gamedev.net/forums/topic/595844-multiple-vs-one-resource/?page=0)).
- **History.**
  - The Republic held the centre, the Levant, Catalonia and the Basque industry, while the Nationalists held the food-producing areas, which caused growing food shortages ([Britannica](https://www.britannica.com/place/Spain/The-Civil-War)).
  - About 510 tonnes of gold, roughly 72.6 percent of the reserves, left Cartagena for the USSR on 25 October 1936 (search snippets of [Moscow gold](https://en.wikipedia.org/wiki/Moscow_Gold_(Spain)) and [GMIC](https://gmic.co.uk/topic/13543-moscow-gold)).
  - Spain had negligible oil of its own. Republican fuel was critical by 1938 ([Explaining History](https://explaininghistory.org/2026/01/09/the-battle-for-oil-petroleum-politics-and-the-economic-chokehold-in-the-spanish-civil-war/)).
  - Texaco supplied the Nationalists on credit from August 1936, "3.5 million tons" according to [Wikipedia](https://en.wikipedia.org/wiki/Torkild_Rieber). A mirror of the Texaco article says 3.5 million barrels, which I could not resolve.
- **Reading:** money for weapons and men for units are the two distinct decisions. Oil and food act as background upkeep or foreign aid, not as turn-by-turn choices.

### Fit with today's engine
- **New `scenario.json` fields.**
  - `resources[]` (`{ id, name }`).
  - `cities[].yield` and `territories[].ruralYield`, which become sub-region yields after idea 7.
  - `factions[].startingResources` and `factions[].aid[]` (`{ fromTurn, toTurn, amount }`).
  - `unitTypes[].cost`.
- **Yields and costs are maps keyed by resource id.** The engine is then generic over resource ids without modelling upkeep or decay.
- **Game state.** It gains faction balances. Income is added after victory (M10), as in the old draft.
- **Visibility.** Balances are public. Spending stays secret until reveal.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Funds only | One currency from cities and rural ground. Men are implicit in the price. | Easiest to learn. Cannot show the Republic's men-but-no-arms against the insurgents' arms-but-fewer-men. | Low | High |
| B. Funds and Manpower, plus a build limit per site | Two counters. Cities yield mostly Funds, and rural ground mostly Manpower. Production capacity is a placement limit per site, as in A&A, not a third counter. | Matches the owner's city and rural split and the history. Two counters to watch. | Med-low | High |
| C. Funds, Manpower, Materiel | Adds an industrial resource from Barcelona, Bilbao and Asturias, needed for regiments but not militia. | More historical texture. The third resource overlaps Funds in most decisions. | Med | High |
| D. Full set | Funds, Manpower, Oil, Food, Political capital | Supremacy-style richness, with upkeep rules and an event system to spend political capital. Hard to read on a phone. | High | Med |

**Recommendation:** Option B. Oil and food enter through Funds and the foreign-aid schedule. Political capital and action points wait for a later milestone, which matches the owner's "maybe" and "mayyybeee".

### Widget
<!-- widget:resource-picker -->
Choose 1 to 5 resources. The widget shows estimated decisions per turn, new counters on screen, new schema fields, a complexity meter, and the precedent game for each. All counts are my estimates.

### Mockup
<!-- mockup:planning-resources -->

### Questions
<!-- questions:2 -->

<!-- idea:4-resources -->
### City and rural yields (from the Economy research)
- **Cities yield mostly Funds.** That covers industry, ports, banks and taxes.
- **Rural ground yields mostly Manpower**, plus a little Funds from farming.

That follows the historical split: the Republic held the Catalan and Basque industry, the Nationalists the food-producing areas ([Britannica](https://www.britannica.com/place/Spain/The-Civil-War); Basque iron and steel per [HistClo](https://histclo.com/essay/war/ww2/camp/eur/ea/scw/camp/scw-camp36.html)). Call of War likewise gives urban provinces more than rural ones ([CoW guide](https://www.playsupremacy.com/en/forums/call-of-war-1942/call-of-war-1942-community-guides-videos/cow-economic-guide-2024-updated-08356f66)).

The values below are illustrative, not tuned. Manpower is counted in thousands of men per turn.

| Place | Funds | Manpower | Basis |
|---|---|---|---|
| Barcelona | 4 | 1 | Catalan industry |
| Madrid | 3 | 1 | Capital, population |
| Bilbao | 3 | 0 | Iron and steel |
| Valencia, Seville | 2 | 1 | Ports, exports |
| Any other city (including Oviedo, Gijon, Zaragoza, Cartagena, Malaga, Cadiz) | 1 | 0 | Market town |
| Castilla y Leon or Andalucia, rural | 1 | 3 | Wheat and olives, population |
| Castilla-La Mancha, rural | 1 | 2 | Wheat, population |
| Valencia or Extremadura, rural | 1 | 1 | Orchards, pasture |
| Galicia, rural | 0 | 2 | Population |
| Every other territory, rural | 0 | 1 | Population |
| Ceuta, Melilla, rural | 0 | 2 | Moroccan recruiting |

Yields attach to the smallest place that exists: a city, a sub-region after idea 7, or a territory's rural yield until then. That way per-territory, per-city and per-sub-region income all work.

<!-- mismatch:a -->
### Mismatch (a): "Reinforcement" already means a move
**The problem.** M11 uses "Reinforcement" for an army moving into friendly ground, and the outcome `reinforcement-arrived` reports it. The old Milestone 3 draft also calls spending money to restore men a "reinforce order". Players would see "reinforcement" mean two different things in one resolution report.

**Proposed resolution.**
- **Keep M11 as it is.** It is already in the engine, tests and UI.
- **Name the two new economic actions so neither can be confused with a move:**
  - **Recruit** raises a new army. The outcome is `army-recruited`, and while training the army is shown as "In training (n turns)".
  - **Replenish** restores men to an existing army. The outcome is `army-replenished`.
- **Why not the alternatives.** "Replacements" is the established wargame term (Paths of Glory) and is a good name for the pool of men. As a verb, though, "Replace" suggests swapping the army out. "Refit" suggests equipment, which this game does not track. "Raise" works for new armies but reads as archaic next to "Recruit".
- **Ripple.** The old draft's "Reinforcements" heading, its acceptance criteria and its test plan all need the new names.

<!-- mismatch:b -->
### Mismatch (b): strength already exists, and M25 forbids recovery
**The problem.** The old draft says units gain "a small strength/readiness model", but `strength`, `fullStrength`, morale and the M12 values already exist. What blocks restoring men is M25.

**Proposed resolution.**
- **Leave M25 in `m2-strength`.** The new ruleset (mismatch (d)) replaces it with M28 Replenish.
- **What a Replenish order does:**
  - It is an army's one order for the turn. It holds, does not entrench, and does not rest.
  - It adds up to half of `fullStrength` per turn, never above `fullStrength` (L12).
  - The men arrive at new M26 step 8a, after battles and control.
  - It fails, with a refund, if the army fought a meeting or territory battle (M17-M20), retreated, or was destroyed. Standing battles (M27) do not cancel it, or armies in shared Asturias and Andalucia could never replenish.
- **Morale is unchanged** (only rest recovers it, M23). Destroyed armies stay gone; a fresh Recruit replaces them.
- **The arithmetic needs no change.** M12 and M16 already read `strength / fullStrength`: a 740-man 4-6 regiment at 370 men fights at 2-3. The Military agent sets per-type costs and caps.

<!-- mismatch:e-economy -->
**Economy and balance.** Turn-1 income under the illustrative yields above (a measurement, not a retune), with cities paying their controller and contested rural ground paying nobody:

| Faction | Funds | Manpower (thousand men) |
|---|---|---|
| Republic | 23 | 11 |
| Northern command | 9 | 7 |
| Southern command | 5 | 5 |

The Republic out-earns both insurgent commands together (23 Funds against 14), and a gold treasury widens that; Revision 6 had the Republic winning 89 percent of decided games. The Southern command's four cities all sit in contested Andalucia.

Without historical levers the economy widens both gaps:
- A Morocco recruitment tag for colonial veterans.
- A foreign-aid schedule that sends early Axis aid to the Southern command, since Axis transport aircraft and escorted convoys carried the Army of Africa in 1936 (scenario source `enwiki-airlift-1936`).

The aid values are design abstractions with notes, not changes to historical starting data.

**Effect on freezes.** Recruitment adds defenders, which risks more freezes. Capturable city income, replenishment that fails in battle, and a computer player that may not hoard push the other way. The soak test must measure freeze and win shares before and after.

<!-- sources -->
- [Paths of Glory rules summary](https://lehi-innovation.github.io/boardgame-rules/rules/paths-of-glory/)
- [Paths of Glory rules text](https://lehi-innovation.github.io/boardgame-rules/extracted/paths-of-glory-rules.txt)
- [Battlefront forum: building vs reinforcing cost](https://community.battlefront.com/topic/35430-too-big-cost-difference-between-building-and-reinforcing)
- [Diplomacy rules (Wikibooks)](https://en.wikibooks.org/wiki/Diplomacy/Rules)
- [Axis & Allies forum: industrial complexes](https://axisandallies.org/forums/post/237404)
- [Cultured Vultures: Unity of Command II guide](https://culturedvultures.com/?p=121191)
- [Board Game Bliss: Crusade and Revolution](https://www.boardgamebliss.com/collections/top-war-games/products/crusade-and-revolution-the-spanish-civil-war-1936-1939)
- [Grognard: Arriba Espana review](https://grognard.com/reviews1/arriba1.txt)
- [Zatu: Espana 1936 review](https://zatu.com/blogs/reviews/espana-1936-review)
- [Twilight Struggle rules summary](https://lehi-innovation.github.io/boardgame-rules/rules/twilight-struggle/)
- [Hearts of Iron IV (Wikipedia)](https://en.wikipedia.org/wiki/Hearts_of_Iron_IV)
- [Magic Game World: Supremacy 1914 economy](https://www.magicgameworld.com/supremacy-1914-economy/)
- [Supremacy forum: fish and gas](https://www.playsupremacy.com/en/forums/1914/1914-archive/fish-and-gas-855246ae)
- [Call of War economic guide 2024](https://www.playsupremacy.com/en/forums/call-of-war-1942/call-of-war-1942-community-guides-videos/cow-economic-guide-2024-updated-08356f66)
- [Soren Johnson: 7 deadly sins for strategy games](https://gamedeveloper.com/game-platforms/opinion-7-deadly-sins-for-strategy-games)
- [Designer Notes: 8 things not to do](https://www.designer-notes.com/?p=40)
- [PPM forums: Hyrule Conquest streamlining resources](https://ppmforums.com/post-613606/hyrule-conquest-streamlining-resources/)
- [GameDev.net: multiple vs one resource](https://www.gamedev.net/forums/topic/595844-multiple-vs-one-resource/?page=0)
- [Britannica: Spain, the Civil War](https://www.britannica.com/place/Spain/The-Civil-War)
- [HistClo: Spanish Civil War campaign 1936](https://histclo.com/essay/war/ww2/camp/eur/ea/scw/camp/scw-camp36.html)
- [Moscow Gold (Spain), Wikipedia](https://en.wikipedia.org/wiki/Moscow_Gold_(Spain))
- [Torkild Rieber, Wikipedia](https://en.wikipedia.org/wiki/Torkild_Rieber)
- [Explaining History: the battle for oil](https://explaininghistory.org/2026/01/09/the-battle-for-oil-petroleum-politics-and-the-economic-chokehold-in-the-spanish-civil-war/)
- [Mixed brigade, Wikipedia](https://en.wikipedia.org/wiki/Mixed_Brigade)
- [IBMT: Ejercito Popular](https://international-brigades.org.uk/news-and-blog/content-story-ej%C3%A9rcito-popular/)
- [Army of Africa (Spain), Wikipedia](https://en.wikipedia.org/wiki/Army_of_Africa_(Spain))
