# Map cluster research notes (ideas 7, 5, 4; mismatch c)

Cluster slug `map`. Written 19 November 2026 against the worktree at branch `m3-ideation`. Ideation only; nothing in the game was changed.

Web access worked. About 25 searches and fetches were used. Failures: the Unity of Command II manual PDF is image-only and could not be read; the HOI4 wiki returned a script error page; the WitE2 rules site failed its TLS check; a gameplay.tips Unity of Command guide returned 404. Those precedents rest on search snippets or recall and are tagged.

## Assumptions

- **A-MAP-1. Turn length is two weeks.** `scenario.json` does not state a turn length (searched for "week", "turn length"; nothing). The owner's weather note says two weeks.
- **A-MAP-2. Graded combat results carry a ground value.** The Military cluster is designing graded d20 results. This cluster assumes each graded result exposes one integer, `ground` (0, 1, 2, ... or `all`), the number of sub-regions that change hands. Any grade names the Military agent picks map onto it.
- **A-MAP-3. Initial sub-region control follows the provincial capital on 31 July 1936.** Where the capital and the countryside differed (Cordoba, Granada, Huelva), the capital decides at scenario start, and the note says so.
- **A-MAP-4. All yields, build times, rail capacities and ranges in the widgets are illustrative.** City yields reuse the Economy cluster's illustrative table (`research/economy.sections.md`, idea 4-resources block) so the two clusters agree.
- **A-MAP-5. Resource names are the Economy cluster's.** Funds and Manpower (its Option B). If the owner picks a different set, the city widget's labels change, not its logic.
- **A-MAP-6. Province adjacency is from recall.** Andalucia's internal province borders, and which provinces touch neighbouring territories, are from recall (unverified). A real implementation derives them from the boundary geometry in the map build (see "Pipeline cost").
- **A-MAP-7. Ceuta and Melilla stay single sub-regions.** They were not provinces in 1936, and NUTS 3 gives each one unit.
- **A-MAP-8. Ungarrisoned enemy ground falls one sub-region per turn (rule P7).** The 31 July start state is left as it is; who holds Caceres and Alava at the start is Q-PART-9.
- **A-MAP-9. These systems plug into the Engine cluster's `rules` object.** The Engine cluster proposes per-area modules (`rules.partition`, `rules.supply`; `research/engine.md` section 6). This cluster's proposals would be `partition: "sub-regions-hybrid"` and `supply: "trace-to-source"`; the names are illustrative.
- **A-MAP-10. Rail validation.** Rail orders beyond a line's capacity are never offered in planning. An order that is invalid at submission is rejected before lock, so M9 disbanding never applies to it.

## 1. Idea 7: sub-partitioning

### 1.1 Does NUTS 3 equal the 1936 provinces? No, with three differences

- **1833 provinces.** The Royal Decree of 30 November 1833 (Javier de Burgos) created 49 provinces, with the Canaries as one province ([1833 territorial division](https://en.wikipedia.org/wiki/1833_territorial_division_of_Spain); [Province of Canary Islands](https://en.wikipedia.org/wiki/Province_of_Canary_Islands)). A Royal Decree of 23 September 1927 split the Canaries into Las Palmas and Santa Cruz de Tenerife, making 50 ([Province of Canary Islands](https://en.wikipedia.org/wiki/Province_of_Canary_Islands)). The Canaries split is the only major border change since 1833 ([Provinces of Spain](https://en.wikipedia.org/wiki/Provinces_of_Spain)). So 1936 had the same 50 provinces as today.
- **Ceuta and Melilla.** "formerly part of Cadiz and Malaga provinces respectively, but are currently not part of any province" ([Provinces of Spain](https://en.wikipedia.org/wiki/Provinces_of_Spain)). In 1936 they were therefore parts of Cadiz and Malaga provinces for provincial purposes, not provinces. When exactly they were detached is not stated on that page (the 1995 autonomy statutes are recall, unverified).
- **NUTS 3.** NUTS 3 for Spain is "Provinces + Islands + Ceuta and Melilla" ([NUTS of Spain](https://en.wikipedia.org/wiki/NUTS_statistical_regions_of_Spain)). The differences from the provinces:
  - **The Balearics split into three:** ES531 Eivissa y Formentera, ES532 Mallorca, ES533 Menorca. These are listed in NUTS 2021 and carried into NUTS 2024 ([Eionet NUTS 2021](https://dd.eionet.europa.eu/vocabulary/common/nuts2021/view?page=43); [Eionet NUTS 2024](https://dd.eionet.europa.eu/vocabulary/common/nuts2024/view?page=43)).
  - **The Canaries split into seven island units** (ES703 to ES709). The 2003 version had two province units, ES701 and ES702 ([NUTS of Spain](https://en.wikipedia.org/wiki/NUTS_statistical_regions_of_Spain)). This is irrelevant here, because the scenario has no Canarias.
  - **Ceuta and Melilla are their own units:** ES630 Ceuta and ES640 Melilla. Each is also a NUTS 2 region (ES63, ES64) ([Eionet NUTS 2021](https://dd.eionet.europa.eu/vocabulary/common/nuts2021/view?page=43)). One TED codelist shuffles these codes; it disagrees with Eionet and Wikipedia and looks like a parsing error ([TED](https://docs.ted.europa.eu/eforms/1.12/reference/code-lists/nuts-esp-lvl3.html)).
- **Verdict.** Use provinces as the historical base. NUTS 3 is "provinces, except the islands are split and the enclaves are counted". The NUTS 3 island split happens to match 1936 better than the province does: Mallorca and Ibiza went with the rising, and Menorca stayed Republican (see 1.3).

### 1.2 Provinces per scenario territory (18 territories, no Canarias)

The scenario's territories are the modern autonomous communities (`scenario.json`), and their provinces are the 1833 ones. The membership below is recall-standard; cross-checked only by the total of 48 + 2 Canarias = 50 ([Provinces of Spain](https://en.wikipedia.org/wiki/Provinces_of_Spain)).

| Territory | 1936 provinces | Count | NUTS 3 units | Splittable by province? |
|---|---|---|---|---|
| Galicia | A Coruna, Lugo, Ourense, Pontevedra | 4 | 4 | yes |
| Asturias | Oviedo | 1 | 1 | **no** (contested today: Oviedo vs Gijon) |
| Cantabria | Santander | 1 | 1 | no |
| Pais Vasco | Alava, Guipuzcoa, Vizcaya | 3 | 3 | yes |
| Navarra | Navarra | 1 | 1 | no |
| La Rioja | Logrono | 1 | 1 | no |
| Aragon | Huesca, Zaragoza, Teruel | 3 | 3 | yes |
| Madrid | Madrid | 1 | 1 | **no** (the siege of Madrid is the war's central battle) |
| Castilla y Leon | Avila, Burgos, Leon, Palencia, Salamanca, Segovia, Soria, Valladolid, Zamora | 9 | 9 | yes |
| Castilla-La Mancha | Albacete, Ciudad Real, Cuenca, Guadalajara, Toledo | 5 | 5 | yes |
| Extremadura | Badajoz, Caceres | 2 | 2 | yes |
| Cataluna | Barcelona, Girona, Lleida, Tarragona | 4 | 4 | yes |
| Valencia | Alicante, Castellon, Valencia | 3 | 3 | yes |
| Islas Baleares | Baleares | 1 | **3** | by NUTS 3 only |
| Andalucia | Almeria, Cadiz, Cordoba, Granada, Huelva, Jaen, Malaga, Sevilla | 8 | 8 | yes |
| Murcia | Murcia | 1 | 1 | no |
| Ceuta | (part of Cadiz in 1936) | 0 | 1 | no |
| Melilla | (part of Malaga in 1936) | 0 | 1 | no |
| **Total** | | **48** | **52** | |

- **Two of the five contested starting territories cannot split at province level:** Asturias, and Baleares by province (NUTS 3 rescues Baleares).
- **Madrid cannot split at either level.** Yet `project/plan.md` section 9.1 uses exactly Madrid ("City Center" against "Western Approaches") as its partition example.
- **`plan.md` section 9.2 says 1 to 5 sub-territories per territory.** Castilla y Leon (9) and Andalucia (8) break that.

**Proposed sub-region set (Option C in the sections):** provinces by default, plus scenario overrides:

- Baleares as its three NUTS 3 islands.
- Asturias split in two: a west and centre around Oviedo, and an east and coast around Gijon. This needs hand-authored geometry or grouped municipalities; geoBoundaries ADM3/ADM4 availability is from recall, unverified.
- Madrid split in three: the city, the Sierra (Guadarrama passes), and the southern approaches (Tajo/Jarama). Also hand-authored.
- Optionally merge Castilla y Leon to about five zones to respect the 1-to-5 rule. Recommended against: the province borders are real, free from the data, and give the northern command room to manoeuvre.

That gives 4+2+1+3+1+1+3+3+9+5+2+4+3+3+8+1+1+1 = **55 sub-regions**, against 18 territories today (about 3.1x).

### 1.3 Province-level control on 31 July 1936 (rough)

Sources: Spanish Wikipedia's province-by-province outcome sections ([Golpe de Estado de julio de 1936](https://es.wikipedia.org/wiki/Golpe_de_Estado_en_Espa%C3%B1a_de_julio_de_1936)); its map is captioned "Situacion de Espana hacia el 25 de julio de 1936". English Wikipedia for Malaga, Jaen, Almeria, Asturias, and Cantabria ([Spanish coup of July 1936](https://en.wikipedia.org/wiki/Spanish_coup_of_July_1936)). The Balearics from [Battle of Majorca](https://en.wikipedia.org/wiki/Battle_of_Majorca) and search snippets. The project's own sources for maps are `country-study-map` and `ubc-july-map` in `project/scenarios/spain-1936-07-31-research.md`.

| Territory | Insurgent (Northern or Southern) | Republic | Divided (capital holder decides at start, A-MAP-3) |
|---|---|---|---|
| Galicia | all 4 ("triunfo facilmente entre los dias 20 y 21 de julio") | | |
| Asturias | Oviedo city (besieged) | rest of the province | split by override: Oviedo zone North, Gijon zone Republic |
| Cantabria | | Santander | |
| Pais Vasco | Alava (taken 19 July) | Vizcaya, Guipuzcoa (rebel pockets in San Sebastian held until 29 July) | |
| Navarra | Navarra | | |
| La Rioja | Logrono (recall, unverified) | | |
| Aragon | Zaragoza, Huesca (capitals) | eastern strip (militia columns) | Teruel: capital rebel, province unclear |
| Madrid | | Madrid | |
| Castilla y Leon | Avila, Segovia, Leon, Burgos, Valladolid, Salamanca; Palencia, Soria, Zamora (recall, unverified) | | Sierra passes contested (Guadarrama battles) |
| Castilla-La Mancha | | Guadalajara (retaken from Madrid), Toledo city (Alcazar holds out), Ciudad Real, Cuenca, Albacete (recall, unverified for the last three) | |
| Extremadura | Caceres ("con la capital incluida, dentro de la zona sublevada") | Badajoz (fell 14 August) | |
| Cataluna | | all 4 | |
| Valencia | | all 3 | |
| Baleares | Mallorca, Eivissa (Ibiza retaken by Republicans in early August, lost again 19-20 September) | Menorca | |
| Andalucia | Sevilla, Cadiz | Malaga, Jaen, Almeria | Cordoba (city 18 July, "una parte importante de la provincia se mantiene fiel"), Granada (city 20-23 July, "la provincia permanece fiel"), Huelva (city taken 29 July, province by late August) |
| Murcia | | Murcia (Cartagena) | |
| Ceuta, Melilla | both | | |

- **Andalucia at start, by capital (A-MAP-3):** Southern 5 (Huelva, Sevilla, Cadiz, Cordoba, Granada), Republic 3 (Malaga, Jaen, Almeria).
- **Cross-check with the scenario.** It matches the scenario's city control for Andalucia (Sevilla, Cordoba, Granada, Cadiz Southern; Malaga Republic).
- **Pre-split territories.** With province sub-regions and the capital rule:
  - **Partitioned at start:** Asturias (via the override), Extremadura, Baleares (via the NUTS3 islands), and Andalucia. Pais Vasco also starts partitioned (Alava Northern), though the scenario has it wholly Republican today.
  - **A flaw: Aragon.** All three capitals were held by the rising, so Aragon would start wholly Northern and lose the Republican militia strip in the east of Huesca, Zaragoza and Teruel provinces. Fixes:
    - assign by researched countryside control (Q-PART-7, third option);
    - split Aragon finer (an override, like Asturias);
    - accept it, since the Catalan columns were advancing into it.

    The widget shows the capital rule as is.

### 1.4 Precedents for partitioned or contested territory

- **Diplomacy.** One unit per province, no partial control. Its only sub-province device is split coasts: Spain, Bulgaria, and St Petersburg each have two coasts a fleet must name (from recall, unverified). That is the precedent for "a territory that is one place for armies but two for fleets".
- **Here I Stand.** Control of a fortified space (key, electorate, fortress) changes only through a successful siege: "A power must successfully besiege a fortified space to gain political control of that city" (2.1). Up to four defending units may withdraw inside, and an assault needs a line of communication (12.1, 13.1) ([Here I Stand rules](https://rulespal.com/here-i-stand/rulebook)). That is the model for a city holding out inside lost ground (Oviedo, the Toledo Alcazar).
- **Paths of Glory.** Trench levels 1 and 2 on a space (11.2) ([Paths of Glory rules](https://rulespal.com/paths-of-glory/rulebook)). Dug-in fronts in one space are already in this game (M22).
- **Area-movement games with control markers.** The common pattern: control is a marker on each area, and an area with units of two sides is "contested" until one side leaves (from recall, unverified). M7 and M27 are this pattern today.
- **plan.md sections 6.3, 6.7, and 9.** Predefined sub-territories, "dormant while a territory is unified", `PartitionedTerritoryControl { zones: ControlledZone[] }`, and no computational geometry. The proposal below follows that design.

### 1.5 The split rule (input: the Military cluster's graded results)

Take as input the graded d20 result's `ground` value k (A-MAP-2). The Military cluster's ladder (`research/military.sections.md`, idea 9) was read after this was drafted, and it fits:
- each grade carries `ground: number | "all"`;
- grades below `defender-gives-ground` give 0;
- `defender-gives-ground` gives 1;
- `defender-pushed-back` gives 2;
- `defender-driven-out` and above give all.

There is no ground-3 grade. The widget uses these names.

| Grade (Military ladder) | ground k | Effect on the target territory |
|---|---|---|
| `attack-stalled` and worse | 0 | nothing changes hands |
| `defender-gives-ground` | 1 | one sub-region changes hands |
| `defender-pushed-back` | 2 | two sub-regions |
| `defender-driven-out` and better | all | every defender-held sub-region (the territory is taken, as today) |

**Rule P0 (entering a partitioned territory from outside).** Today M11 makes any move into a territory where the mover's faction has an army a reinforcement, so it never fights. In a partitioned territory, both factions have armies, so no entry would ever attack. Proposed rule:
- **Attack.** A move from an adjacent territory into a partitioned territory is an attack on the enemy zone (M17 "defended") when at least one enemy-held sub-region borders the origin across the connection used.
- **Reinforcement.** Otherwise it is a reinforcement that joins its own zone (M11).

So the front you meet is the front facing your approach. This is Q-PART-8. The alternative is that every entry joins its own zone and only a Push fights.

**Rule P1 (which sub-regions).** Repeat k times, or until the defender holds no sub-region of the territory:

1. **Candidates.**
   - For an entry from outside, the first pick must be a defender-held sub-region bordering the origin across the connection used.
   - Later picks, and every pick of a Push, are defender-held sub-regions bordering a sub-region the attacker holds in the territory, or bordering the origin.
2. **Pick.** Take the candidate with the most attacker-held neighbours, counting the origin as one neighbour. Ties go to scenario order.
3. **Flip.** The picked sub-region flips to the attacker. Its cities flip with it.

The result is deterministic, needs no die, and grows a contiguous front from the side the attack came from. If no candidate exists (rare), the result's ground is lost and the battle reports it.

**Rule P7 (ungarrisoned enemy ground).** Under the hybrid, armies stand in their faction's zone, not in a particular sub-region. The defenders of a zone are all of its faction's armies in the territory.
- **The problem.** A zone with no army of its holder is ungarrisoned. Read literally, M6 would hand all of it to the first enemy that enters or pushes.
- **Proposed rule.** An unopposed entry or Push takes ground k = 1 (one sub-region, chosen by P1) per turn. Holding never takes ground, as in M7 today.
- **Alternatives.** The whole ungarrisoned zone falls at once (M6 literally), or only the sub-regions bordering the entry fall.
- **What it does to 31 July** (`scenario.json` unit placement):
  - Caceres (Southern) has no Southern army in Extremadura; the only army there is the Republic's Castilla No. 3 in Badajoz.
  - Alava (Northern) has no Northern army in Pais Vasco.
  - Baleares has no armies at all.
  - With P7, the Republic can take Caceres and the Basques Alava on turn 1 with a Push. Each is the zone's only sub-region, so k = 1 takes it.
  - Huelva and Cordoba (Southern) and Jaen and Almeria (Republic) are in garrisoned zones, since Andalucia holds armies of both factions, so they fall only to battle results.
- **Follow-up.** This is a scenario-data issue as much as a rule: if the owner wants Caceres and Alava to hold on turn 1, the start state needs a small garrison in each (for example a Guardia Civil security-forces counter). Assumption A-MAP-8 below.

**Rule P2 (displaced defenders).** Defenders whose sub-region was taken:
- fall back into the nearest sub-region of the same territory their faction still holds (ties: most friendly armies, then scenario order);
- if none is left, retreat under M21;
- if they have nowhere to go, they surrender (M21).

**Rule P3 (territory state).** Territory control is derived from sub-region control:
- "controlled" when one faction holds every sub-region;
- otherwise "partitioned", listing each faction's sub-regions. That is `plan.md`'s `ControlledZone[]`, but derived rather than stored separately.

Today's `contested` kind becomes the partitioned case.

**Rule P4 (fighting inside a partitioned territory).** This replaces M27's automatic standing battles.
- **The Push order.** An army in a partitioned territory may take a **Push** order: its armies attack the other faction's zone there.
- **Order kind.** A Push is a new order kind (`push`), not a `MoveOrder`. A move to its own territory would break M2 (moves follow a connection) and L6 (no self-connections). It is valid only in a partitioned territory, for a non-demoralized army (M23).
- **Tension.** The Military cluster keeps M27 standing battles and has grades 6-7 give ground inside the territory. The coordinator should reconcile the two; Q-PART-4 asks the owner.
- **Works.** Push battles have no works for the attacker and normal works for the defender. Armies without orders entrench in their zone. Rationale: M27 forces a battle every turn in every shared territory, which in a partition world would grind every front automatically. The owner's wording is "a territory becomes contested, with its occupiers in smaller regions", which means stable, holdable fronts. See Q-PART-4.

**Rule P5 (works).** Works are kept per territory per faction: `fortification[territoryId][factionId]`, so both factions in a partitioned territory can dig in. M22's "holds" condition becomes "holds at least one sub-region and has an army there".

**Rule P6 (victory).** A partitioned territory counts for no faction (the same as today's contested). Cities still count for their sub-region's holder. See Q-PART-5.

### 1.6 Movement on sub-regions, "regardless if it has been split": the cost

Measured or read in the code:

- **Map pipeline.** `scripts/build-map.ts` reads one vendored source, geoBoundaries gbOpen ESP **ADM1** (`scripts/sources/geoboundaries/geoBoundaries-ESP-ADM1_simplified.geojson`, SHA-pinned), and emits 16 SVG regions keyed by NUTS 2 codes (`regionSources` in `scripts/map/iberia-1936.ts`: ES11 ... ES62). Sub-regions need:
  - a second vendored source (ADM2 = provinces; that geoBoundaries publishes it is recall, unverified), with its checksum and an `ATTRIBUTION.md` entry;
  - island splitting for Baleares (by polygon part);
  - hand-made overrides for Asturias and Madrid;
  - NUTS 3-style region ids (ES611 ...).

  The map spec already allows several SVG regions per territory (`regions: { [svgElementId]: { territoryId } }`, "Several regions may share one territory"), so the binding only needs an extra `subRegionId`. Sub-region adjacency can be generated from shared border edges in the build; `scripts/map/edgeIndex.ts` already does nearest-edge queries but not shared-edge detection, so that is new code. **Partition display needs all of this whether or not movement uses sub-regions.**
- **Engine.** Movement on sub-regions means:
  - every `MoveOrder.to`, `UnitState.territoryId`, connection, M2 (moves follow connections), M11, M17-M21, and the `deriveSeed` battle ordering move to sub-region ids, a cross-cutting rename of the core state;
  - 55 nodes instead of 18 and many more connections.

  The hybrid keeps the engine's movement graph untouched and adds one map from sub-region to controller.
- **Computer player.** `src/main/ai/computerPlayer.ts` uses `distancesTo` over territories, and D58 plans offensives "within three steps through friendly ground". On sub-regions, three steps cover about a third as much ground, so every weight needs retuning. The soak's freeze measure is five turns without a control change (`src/test/soakRun.ts`); it is 58 percent against a 20 percent budget. Partial gains (k = 1) count as control changes, which should help the freeze rate in either option. Sub-region movement slows advances, which may hurt it.
- **Tempo.**
  - **The history.** The Army of Africa's columns left Seville by truck on 2 August, took Merida on 10-11 August and Badajoz on 14 August ([Battle of Merida](https://en.wikipedia.org/wiki/Battle_of_M%C3%A9rida); [Extremadura campaign](https://en.wikipedia.org/wiki/Extremadura_campaign)), then Talavera on 3 September (from recall, unverified). That is Sevilla, Badajoz, Caceres, Toledo provinces: three province borders in about four to five weeks, or 1.5 per two-week turn.
  - **The arithmetic.** At one sub-region per turn, sub-region movement makes the historical drive impossible. It needs multi-step movement, which is idea 6 (movement points). At territory level today it is Andalucia to Extremadura to Castilla-La Mancha: two moves in two turns, about right.
- **UI.**
  - **Counters.** They are laid out at city or territory anchors (`src/main/map/CounterLayer.tsx` uses `unit.cityId` for the anchor). Sub-regions need 55 anchors (`subRegions[id].unitAnchor` in `map.json`), and stacks spread across more, smaller places on a phone screen.
  - **Planning.** It needs a click per sub-region step.

**Alternative (recommended):** sub-regions for control, income, cities, and supply only; movement, orders, and battles stay territory-level. The entry sub-regions are chosen by adjacency to the origin (rule P1). This delivers the owner's "contested, with its occupiers in smaller regions" and "affect resource collection" at a fraction of the cost. It keeps sub-region movement possible later, because the data (sub-regions, adjacency) is the same.

## 2. Idea 5: rail

### 2.1 History

- **Gauge.** Spain's main networks were built to 1,672 mm, "six Castilian feet"; the 1,668 mm Iberian gauge is a 1955 compromise with Portugal ([Iberian gauge](https://en.wikipedia.org/wiki/Iberian_gauge)). Two explanations are given: hostility to France (an incompatible network is harder for an invader to use), and bigger engines for steep passes ([History of rail transport in Spain](https://en.wikipedia.org/wiki/History_of_rail_transport_in_Spain)).
- **Break of gauge at the French border.** "for over a century, all international traffic crossing the Pyrenees was forced to undergo laborious transshipments at border break-of-gauge stations like Irun and Portbou" (search snippet attributed to [RailTarget](https://www.railtarget.eu/technologies-and-infrastructure/railway-revolution-in-spain-from-civil-war-battlefield-to-europes-highspeed-leader-8949.html)). Madrid to Irun reached the border in 1864 ([History of rail transport in Spain](https://en.wikipedia.org/wiki/History_of_rail_transport_in_Spain)).
  - **Inside Spain there was no break of gauge on the main network.** The narrow-gauge northern lines (metre gauge) are recall, unverified. So gauge conversion, a big deal in War in the East, does not matter here. It matters only for foreign aid crossing from France, which is outside this cluster.
- **Companies.** Norte, MZA (Madrid-Zaragoza-Alicante), and Andaluces ran roughly two-thirds of the broad-gauge network (search snippet citing Fernando F. Sanz). The Republic took over the lines it held in August 1936, run in practice by railwaymen's committees. MZA was absorbed into RENFE on 1 July 1941 ([MZA](https://en.wikipedia.org/wiki/Madrid,_Zaragoza_and_Alicante_railway)). The network was "extensively damaged" in the war ([History of rail transport in Spain](https://en.wikipedia.org/wiki/History_of_rail_transport_in_Spain)). Total length in 1936 was not found; about 12,000 km of broad gauge at RENFE's founding is recall, unverified.
- **Madrid front.**
  - **Building the bypass.** When the Nationalists cut the lines south of Madrid, the Republic built the Torrejon de Ardoz to Tarancon line, about 91 km. It is known as the "Tren de los 40 dias" or "Via Negrin", and the official name is "Ferrocarril de Torrejon de Ardoz a Tarancon". It linked the Madrid-Zaragoza and Madrid-Levante lines to keep Madrid supplied from Valencia ([Vias Verdes history](https://viasverdes.com/en/itineraries/tren-40-dias/historia-del-ferrocarril.asp); [FCMAF route guide](https://www.fcmaf.es/Rutometros/RT-40D_01.pdf)).
  - **Dates and labour.** Sources conflict on dates: construction 1937-1938, first train 8 June 1938 by one account. One account says it was built in about ten months by more than 10,000 men.
  - **For this game:** building new line in wartime took most of a year (many turns at two weeks per turn), and its purpose was a supply corridor, not troop shuttling.
- **Army of Africa.**
  - **Road, not rail.** It advanced **by road in trucks** supplied by Queipo de Llano, from 2 August ([Battle of Merida](https://en.wikipedia.org/wiki/Battle_of_M%C3%A9rida)), and the sources found do not describe rail moves.
  - **Where rail mattered.** It mattered as junctions to take: Llerena, where "two railway lines" met, and Badajoz, which "controlled the principal road and railway links between Merida, Caceres, Madrid, Seville, and Lisbon" (search snippets from [Extremadura campaign](https://en.wikipedia.org/wiki/Extremadura_campaign) and [Battle of Badajoz](https://en.wikipedia.org/wiki/Battle_of_Badajoz_(1936))).
  - **Linking the zones.** Taking Merida and Badajoz linked the northern and southern insurgent zones (from recall, unverified, but standard).
  - **The crossing.** It crossed the Strait mostly **by air** (837 men in 102 round trips in July; about 1,500 by 5 August), per `enwiki-airlift-1936` in `project/scenarios/spain-1936-07-31-research.md`.
  - **For this game:** rail should not be what makes the southern drive work. Junction cities on rail lines are the prize.

### 2.2 Precedents

- **Paths of Glory, strategic redeployment.**
  - **Points.** A card played for SR gives SR points equal to its SR value (9.3.2). One point moves a corps and four move an army (13.1.2).
  - **Route.** Units must be in supply and move only through friendly-controlled spaces; spaces adjacent to the enemy are allowed (13.1.5).
  - **Limits.** A unit may SR once per action round (13.1.3), and only corps may SR by sea, between friendly ports (13.1.7).
  - Source: [Paths of Glory rules](https://rulespal.com/paths-of-glory/rulebook). This is the "rail capacity as a faction pool" model.
- **HOI4.**
  - **Throughput.** Supply flows from the capital through railways to supply hubs, and the railway level is the bottleneck. One guide lists throughput from 15 (level 1) to 35 (level 5), capped by the weakest segment on the path ([GuildOrder HOI4 supply](https://guildorder.com/games/hoi4/wiki/supply-and-logistics); [Paradox dev diary](https://admin-forum.paradoxplaza.com/forum/developer-diary/hoi4-dev-diary-early-look-at-at-supply-and-the-coming-year.1466076/page-3)).
  - **Building.** Hubs are built (cost 20,000 per one guide), and motorisation extends hub range.
  - This is the "weakest link" model. The HOI4 wiki itself did not load.
- **Unity of Command.** Supply spreads along rail from sources, and a truck source does not connect to the rail network ([UoC forum](https://unityofcommand.net/forums/viewtopic.php?p=19457), a user post). Rail repair after capture and rail transfer of units are recall, unverified; the manual PDF ([UoC2 manual](https://cdn.steamstatic.com/steam/apps/809230/manuals/Manual_-_Unity_of_Command_II_-_Revision_8.pdf)) is images only.
- **War in the East (Grigsby).** Rail capacity is a per-side budget per turn, and captured Soviet broad gauge has to be converted by rail repair units, so the railhead lags the front (from recall, unverified). Supporting snippets:
  - A rules index lists "6.0 Rail Movement, 6.1 Rail Capacity" ([rulespal WitE](https://rulespal.com/war-in-the-east/rulebook)), but that may be the SPI board game.
  - WitE2's logistics section says some fuel deliveries "do not use any rail capacity" ([WitE2 rules 25](https://dornshuld.chemistry.msstate.edu/rules/wite2/25-0.html); the fetch failed, snippet only).
  - The Russian Campaign uses railhead markers for "the extent of the rails converted by the Axis" ([Russian Campaign rules](https://issuu.com/consimworld/docs/russian_campaign_final_web)).
- **18xx.**
  - **Tile upgrades.** Track tiles upgrade yellow to green to brown to gray. In 18 India a turn is either up to 4 yellow tiles or one upgrade ([GMT 18 India](https://insidegmt.com/building-track-in-18-india)).
  - **1830.** Green only upgrades yellow and brown only upgrades green (1830 starter rules, search snippet).
  - **Shortages.** System 18 lets a green upgrade free a yellow tile ([System18 wiki](https://github.com/tobymao/18xx/wiki/System18)).
  - This is the model for "build, then upgrade, one step at a time".
- **Ticket to Ride.** Claim a route between two cities by discarding cards of its colour; claimed routes are exclusive (from recall, unverified). The precedent for "a line between two named cities".
- **Railways of the World.** Build track hex by hex, then pay to raise your locomotive's link count, which is how far goods may travel (from recall, unverified; the search found nothing). The precedent for "upgrade raises range".

### 2.3 Design notes

- **Where lines go.** Rail lines are scenario data on connections between territories, with named city endpoints so the map can draw them city to city: for example Madrid to Valencia via Albacete is `madrid` to `castilla-la-mancha` to `valencia`.
- **Levels.** Each line has a level 0 to 3: 0 none, 1 single track, 2 double or main line, 3 upgraded.
- **Rail move order.** A new order. The army moves along a chain of rail connections whose both ends its faction controls (uncontested, or the endpoint sub-region held under idea 7), up to `range(level of weakest segment)` steps. It may not enter a territory with enemy armies (the same condition as M11 reinforcement, so it never fights on arrival).
- **Capacity.** Each line carries at most `capacity(level)` armies per turn in total, both directions. Alternative: a PoG-style faction pool.
- **Build and upgrade.** An order on a connection both ends of which the faction controls. It costs Funds, takes turns (illustrative: 4 turns per level; the Torrejon-Tarancon line suggests many more), and one level at a time, as in 18xx.
- **Damage.** When a territory (or the endpoint sub-region) changes hands, lines touching it drop one level (demolition). The new holder can repair them.
- **Genericity.** `gauge` is optional on lines, for WW1 and WW2 scenarios. Not used by Spain in Milestone 3.

## 3. Idea 4: cities as places

### 3.1 Today

- **Starting positions only.** `UnitDefinition.cityId` and `UnitState.cityId` exist (`src/main/engine/types.ts`), and the scenario places most armies in a city. The engine copies `cityId` only when building the initial state (`src/main/engine/resolution.ts` around line 191).
- **Display only.** No rule reads a unit's city:
  - M24 "holds-controlled-city" checks city control, not unit location;
  - M7 makes "its cities follow" territory control.
  - The counter layer uses `cityId` to anchor the counter (`src/main/map/CounterLayer.tsx` line 85).
  - L4 checks that a unit's city is in its territory.
- **Owner's complaint.** Armies appear to be stationed in a city and not the territory, but there is no city-level play.

### 3.2 Proposal

- **Units sit in a territory.** Under idea 7, each faction's armies in a territory sit in that faction's zone.
- **`cityId` on units goes away.** Under idea 7, a city belongs to a sub-region (`subRegions[].cityIds` or `cities[].subRegionId`), and its control follows the sub-region.
- **Garrison or siege (optional; see Q-CITY-5).** A city whose sub-region is surrounded by enemy sub-regions keeps its holder while that holder has an army in the zone, and is cut off from supply (mismatch c).
  - Precedent: Here I Stand, where control changes only by a successful siege ([Here I Stand rules](https://rulespal.com/here-i-stand/rulebook)).
  - History: Oviedo besieged from July, and the Toledo Alcazar ([Golpe de Estado de julio de 1936](https://es.wikipedia.org/wiki/Golpe_de_Estado_en_Espa%C3%B1a_de_julio_de_1936)).
  - The smallest version is no new rule: the city's sub-region gives its defender +1 (like works), and supply does the rest.
- **Build options (all illustrative).** One build at a time per city, cost paid when ordered, hidden until reveal like other orders.

| Building | Turns | Effect |
|---|---|---|
| Depot | 2 | Raises the site's recruit limit by 1 (Economy Option B's "build limit per site"). |
| Workshop | 3 | +1 Funds. |
| Fortifications | 1 | The sub-region's works start at +1 and cap at max +1. |
| Port (coastal cities only) | 3 | Sea connections need a controlled port at each end. |
| Airfield | 2 | Only if idea 8 adds aircraft. Seville's airfield received the airlift (`eswiki-sevilla-1936`, 2,073 Army of Africa personnel reached Seville in July, most by air). |
| Rail yard | 2 | Idea 5: +1 capacity on lines starting at this city. |

- **Capture.** Buildings are captured, not destroyed, and drop one level.
- **Yields.** The Economy cluster's block (`<!-- idea:4-resources -->`) gives cities mostly Funds and rural ground mostly Manpower; this cluster uses its numbers.
- **Ports and the Army of Africa.**
  - **The problem.** D32 (`milestone-2-rev-6-declog.md`) records that "all four African counters can land in Andalucia at once".
  - **The ports.** The Strait connection needs a controlled port at Ceuta and at Cadiz (or Algeciras, not in the scenario). Alboran needs Melilla and Malaga.
  - **The effect.** In July 1936 Malaga is Republican, so the Melilla units cannot cross to Andalucia by sea until Malaga falls or an airfield rule exists.
  - That is a real historical constraint: the airlift existed because the fleet stayed Republican (from recall, unverified for the fleet). It would also shift balance against the Southern command, already at 13 percent of decided games, so it needs care (Q-CITY-6).

## 4. Mismatch (c): supply

- **The old draft's uses.** `project/milestones/milestone3.md` uses "supplied" three times:
  - "A city inside a contested territory produces no income unless the controller also satisfies the scenario's supply rule" (section 4);
  - recruitment locations must be "controlled, uncontested, supplied" (section 5);
  - the reinforce target must "satisfy location/supply requirements" (section 6).
- **Today.** The engine, the scenario spec, and the M-rules have no supply concept (grep of `project/specs/` and `src/main/engine/` for "supply": none). The draft also defers "detailed supply networks and logistics throughput" (section 12).
- **The smallest version.** A sub-region (or territory, before idea 7) is supplied when a path exists through sub-regions its faction controls, plus sea connections between controlled ports, to a controlled **supply source**. A supply source is a city tagged `supplySource: true` in `scenario.json`; for Spain, the provincial capitals with ports or rail hubs would be a good default (illustrative: Madrid, Barcelona, Valencia, Cartagena, Bilbao, Gijon, Burgos, Valladolid, Zaragoza, Seville, Cadiz, Ceuta, Melilla, Palma).
  - **Effects in Milestone 3:** unsupplied ground yields nothing, and unsupplied cities cannot recruit or replenish. No combat effect and no attrition.
  - **Cost:** one breadth-first search per faction per turn, in cleanup.
  - **History it captures:** the Republican north (Asturias, Cantabria, Vizcaya) is cut off from Madrid, but it has its own sources (Bilbao, Gijon), so it stays supplied. Oviedo is besieged with no source inside, so it stops yielding.
- **Rail and supply.** Not linked in Milestone 3. Supply-through-rail (HOI4, Unity of Command) is the obvious Milestone 4 step.

## 5. Options and tradeoffs, mapped to the engine

### Idea 7

| Option | Engine mapping | Cost |
|---|---|---|
| A. Full sub-region movement | Every territory id in `UnitState`, `MoveOrder`, `connections`, M2, M11, M17-M21, M26 ordering, and the AI becomes a sub-region id. | High. Needs idea 6 multi-step movement for history. |
| B. Hybrid (recommended) | New `subRegions[]` in `scenario.json` (`id`, `name`, `territoryId`, `adjacent[]` across borders, `cityIds`), with `GameState.subRegionControl`. `control` is derived (P3). M6/M7, M17/M18 occupation (P1), M21 (P2), M22 (P5), M24 (city via sub-region), M27 replaced by Push (P4), M10 (P6). New loader rules: sub-region refs resolve; each territory's sub-regions are internally connected; a cross-territory sub-region adjacency implies a territory connection. Map: `regions[...].subRegionId`, `subRegions[id].unitAnchor` and label. Pipeline: ADM2 source, island split, two overrides. | Medium. |
| C. Two fixed halves per territory | Generic "zone A/B" per territory, no geography. | Low, but not historical, and the owner asked for NUTS3 "or whatever is historical". |
| D. Defer | | None. Losing the plan's core differentiator (`plan.md` section 1: "Territory partitioning / contested front mechanics"). |

### Idea 5

- **A. Rail move along lines with per-line capacity by level, plus build and upgrade (recommended).** It needs `connections[].rail { level, endpoints }`, a `rail-move` order, and a `build-rail` order. Capacity is checked at validation (M1, start-of-turn state). When two factions' rail moves compete for one line, they cannot: lines need both ends controlled by the mover's faction, so a line is never shared in one turn.
- **B. PoG faction pool.** Simpler UI: one number per faction. It loses "this line is the bottleneck", the point of the Madrid-Valencia story.
- **C. Rail only for supply and income (HOI4).** It depends on mismatch c growing, so it waits for Milestone 4.
- **D. Defer.**

### Idea 4

- **A. Cities as sub-region features with buildings (recommended).** Remove unit `cityId`, add `cities[].subRegionId`, `buildings`, `coastal`. Add a `build` order, with buildings in `GameState.cities[id].buildings`.
- **B. Cities as separate garrison nodes (siege model).** A city becomes its own defended point inside a territory. That adds a node layer on top of sub-regions; high cost.
- **C. Keep the status quo and just add yields.** Low cost, but it does not answer "make cities more interesting".

## 6. Draft questions

See `map.questions.json`. Q-PART-1 to 8, Q-RAIL-1 to 6, Q-CITY-1 to 6, Q-MIS-c-1 to 2.
