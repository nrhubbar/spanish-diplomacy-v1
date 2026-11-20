<!-- idea:7 -->
## Idea 7: Territory sub-partitioning

### Summary
Split a territory into historical sub-regions (NUTS3 or provinces) during combat, so it can be held in part. Make income follow the parts, and possibly movement too.

### Findings
- **NUTS3 is not the 1936 provinces, though it is close.**
  - **1936 had the same 50 provinces as today.** The 1833 decree created 49 provinces. A 1927 decree split the Canaries in two, making 50 ([1833 division](https://en.wikipedia.org/wiki/1833_territorial_division_of_Spain); [Province of Canary Islands](https://en.wikipedia.org/wiki/Province_of_Canary_Islands)).
  - **NUTS3 differs in three places.** NUTS3 is "Provinces + Islands + Ceuta and Melilla" ([NUTS of Spain](https://en.wikipedia.org/wiki/NUTS_statistical_regions_of_Spain)):
    - Baleares splits into ES531 Eivissa y Formentera, ES532 Mallorca, and ES533 Menorca.
    - The Canaries split into seven islands.
    - Ceuta (ES630) and Melilla (ES640) are units of their own ([Eionet NUTS 2021](https://dd.eionet.europa.eu/vocabulary/common/nuts2021/view?page=43)).
  - **Ceuta and Melilla were not provinces in 1936.** They "were formerly part of Cadiz and Malaga provinces" ([Provinces of Spain](https://en.wikipedia.org/wiki/Provinces_of_Spain)).
- **Provinces per scenario territory: 48 in total.**
  - Castilla y Leon 9, Andalucia 8, Castilla-La Mancha 5, Galicia 4, Cataluna 4, Pais Vasco 3, Aragon 3, Valencia 3, Extremadura 2.
  - Seven territories have 1 each; Ceuta and Melilla have 0. Membership is from recall; the total of 50 is cited.
  - **The problem:** province level cannot split Asturias (Oviedo against Gijon) or Madrid. Yet Madrid is `plan.md`'s own partition example.
  - **The fix:** NUTS3's island split happens to match 1936, when Mallorca and Ibiza were with the rising and Menorca stayed loyal ([Battle of Majorca](https://en.wikipedia.org/wiki/Battle_of_Majorca)).
- **31 July 1936, by province capital** ([es.wikipedia, Golpe de Estado de julio de 1936](https://es.wikipedia.org/wiki/Golpe_de_Estado_en_Espa%C3%B1a_de_julio_de_1936); [Spanish coup of July 1936](https://en.wikipedia.org/wiki/Spanish_coup_of_July_1936)):
  - Andalucia is Sevilla, Cadiz, Huelva (city taken 29 July), Cordoba and Granada for the rising. Cordoba and Granada were city only: "la provincia permanece fiel". Malaga, Jaen and Almeria were Republican.
  - Extremadura is Caceres for the rising and Badajoz Republican.
  - Pais Vasco is Alava for the rising, Vizcaya and Guipuzcoa Republican.
  - By capital holder, Extremadura, Andalucia and Pais Vasco start partitioned. Asturias and Baleares are single provinces whose capitals (Oviedo, Palma) the rising held, so only the overrides split them. Aragon would start wholly Northern, losing its Republican eastern strip, so it needs an override (full table in `research/map.md`).
- **Precedents.**
  - Diplomacy has no partial control; its only sub-province device is split coasts (from recall, unverified).
  - In [Here I Stand](https://rulespal.com/here-i-stand/rulebook), a fortified space changes hands only through a successful siege.
  - `plan.md` sections 6.3 and 9 already specify predefined sub-territories that lie dormant until a split.
- **Movement on sub-regions is expensive.**
  - **Graph and AI.** 55 nodes instead of 18, and every order, battle and AI distance changes ids. The AI's "three steps" planning (D58) covers a third of the ground.
  - **Tempo.** The Army of Africa crossed three province borders in about five weeks from 2 August ([Battle of Merida](https://en.wikipedia.org/wiki/Battle_of_M%C3%A9rida); Talavera date from recall), about 1.2 a turn. One sub-region per turn is close to that, so province moves do not need multi-step movement; territory moves already cover it.

### Fit with today's engine
- **scenario.json.**
  - New `subRegions[]`: `id`, `name`, `territoryId`, `adjacent[]` (including across territory borders), and `cityIds`.
  - New loader rules: references resolve; each territory's sub-regions are connected to each other; and a cross-border adjacency requires a territory connection.
- **GameState.** A new `subRegionControl`. `control` becomes derived: "controlled" when one faction holds every sub-region, otherwise "partitioned".
- **Rules:**
  - **M6/M7:** control comes from sub-regions.
  - **M11/M17 (rule P0):** today a move into a territory where the mover's faction already has an army is a reinforcement. In a partitioned territory, a move from outside instead attacks when an enemy sub-region borders its origin; otherwise it joins its own zone (Q-PART-8).
  - **M17/M18:** graded `ground` k flips k sub-regions (rule P1). This uses the Military ladder's `ground`: 0, 1 (`defender-gives-ground`), 2 (`defender-pushed-back`), or all.
  - **M21:** displaced defenders fall back into their own remaining sub-regions, else retreat (P2).
  - **M22:** works are kept per territory per faction.
  - **M24:** a city is held through its sub-region.
  - **M27:** this cluster proposed replacing it with a `push` order (from one sub-region into a neighbouring enemy sub-region, not a move to the army's own territory, which would break M2 and L6). The Military cluster keeps M27. The report recommends keeping M27 and lets the owner choose in Q-TEN-2.
  - **P7:** an unopposed entry or Push into an ungarrisoned enemy zone takes one sub-region a turn. At the start, Caceres and Alava have no garrison.
  - **M10:** a partitioned territory counts for nobody.
- **Rule P1.** Repeat k times.
  - An entry's first pick must border its origin.
  - After that, the candidates are the defender's sub-regions bordering the attacker's own.
  - Take the candidate with the most attacker-held neighbours; break ties by scenario order.
- **Engine selection.** `rules.partition` in the Engine cluster's module object.
- **map.json and pipeline.**
  - **Pipeline:** `scripts/build-map.ts` reads only geoBoundaries ADM1 (16 regions keyed ES11 to ES62). It needs an ADM2 source, its checksum and attribution, a split of Baleares by polygon, and hand overrides for Asturias and Madrid.
  - **Map spec:** it already lets several regions share a territory. It adds `regions[...].subRegionId` and `subRegions[id].unitAnchor`.
  - **Adjacency:** it can be generated from shared border edges. That is new code beside `scripts/map/edgeIndex.ts`.
- **UI.** The territory wash is drawn per sub-region, which replaces striping. Counters are drawn at each faction's zone anchor (`CounterLayer.tsx`).

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Full sub-region map | Everything (moves, battles, AI) runs on about 55 sub-regions. | The most faithful, and what the owner floated. It roughly triples the nodes, needs idea 6 movement points to match history, requires a broad engine rename and an AI retune, and is harder on phones. | High | High |
| B. Hybrid: sub-regions for control and income | Orders and battles stay on the 18 territories. A graded result flips k sub-regions, chosen by adjacency to the attacker. Cities, income and supply follow the sub-regions. | Delivers "contested, with its occupiers in smaller regions" and the income split. The data is reusable for A later. A whole territory remains one battle. | Med | High |
| C. Two generic halves | Every territory has zones A and B, with no geography. | Cheap, but not historical and not readable on the map. | Low | Med |
| D. Defer | Keep M27 shared territories. | No cost, but it drops `plan.md`'s headline mechanic. | None | n/a |

**Recommendation:** Option B. Use provinces by default with scenario overrides: Baleares as its three NUTS3 islands, Asturias in 2 and Madrid in 3, about 55 sub-regions in all. It delivers the owner's split and income effect now. Movement stays territory-level until idea 6 shows that multi-step movement works, and the same data then allows Option A.

### Widget
<!-- widget:partition-splitter -->
Pick Andalucia, Aragon or Extremadura, an attacker and its origin, and a graded result. It shows which provinces flip under rule P1 and the resulting income split. Starting control is the 31 July 1936 capital holders; adjacency is from recall; yields are illustrative.

### Mockup
<!-- mockup:partition-map -->

### Questions
<!-- questions:7 -->

<!-- idea:5 -->
## Idea 5: Rail, building and upgrading rail, rail capacity

### Summary
Add railways that armies can use, that players can build and upgrade, and whose capacity limits how many troops move.

### Findings
- **Spain's gauge.** Spain built its network to 1,672 mm, "six Castilian feet". The 1,668 mm Iberian gauge is a 1955 compromise with Portugal ([Iberian gauge](https://en.wikipedia.org/wiki/Iberian_gauge)). The usual explanations are distrust of France and powerful engines for steep grades ([History of rail transport in Spain](https://en.wikipedia.org/wiki/History_of_rail_transport_in_Spain)). The northern coast (Bilbao, Santander, Asturias) also ran a large narrow-gauge system, a real break inside Spain for the 1937 Northern campaign ([History of rail transport in Spain](https://en.wikipedia.org/wiki/History_of_rail_transport_in_Spain)). Traffic across the Pyrenees was transshipped at Irun and Portbou (search snippet, [RailTarget](https://www.railtarget.eu/technologies-and-infrastructure/railway-revolution-in-spain-from-civil-war-battlefield-to-europes-highspeed-leader-8949.html)). Inside Spain the main network had one gauge, so War in the East-style gauge conversion does not apply.
- **The 1936 network.** Norte, MZA and Andaluces were the main companies (their share, about two-thirds, is from recall). The Republic took over its lines in August 1936, and MZA was absorbed into RENFE in 1941 ([MZA](https://en.wikipedia.org/wiki/Madrid,_Zaragoza_and_Alicante_railway)). The network was "extensively damaged" in the war. Its total length was not found; about 12,000 km is from recall.
- **Madrid.** The Nationalists cut the southern lines into Madrid. The Republic then built about 91 km toward Tarancon (Vias Verdes measures it from Mejorada del Campo; other sources start at Torrejon de Ardoz) (the "Tren de los 40 dias"), linking the Madrid-Zaragoza and Levante lines to keep Madrid supplied from Valencia ([Vias Verdes](https://viasverdes.com/en/itineraries/tren-40-dias/historia-del-ferrocarril.asp); [FCMAF](https://www.fcmaf.es/Rutometros/RT-40D_01.pdf)). Sources date it to 1937-38 and say it took about ten months and over 10,000 workers. So building rail took many two-week turns.
- **The Army of Africa** moved by truck, not rail, from Seville on 2 August. It took Merida on 10-11 August and Badajoz on 14 August ([Battle of Merida](https://en.wikipedia.org/wiki/Battle_of_M%C3%A9rida)). Rail mattered as junctions to capture: Llerena, and Badajoz, a road and rail junction on the Portuguese border ([Extremadura campaign](https://en.wikipedia.org/wiki/Extremadura_campaign); junction role from recall). The Strait was crossed by air and, from the 5 August convoy, by sea (project research note, `enwiki-airlift-1936`).
- **Precedents.**
  - **[Paths of Glory](https://rulespal.com/paths-of-glory/rulebook):** strategic redeployment points come from a card. A corps costs 1 point and an army 4. Units travel only through friendly, supplied spaces, and only corps may redeploy by sea.
  - **HOI4:** railway level sets supply throughput, and the weakest segment caps the whole route ([GuildOrder](https://guildorder.com/games/hoi4/wiki/supply-and-logistics)).
  - **18xx:** track upgrades one colour step at a time ([18 India](https://insidegmt.com/building-track-in-18-india)).
  - **Unity of Command:** supply spreads along rail from its sources ([forum](https://unityofcommand.net/forums/viewtopic.php?p=19457)).
  - **Recall, unverified:** War in the East's per-turn rail capacity and railheads, Ticket to Ride's claimed city-to-city routes, and Railways of the World's locomotive range.

### Fit with today's engine
- **scenario.json.**
  - Optional `connections[].rail`: `level` (0 to 3), `fromCityId` and `toCityId` (so the line is drawn city to city), and an optional `gauge` for later scenarios.
  - A `railLevels` table: capacity and range per level.
- **New orders.**
  - **`rail-move`:** along rail connections with both ends controlled, never into enemy armies. It is validated like M11 reinforcement, so it never fights on arrival.
  - **`build-rail`:** costs Funds and takes several turns.
- **Order rules.** M1 still allows one order per army. Capacity is checked against the start-of-turn state, so there is no race between factions. A line needs both ends held, so no line is shared in a turn. Planning never offers a rail move beyond a line's capacity, and an over-capacity submission is rejected before lock, so M9 never disbands an army for it.
- **On capture,** a line drops one level (M7 cleanup).
- **map.json.** Rail polylines between cities, drawn like the sea lanes.
- **AI.** Rail-moves reserves toward the offensive target (D58 staging).

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Lines with level-based capacity and range, plus build and upgrade | Each line carries `capacity(level)` armies a turn. An army moves `range(weakest level)` steps. Lines are built and upgraded one level at a time. | Shows the Madrid-Valencia bottleneck and junction prizes. More numbers on screen. | Med | High |
| B. Faction rail pool (Paths of Glory) | Each faction gets N rail points a turn. Lines gate only where an army can go. | One number, easy to learn. Loses per-line bottlenecks. | Low-Med | High |
| C. Rail for supply only (HOI4) | Lines carry supply, not armies. | Needs mismatch (c) to grow first. | Med | High |
| D. Defer | Fixed network as scenery. | No cost. | None | n/a |

**Recommendation:** Option A, kept small: three levels, rail moves only into friendly ground, a one-level drop on capture, and building or upgrading over several turns. Rail's real role in 1936 was strategic redeployment behind the front (Madrid-Valencia), not the assault itself. Gauge waits for a later scenario.

### Widget
<!-- widget:rail-capacity -->
Choose a 1936 line, its track level and how many armies to send. The widget shows how many move by rail this turn and how far, with the weakest segment capping the route as in HOI4. Capacities and ranges are illustrative.

### Mockup
<!-- mockup:rail-lane -->

### Questions
<!-- questions:5 -->

<!-- idea:4 -->
## Idea 4: City interactions

### Summary
Stop armies being stationed in a city rather than the territory, and make cities interesting: build options, city resources, and different resources from rural ground.

### Findings
- **Cities are labels today.**
  - `cityId` on a unit is set only from the scenario's starting positions (`initialGameState` in `engine/resolution.ts`) and is used to draw the counter at the city (`CounterLayer.tsx`).
  - No rule reads it: M24 checks who controls a city, not who stands in it, and M7 makes a territory's cities follow its control. So "stationed in a city" is a display artefact.
- **Cities as places held.**
  - [Here I Stand](https://rulespal.com/here-i-stand/rulebook) makes fortified cities separate places: "A power must successfully besiege a fortified space to gain political control of that city".
  - 1936 is full of this. Oviedo held out under siege inside Republican Asturias, and the Toledo Alcazar held inside a Republican city ([es.wikipedia](https://es.wikipedia.org/wiki/Golpe_de_Estado_en_Espa%C3%B1a_de_julio_de_1936)).
  - Under idea 7 a city sits in a sub-region, and a sub-region cut off from supply (mismatch c) already models most of a siege.
- **Ports.**
  - The scenario's sea connections are ordinary moves, so "all four African counters can land in Andalucia at once" (D32, `milestone-2-rev-6-declog.md`).
  - Historically, about 1,500 men had been flown across by 5 August, and the sea convoy of 5 August carried at least as many again (1,600 to 3,000 by different accounts) (project research note, `enwiki-airlift-1936` and `eswiki-sevilla-1936`).
  - Requiring a controlled port at each end ties sea moves to named ports: Ceuta and Melilla (ports without a city, Q-CITY-7) and Cadiz, Algeciras or Malaga. Malaga was Republican, but Cadiz and Algeciras were held by the rising, so the Strait stays open; ports limit how many armies cross a turn.
- **Airfields** matter only if idea 8 adds aircraft.
- **Rail hubs** are where idea 5's lines meet: Madrid, Albacete, Zaragoza, Badajoz (and Merida, which is not yet a scenario city).
- **Build options** are a common pattern: Paths of Glory trench levels ([rules](https://rulespal.com/paths-of-glory/rulebook)), 18xx station tokens, and HOI4 supply hubs that are built ([GuildOrder](https://guildorder.com/games/hoi4/wiki/supply-and-logistics)). The Economy cluster's Option B already has a "build limit per site", which a Depot can raise.

<!-- idea:4-resources -->

### Fit with today's engine
- **Units.** Remove `UnitDefinition.cityId` and `UnitState.cityId`, and loader rule L4. Armies are in a territory, and under idea 7 in their faction's zone.
- **Cities in scenario.json.** Add `cities[].subRegionId` (idea 7), `coastal`, `startingBuildings`, and `buildable[]`. Add a scenario `buildings[]` catalogue: `id`, `turns`, `cost`, and an effect kind from a small fixed set (`recruit-limit`, `yield`, `works`, later `airfield` and `rail-yard`; ports are map features, Q-CITY-7). Effects are data and kinds are code; this keeps the abstraction minimal (coding principles).
- **GameState.** Add `cities[id].buildings` and `cities[id].building` (an in-progress build and its turns left).
- **Orders.** A `build` order is hidden until reveal and paid at reveal, with a refund if the city is lost before it completes.
- **Rules.**
  - **M24** is unchanged.
  - **M7:** a city follows its sub-region.
  - **Sea moves (M2):** gated by ports when the scenario says so.
- **map.json.** City buildings are shown as small glyphs beside the city marker.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Cities as features of a sub-region, with buildings | Armies are never "in" a city. Cities yield, recruit and build one building at a time. Buildings are captured one level down. | Answers the owner's request directly and reuses idea 7. The siege falls out of supply, with no new combat rule. | Med | High |
| B. Cities as separate garrison nodes | A city is a defended point inside its territory, with its own siege and assault (Here I Stand style). | Rich Oviedo and Alcazar stories. Adds a second node layer and a new battle type. | High | Med |
| C. Status quo plus yields | Keep display-only `cityId` and add income only. | Cheap, but does not make cities "more interesting". | Low | High |

**Recommendation:** Option A. Start with three buildings (Depot, Workshop, Fortifications); a Port is a map feature in data, not a building (Q-CITY-7). Add Airfield only if idea 8 adds aircraft, and Rail yard only if idea 5 lands. Handle sieges through supply, not a new rule.

### Widget
<!-- widget:city-yield -->
Choose a city and its buildings to see its yield each turn and the turns to finish each build. Base yields are the Economy cluster's illustrative table; building effects and turns are illustrative.

### Mockup
<!-- mockup:city-build -->

### Questions
<!-- questions:4 -->

<!-- mismatch:c -->
### Mismatch (c): supply is assumed but does not exist
**The problem.**
- The old draft relies on "supplied" three times:
  - contested cities earn income only if supplied;
  - recruitment needs a "controlled, uncontested, supplied" location;
  - a reinforce target must meet "supply requirements".
- No scenario field, M-rule, or engine module mentions supply.

**Proposed resolution.** Add the smallest trace rule, and only for the economy:
- **Supplied ground.** A sub-region (or territory, before idea 7) is supplied when a path runs through ground its faction controls to a controlled city or port feature tagged `supplySource` in `scenario.json` (Ceuta and Melilla are port features, Q-CITY-7). Sea legs count only between ports the faction controls.
- **Effects in Milestone 3:**
  - unsupplied ground yields nothing;
  - unsupplied cities cannot recruit or replenish;
  - no combat effect and no attrition.
- **Cost.** One breadth-first search per faction during cleanup. It would be selected as `rules.supply` in the Engine cluster's module object.
- **What it captures.**
  - The cut-off Republican north stays supplied through Bilbao and Gijon.
  - A surrounded city stops paying. Whether besieged Oviedo is surrounded depends on the Asturias override: if its sub-region touches Northern Galicia or Leon, it stays supplied, as it historically was by the Galician columns from October.
- **Later.** Rail-borne supply (HOI4, Unity of Command) waits for Milestone 4.

<!-- sources -->
- [1833 territorial division of Spain (Wikipedia)](https://en.wikipedia.org/wiki/1833_territorial_division_of_Spain)
- [Province of Canary Islands (Wikipedia)](https://en.wikipedia.org/wiki/Province_of_Canary_Islands)
- [Provinces of Spain (Wikipedia)](https://en.wikipedia.org/wiki/Provinces_of_Spain)
- [NUTS statistical regions of Spain (Wikipedia)](https://en.wikipedia.org/wiki/NUTS_statistical_regions_of_Spain)
- [Eionet NUTS 2021 vocabulary](https://dd.eionet.europa.eu/vocabulary/common/nuts2021/view?page=43)
- [Eionet NUTS 2024 vocabulary](https://dd.eionet.europa.eu/vocabulary/common/nuts2024/view?page=43)
- [Golpe de Estado de julio de 1936 (Spanish Wikipedia)](https://es.wikipedia.org/wiki/Golpe_de_Estado_en_Espa%C3%B1a_de_julio_de_1936)
- [Spanish coup of July 1936 (Wikipedia)](https://en.wikipedia.org/wiki/Spanish_coup_of_July_1936)
- [Battle of Majorca (Wikipedia)](https://en.wikipedia.org/wiki/Battle_of_Majorca)
- [Iberian gauge (Wikipedia)](https://en.wikipedia.org/wiki/Iberian_gauge)
- [History of rail transport in Spain (Wikipedia)](https://en.wikipedia.org/wiki/History_of_rail_transport_in_Spain)
- [Railway revolution in Spain (RailTarget)](https://www.railtarget.eu/technologies-and-infrastructure/railway-revolution-in-spain-from-civil-war-battlefield-to-europes-highspeed-leader-8949.html)
- [Madrid, Zaragoza and Alicante railway (Wikipedia)](https://en.wikipedia.org/wiki/Madrid,_Zaragoza_and_Alicante_railway)
- [The 40 Days Train Greenway: history (Vias Verdes)](https://viasverdes.com/en/itineraries/tren-40-dias/historia-del-ferrocarril.asp)
- [Tren de los 40 dias route guide (FCMAF)](https://www.fcmaf.es/Rutometros/RT-40D_01.pdf)
- [Battle of Merida (Wikipedia)](https://en.wikipedia.org/wiki/Battle_of_M%C3%A9rida)
- [Extremadura campaign (Wikipedia)](https://en.wikipedia.org/wiki/Extremadura_campaign)
- [Battle of Badajoz 1936 (Wikipedia)](https://en.wikipedia.org/wiki/Battle_of_Badajoz_(1936))
- [Paths of Glory rulebook (RulesPal)](https://rulespal.com/paths-of-glory/rulebook)
- [Here I Stand rulebook (RulesPal)](https://rulespal.com/here-i-stand/rulebook)
- [HOI4 supply and logistics (GuildOrder)](https://guildorder.com/games/hoi4/wiki/supply-and-logistics)
- [HOI4 dev diary: supply (Paradox forum)](https://admin-forum.paradoxplaza.com/forum/developer-diary/hoi4-dev-diary-early-look-at-at-supply-and-the-coming-year.1466076/page-3)
- [Unity of Command forum: logistics](https://unityofcommand.net/forums/viewtopic.php?p=19457)
- [Unity of Command II manual (not machine-readable)](https://cdn.steamstatic.com/steam/apps/809230/manuals/Manual_-_Unity_of_Command_II_-_Revision_8.pdf)
- [War in the East rulebook index (RulesPal)](https://rulespal.com/war-in-the-east/rulebook)
- [WitE2 rules, 25 Logistics](https://dornshuld.chemistry.msstate.edu/rules/wite2/25-0.html)
- [The Russian Campaign rules (railheads)](https://issuu.com/consimworld/docs/russian_campaign_final_web)
- [Building Track in 18 India (GMT)](https://insidegmt.com/building-track-in-18-india)
- [System18 (18xx wiki)](https://github.com/tobymao/18xx/wiki/System18)
- [TED NUTS ESP level 3 codelist (inconsistent)](https://docs.ted.europa.eu/eforms/1.12/reference/code-lists/nuts-esp-lvl3.html)
