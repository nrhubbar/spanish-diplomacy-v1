# M3 Rev 2 research: history

> Internal research for the design review of `owner-notes.md`. Not player-facing.
> Researcher: `m3r2-research`, 20 Nov 2026.

## Conventions

**Evidence tags**
- **[V]**: verified this session in the fetched text of the cited page.
- **[S]**: from search-result snippets only. The page itself was not read.
- **[P]**: confirmed in earlier project research and cited there. Not re-fetched. Mostly from `project/milestones/milestone-3-ideation/research/` and `project/scenarios/spain-1936-07-31-research.md`.
- **[C]**: read from this repository's code or data.
- **[U]**: unverified. Recall or inference, flagged so nobody builds on it unchecked.

**Organisation.** Sections follow the owner's note numbers. Only notes with a historical dimension appear: 1, 2, 3/7, 5, 6/6a, 12, 13 and 14.

---

## Note 1: Málaga's connection to the Republican zone

### What history says

- **A "Republican peninsula" with one thin land link.**
  - From 18 August 1936, after the Republican siege of Granada was lifted, Málaga became "una especie de península republicana" joined to the rest of the Republic by "un estrecho pasillo que invitaba a ser estrangulado" (a narrow corridor that invited strangling) [V] ([es.wikipedia, Batalla de Málaga (1937)](https://es.wikipedia.org/wiki/Batalla_de_M%C3%A1laga_(1937))).
  - The Republican zone was a coastal strip about 25 miles wide, centred on Málaga, which was also a Republican Navy base [V] ([en.wikipedia, Battle of Málaga (1937)](https://en.wikipedia.org/wiki/Battle_of_M%C3%A1laga_(1937))).
  - Insurgent troops held the line from Granada to Cádiz, including Córdoba and the district centres of Antequera and Ronda. That isolated Málaga "salvo por la carretera de la costa oriental hacia Almería" (except by the eastern coastal road to Almería) [S] (snippet attributed to [Dialnet article 7848647](https://dialnet.unirioja.es/descarga/articulo/7848647.pdf)).
- **The link was a road, not a railway.**
  - Málaga's broad-gauge line left the city northwards only: up the Guadalhorce through Álora to Bobadilla, then on to Córdoba, to Granada (via Loja) and to Sevilla (via Osuna and Utrera) [V] ([Junta de Andalucía, Atlas de la Historia del Territorio de Andalucía, sheet 58, "El ferrocarril de las compañías"](https://ws089.juntadeandalucia.es/atlasterritorio/at/pdf/58_elferrocarrildelascompa%C3%B1%C3%ADas.pdf), map and text).
  - The Andaluces company began with "las líneas Córdoba–Málaga y el ramal Granada–Bobadilla" [S] ([es-academic copy of the eswiki entry on Ferrocarriles Andaluces](https://es-academic.com/dic.nsf/eswiki/285957)).
  - **No coastal railway ran from Málaga to Motril or Almería.** The atlas shows none. Málaga's only other rails were an 800 mm local network of about 105 km, running along the coast from Fuengirola to Torre del Mar and inland to Coín and Ventas de Zafarraya [V] (Atlas sheet 58).
  - Once Antequera and the Bobadilla area were Nationalist, Málaga had **no rail link at all** to Republican Spain. The dates Antequera and Bobadilla fell were not fetched [U].
  - Almería's own railway ran north to Guadix, Moreda, Granada and Linares. It was not continuous to Linares until about 1905 [V] (Atlas sheet 58).
- **The coastal road was fragile.**
  - In January 1937 floods cut the coast road at Motril, which stopped Valencia sending reinforcements and artillery [V] ([es.wikipedia](https://es.wikipedia.org/wiki/Batalla_de_M%C3%A1laga_(1937))).
- **Supply.**
  - Supply was thin. The defenders had about 8,000 rifles, 16 guns and "escasas municiones" (scarce ammunition) [V] (eswiki).
  - Largo Caballero reportedly answered "ni un fusil ni un cartucho más para Málaga" (not one more rifle or cartridge for Málaga), citing Thomas [V] (eswiki).
  - Sea supply is not documented in the pages read [U]. Málaga and Cartagena were the Republican fleet's operating bases after Gibraltar and Tangier were closed to it [V] ([en.wikipedia, Spanish Republican Navy](https://en.wikipedia.org/wiki/Spanish_Republican_Navy)).
- **Defenders.**
  - Estimates run from 12,000 (only 8,000 armed) to 40,000 CNT militia, "completely unprepared". They had no anti-aircraft defence, no trenches or roadblocks, and were short of ammunition [V] ([enwiki](https://en.wikipedia.org/wiki/Battle_of_M%C3%A1laga_(1937))).
- **The fall, 3–8 February 1937.**
  - Preliminary advances began on 17 January. On 22 January Granada's forces took Alhama.
  - On 3 February Queipo de Llano's Army of the South (about 15,000, including Regulares and Requetés) attacked from Ronda in the west.
  - Roatta's CTV, nine motorised Blackshirt battalions with light tanks and armoured cars, attacked from the north on 4–5 February and broke through.
  - On 6 February the Italians reached **Ventas de Zafarraya, which dominated the Almería road**.
  - The city was evacuated on 7 February, and Spanish troops entered on 8 February.
  - The cruisers *Canarias*, *Baleares* and *Almirante Cervera* blockaded and shelled the coast, and the Condor Legion flew support.
  - [V] for all of the above (enwiki and eswiki).
- **La Desbandá.**
  - Refugees, estimated at 15,000 to 150,000, fled east on the Almería road. They were "shelled from the sea, bombed from the air and then machine-gunned" (Preston). An estimated 3,000 to 5,000 were killed [V] (enwiki and eswiki).
  - The road itself "no había sido cortada" (had not been cut) by the Nationalists [V] (eswiki).
  - The front stabilised at Albuñol on 14 February, when the 6th Mixed Brigade and part of the XIII International Brigade arrived from Valencia [V] (eswiki).

### What the game data does today [C]

- `src/scenarios/spanish-civil-war-1936/scenario.json` sets the Málaga sub-territory to holder `republic`, with port 2 and rail 1.
- Its only borders are with `sevilla`, `cadiz`, `cordoba` and `granada`. All four start `south`.
- Granada is a single sub-territory held by `south`. Málaga does **not** border Almería. Historically the province of Granada lies between them, and the coastal strip (Motril, Almuñécar) is in Granada province.
- Earlier project research recorded Granada as "city 20–23 July, la provincia permanece fiel" (the province stays loyal) [P] (`milestone-3-ideation/research/map.md`, citing [eswiki Golpe de Estado de julio de 1936](https://es.wikipedia.org/wiki/Golpe_de_Estado_en_Espa%C3%B1a_de_julio_de_1936)).

### Bearing on note 1

**Refines.**
- The owner's rule is right: you should not move through unfriendly sub-territories.
- But history says Málaga *was* connected, by a single coastal **road** through Granada province's coast to Almería, with **no rail**.
- The current map loses that corridor because Granada province is one all-South sub-territory.
- **Faithful options:**
  - a) Split coastal Granada (Motril) into its own Republican-held sub-territory.
  - b) Start Granada contested.
  - c) Add a road-only Málaga–Almería coastal edge, owned by whoever holds it.
- Any of these makes the Ventas de Zafarraya / Motril chokepoint the thing to cut, which is exactly what the CTV did.

---

## Note 2: balance. Mallorca and the Northern army

### The Balearics

- **Who held what.**
  - Mallorca, Ibiza and Formentera joined the rising [V] ([en.wikipedia, Battle of Majorca](https://en.wikipedia.org/wiki/Battle_of_Majorca)).
  - Menorca stayed Republican for the whole war. It was the last Balearic island in Republican hands and surrendered on 7–9 February 1939, in talks aboard HMS *Devonshire* [S] ([en.wikipedia, Battle of Minorca (1939)](https://en.wikipedia.org/wiki/Battle_of_Minorca_(1939)), search snippets).
  - Ibiza was retaken by Republicans in early August and lost again on 19–20 September 1936 [P] (`map.md`).
  - Valencian militia under Uribarri took Formentera's garrison on 7 August [V] (Battle of Majorca).
- **Bayo's landing.**
  - It landed on 16 August 1936 with about 8,000 militia, naval support (a battleship, a light cruiser, two destroyers and three submarines in the infobox) and ten guns.
  - It got about 12 km inland.
  - Italian supplies and aircraft arrived on 27 August, and the Nationalist counterattack succeeded with air superiority.
  - The evacuation ran from 5 to 12 September, abandoning guns and equipment.
  - The operation was improvised and never approved by Madrid, and the anarchist militias would not commit to it [V] (Battle of Majorca).
- **Nationalist ground forces on Mallorca.**
  - The article text gives 1,200 regular infantry, 300 Guardia Civil and "hundreds" of Falangists. The infobox gives 3,500 regulars and militia, plus 3 bombers and 3 fighters [V] (Battle of Majorca).
  - Earlier project research sourced the Palma regiment (No. 36) at 729 men [P] (`spain-1936-07-31-research.md`, `arzanegui-1993`).
- **An Italian air and naval base.**
  - Italians openly manned the airfields at Palma and Alcúdia, and Italian warships were based in Palma harbour.
  - Mallorca-based aircraft attacked Republican mainland cities.
  - Mussolini added twelve bombers after the weak British and French response, and by January 1938 the number of bombers in the Balearics had doubled.
  - Bonaccorsi ("Conde Rossi") ruled the island as a proconsul [V] ([en.wikipedia, Italian occupation of Majorca](https://en.wikipedia.org/wiki/Italian_occupation_of_Majorca)).
  - Aviazione Legionaria bombers from Mallorca raided Barcelona on 16–18 March 1938 [P] (`military.md`, citing [Bombing of Barcelona](https://en.wikipedia.org/wiki/Bombing_of_Barcelona)).
- **Game data [C].**
  - `south-palma-36` (729 men) sits on Mallorca, and `rep-baleares-37` (655) on Menorca.
  - Mallorca is `south` with port 2, Ibiza is `south`, and Menorca is `republic`.

**Bearing on note 2 (Mallorca): history contradicts outright removal and supports refining it.**
- The garrison was small but real, and it beat an 8,000-man landing, with Italian air.
- What made Mallorca matter after September 1936 was **air and naval basing**, not a field army.
- **Faithful options:**
  - Keep a static garrison that cannot leave the island. It could be a `security` unit, or a unit whose move orders are restricted.
  - Or replace the army with an airfield and bomber presence that Italy feeds.
- **If the island ends up empty, Bayo's landing becomes trivially easy**, which inverts the history.

### Mola's Northern army

- **Short of ammunition, not of men.**
  - Mola's forces had only 26,000 rounds before Franco's 600,000 from Italy and Germany arrived [V] ([en.wikipedia, Campaign of Gipuzkoa](https://en.wikipedia.org/wiki/Campaign_of_Gipuzkoa)).
  - The Guadarrama columns "could not advance on Madrid because of a lack of ammunition", and they waited for Franco's ammunition from Andalusia [V] ([en.wikipedia, Battle of Guadarrama](https://en.wikipedia.org/wiki/Battle_of_Guadarrama)).
- **Small columns.**
  - Serrador went to the Alto del León with "two or three hundred men" (21–25 July). García-Escámez's column took Somosierra on 22 July; the article gives no strength [V] (Battle of Guadarrama).
  - Earlier project research estimated Mola's Sierra columns at about 2,500, a tier 3 estimate [P].
- **The Republic was locally stronger around Madrid.**
  - "Some 40,000 militiamen" were in Madrid in August, in columns of about 300.
  - The Republicans had "artillery and air superiority" and short supply lines, but the government had dissolved the regular units and militia chiefs clashed with officers [V] (Battle of Guadarrama).
  - The Sierra front then stayed static until March 1939 [V].
- **Gipuzkoa: what the North could do with help.**
  - Beorlegui attacked Irún with about 3,500 men (the infobox's attribution is ambiguous). He had Ju 52 and Italian bombers, Panzer Is, and the battleship *España*, the cruiser *Almirante Cervera* and the destroyer *Velasco*.
  - The defenders were "poorly armed and untrained" militias, short of ammunition.
  - France closed the frontier on 8 August. Tolosa fell on 11 August, the assault on Irún began on 26 August, and **Irún fell on 3 September** (not the 5th). San Sebastián followed; its date is not given in that article [U for the date].
  - [V] for the rest (Campaign of Gipuzkoa).
- **Game data [C].**
  - North fields 14 ground units, against 16 Republican and 9 Southern.
  - Several North units are besieged or pinned rather than field armies:
    - `north-milan-32` and `north-oviedo-guards` were historically the besieged Oviedo garrison [P] (the scenario research says "Oviedo is besieged", citing `eswiki-oviedo-1936`). When it was relieved (October 1936) is [U].
    - `north-simancas-40` was the besieged Gijón Simancas barracks [P]. When it fell (August 1936) is [U].
  - Whether the engine lets these units march off freely is a data and rules question this research did not check [U].

**Bearing on note 2 (North): history supports a weaker North, refined by how it is weakened.**
- Mola was short of **ammunition and field mobility**, not of garrisons.
- **Options:**
  - Remove one or two field units. The Sierra column and a Castilla regiment are the candidates.
  - Or keep the garrisons but pin Oviedo and Gijón as besieged or static.
  - Or model an ammunition or supply penalty for the first few turns, until the Southern link-up via Mérida and Badajoz.
- The Gipuzkoa campaign shows the North's real early success came with foreign air and naval support against a weak militia. It still took six weeks.

### Northern Republican zone cut off

- The northern Republican area "had been already isolated from the rest of Spain by Nationalist control at the beginning of the war". Its land border with France was cut when Irún and San Sebastián fell in September 1936. It was supplied mainly by sea, on a sea "controlled by the Nationalist navy" [V] ([en.wikipedia, War in the North](https://en.wikipedia.org/wiki/War_in_the_North)).
- The Gipuzkoa article says this left the north "effectively surrounding and isolating" from outside support [V] (Campaign of Gipuzkoa).
- **Bearing:** the game should treat Asturias, Cantabria and Vizcaya as a pocket supplied by sea, the same structure as Málaga but larger. This matters for notes 1 and 6.

---

## Notes 3 and 7: the air war

- **The airlift was the most critical foreign contribution.**
  - Twenty Ju 52s with six He 51 escorts flew from 29 July 1936. About 1,500 men crossed by 5 August [P] (`military.md`, citing [Spanish airlift of 1936](https://wikipedia.com/wiki/Spanish_airlift_of_1936)).
  - The "Convoy de la victoria" brought at least 2,500 more by sea on 5 August, under Italian air cover [V] ([Spanish Republican Navy](https://en.wikipedia.org/wiki/Spanish_Republican_Navy)).
  - Franco "probably would have been defeated" without the airlift [V] ([Air & Space Forces Magazine, "The Condor Legion"](https://www.airandspaceforces.com/article/0213condor/)).
- **The Condor Legion.**
  - Its strength "seldom exceeded 100 aircraft and 6,000 men". It is called "an instrumental factor rather than a decisive one".
  - It claimed 327 Republican aircraft for 72 lost, and trained more than 500 Spanish aircrews.
  - Von Richthofen shifted it towards army support and dive-bombing. The article says it is "inaccurate" to claim the Luftwaffe discovered close air support in Spain [V] (Air & Space Forces).
- **Soviet aircraft.**
  - The USSR sent about 1,000 aircraft and pilots. The I-15 and I-16 outclassed the He 51.
  - At Guadalajara (March 1937) Soviet-type bombers hit the Italian corps: "the first time in history that airpower had stopped a major ground offensive" (Posey).
  - The advantage "did not last long". The Bf 109 arrived in numbers in spring 1937, and Franco had air superiority from 1937 [V] (Air & Space Forces).
  - SB bomber specifics were not separately verified [U].
- **Air as a multiplier in 1937–38.**
  - In Asturias the Nationalists had over 200 aircraft against 35. Carpet bombing at El Mazuco was possibly among the first such uses against a military target [V] ([War in the North](https://en.wikipedia.org/wiki/War_in_the_North)).
  - At the Ebro, about 500 Nationalist aircraft faced about 35 modern Republican fighters, and bombers cut the pontoon bridges [V] ([Battle of the Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)).
- **Bombing cities.**
  - After the Madrid assault failed, Franco ordered residential areas bombed to terrify the city into surrender. It was counterproductive for morale, and civilian deaths were about 2,000 (Thomas). From early 1937, Republican fighters limited daylight raids [V] ([Siege of Madrid](https://en.wikipedia.org/wiki/Siege_of_Madrid)).
  - The Barcelona raids did not break morale [P] (`military.md`).
- **Guernica, 26 April 1937.**
  - One He 111, then He 51s, then Ju 52s in relays for about 2.5 hours destroyed about three-quarters of the buildings.
  - The death toll is contested: the popular figure is 1,654, against the article's 200–300 [V] (Air & Space Forces).
  - The target was the road and bridge on the Basque line of retreat. The bridge survived [P] (`military.md`).
- **Bearing on notes 3 and 7.**
  - History supports air as a **battle and interdiction multiplier** and as **lift**: close support, cutting bridges and roads, and the airlift.
  - It does not support strategic bombing as decisive. City bombing hardened morale.
  - Air should modify battles and movement more than it destroys buildings.
  - Note 7's "raid points at a sub-territory" fits the real targeting, which was a bridge, a road or a port, not a whole region.

---

## Note 5: ports, heavy industry and arms factories

- **Naval bases.**
  - Ferrol and Cádiz fell to the rebels. Cartagena stayed Republican and was the fleet's main base.
  - The heavy cruiser *Canarias*, under construction at Ferrol, was seized and hastily commissioned [V] ([Spanish Republican Navy](https://en.wikipedia.org/wiki/Spanish_Republican_Navy)).
  - Mahón (Menorca) was a Republican naval base until February 1939 [S] ([Battle of Minorca (1939)](https://en.wikipedia.org/wiki/Battle_of_Minorca_(1939))).
- **Industry by zone.**
  - The Republic held "the centre, the Levant, Catalonia, and the Basque industrial zones". The Nationalists held the food-producing areas [P] ([Britannica, Spain: The Civil War](https://www.britannica.com/place/Spain/The-Civil-War)).
  - Basque iron and steel strengthened the Nationalist economy after the north fell [P] (`economy.md`).
  - Catalan war metal output fell because the Nationalist victories of June to October 1937, including the fall of Asturias, cut supplies to loyal industry [S] (snippet of Jordi Catalan, ["La industria entre la guerra y la revolución, 1936-39"](https://www.usc.es/estaticos/congresos/histec05/a2_catalan.pdf). The PDF returned 503 and was not read).
- **Catalonia had almost no arms industry in 1936.**
  - The Generalitat's War Industries Commission (CIG, created 7 August 1936) converted civilian plants: Hispano-Suiza (1,500 workers), La Maquinista (1,279), Pirelli (1,500) and others.
  - It employed an estimated **50,000–80,000 people** in about 500 workshops [V] ([en.wikipedia, War Industries Commission](https://en.wikipedia.org/wiki/War_Industries_Commission)).
- **Northern arms works.**
  - Eibar sat on the front line, so in 1936 most of its factories were moved elsewhere. Placencia de las Armas was militarised [S] (snippets of [Revista JESB, "Reinventing Eibar"](https://revistes.ub.edu/index.php/JESB/article/download/49856/47170/168526)).
  - Trubia (Asturias) was a state arsenal that built tanks [S] ([Tank Encyclopedia, Trubia-Naval](https://tanks-encyclopedia.com/ww2/spain/Trubia_naval.php); an enthusiast site, low confidence).
  - A Northern industry directorate was formed in August 1936 [S].
- **Not verified this session [U]:**
  - Madrid's industrial weight.
  - Toledo's arms factory.
  - Sevilla's artillery factory.
  - The Murcia and Granada powder works.
  - Asturian coal tonnages.
- **Bearing on note 5.**
  - **Supports** per-sub-territory building lists. Madrid is inland and can never have a port.
  - Ports belong to coastal sub-territories: A Coruña, Ferrol, Gijón, Santander, Bilbao, San Sebastián, Barcelona, Tarragona, Valencia, Alicante, Cartagena, Almería, Málaga, Cádiz, Sevilla (a river port), Huelva, Palma and Mahón.
  - Arms production belongs in Catalonia, Vizcaya and Gipuzkoa, Asturias, and a few state arsenals. It should not be available everywhere.

---

## Notes 6 and 6a: the 1936 railway and road network

### Railways: companies and gauge

- **Gauge.**
  - The broad gauge was six Castilian feet (about 1,668–1,672 mm) [P] ([Iberian gauge](https://en.wikipedia.org/wiki/Iberian_gauge)) [V] (Atlas sheet 58).
  - There was a break of gauge at the French border (Irún, Portbou) [P].
  - Narrow-gauge networks were concentrated in the north (the Cantabrian coast), in Andalusia and in mining districts [V] ([es.wikipedia, Historia del ferrocarril en España](https://es.wikipedia.org/wiki/Historia_del_ferrocarril_en_Espa%C3%B1a)).
  - Named narrow-gauge lines include La Robla (1904), Vasco-Asturiana, Santander–Bilbao, Ferrocarriles Vascongados and Vasco-Navarro [V] (same page).
- **Size.**
  - RENFE took over 12,401 km in 1941 [V] (same page).
  - Norte had 2,093 km in the government zone at the start of the war, which was 56 percent of its network, so about 3,700 km in total [V] ([es.wikipedia, Compañía del Norte](https://es.wikipedia.org/wiki/Compa%C3%B1%C3%ADa_de_los_Caminos_de_Hierro_del_Norte_de_Espa%C3%B1a)).
  - Norte and MZA were the two largest companies. Andaluces was third and was taken over by the state in 1936 (merged into the Oeste company) [V] (Historia del ferrocarril).
- **Wartime.**
  - The Republic seized its lines by decree on 3 August 1936. Workers' committees ran them in practice.
  - In the Nationalist zone the companies survived under military direction [V] (Norte, MZA, Oeste pages).
  - By 1939, 42 percent of the 1936 locomotives were destroyed [V] (Historia del ferrocarril).
  - The Republic built the **"tren de los cuarenta días" (Vía Negrín)**, about 91 km from Torrejón to Tarancón, to bypass the cut Madrid–Alicante line.
  - The Nationalists built Gibraleón–Ayamonte (supply from Portugal) and sections of Val de Zafán during the Ebro battle [V] (Historia del ferrocarril, [Oeste page](https://es.wikipedia.org/wiki/Compa%C3%B1%C3%ADa_Nacional_de_los_Ferrocarriles_del_Oeste)) [P] (Vías Verdes for the 91 km).

### The main lines, with sources

| Line (1936) | Company | Evidence |
|---|---|---|
| Madrid–Ávila–Medina del Campo–Valladolid–(Venta de Baños)–Burgos–Miranda de Ebro–Vitoria–Alsasua–San Sebastián–Irún (633 km) | Norte | [V] Norte page |
| Venta de Baños–Alar del Rey–Reinosa–Santander | Norte | [V] Norte page |
| León–Pajares–Asturias (ramp opened 1884; 70 tunnels; Ujo–Busdongo electrified 1925), branch to the Langreo coalfield | Norte | [V] Norte page |
| Tudela–Castejón–Logroño–Miranda–Bilbao (TB) | Norte | [V] Norte page (route inferred from the company name) |
| Zaragoza–Pamplona; Zaragoza–Huesca; Zaragoza–Lleida–Barcelona (ZPB) | Norte | [V] Norte page |
| Lleida–Reus–Tarragona; Almansa–Valencia–Tarragona (AVT, 1891); Valencia–Utiel | Norte | [V] Norte page |
| Calatayud–Teruel–Valencia (Central de Aragón, a Norte affiliate from 1926) | Norte | [V] affiliate; route [U] |
| Madrid–Segovia (electrification begun in 1935) | Norte | [V] Norte page |
| Madrid–Guadalajara–Zaragoza (350.5 km) | MZA | [V] MZA table |
| Madrid–Aranjuez–Alcázar de San Juan–Albacete–Almansa–Alicante | MZA | [V] MZA table |
| Albacete (Chinchilla)–Murcia–Cartagena | MZA | [V] MZA table |
| Alcázar–Manzanares–**Despeñaperros**–Linares-Baeza–Córdoba–Sevilla–Huelva | MZA | [V] MZA table. Despeñaperros carries "the Alcázar de San Juan–Cádiz railway" and is "the only natural pass of the Sierra Morena between the Meseta and the Guadalquivir" [S] ([Despeñaperros Pass](https://wikipedia.com/wiki/Despe%C3%B1aperros_Pass); [Enciclopèdia Catalana](https://www.enciclopedia.cat/gran-enciclopedia-catalana/despenaperros-0)) |
| Madrid–Ciudad Real–Almorchón–Badajoz; Almorchón–Belmez (to Córdoba); Mérida–Sevilla | MZA | [V] MZA table |
| Aranjuez–Cuenca (a dead end: Cuenca–Utiel was not open in 1936) | MZA | [V] for Aranjuez–Cuenca; the gap is [U] (Historia del ferrocarril lists Cuenca–Utiel only as a 1926 plan) |
| Ariza–Soria–Aranda–Valladolid | MZA | [V] MZA table |
| Madrid–Talavera–Cáceres–Valencia de Alcántara (431 km) | Oeste | [V] Oeste table |
| Plasencia–Salamanca–Zamora–Astorga (Vía de la Plata, 348 km); Ávila–Salamanca; Medina–Salamanca–Fuentes de Oñoro | Oeste | [V] Oeste table |
| Monforte–Ourense–Vigo; Pontevedra–Santiago; Betanzos–Ferrol | Oeste | [V] Oeste table |
| **Zamora–Ourense: not open until 1958** | n/a | [V] Historia del ferrocarril ("Zamora–La Coruña (1958)") |
| **Madrid–Burgos direct: not open until 1968** | n/a | [V] Historia del ferrocarril |
| Burgos–Soria–Calatayud (Santander–Mediterráneo, opened 1927–1930; never reached Santander) | own company | [S] ([es.wikipedia, Ferrocarril Santander-Mediterráneo](https://es.wikipedia.org/wiki/Ferrocarril_Santander-Mediterr%C3%A1neo), snippet) |
| Córdoba–Puente Genil–Bobadilla–Málaga; Bobadilla–Granada; Sevilla–Utrera–Osuna–Bobadilla; Bobadilla–Ronda–Algeciras; Linares–Moreda–Guadix–Almería; Moreda–Granada; Lorca–Baza; Zafra–Huelva | Andaluces, Sur de España, Great Southern, others | [V] Atlas sheet 58 (map) |
| León–Ponferrada–Monforte (Galicia's only link to the Meseta in 1936) | Norte | [U]. It is not named in the Norte text, but it must exist, because Galicia had no other connection before 1958 |
| Baeza–Utiel: never completed | n/a | [V] Historia del ferrocarril ("quedó abandonada") |

### Rough province-to-province broad-gauge adjacency, 1936

**Confidence key:**
- **V**: the line is in a fetched table or text.
- **M**: read off the Andalusia atlas map.
- **I**: inferred from a named route whose intermediate provinces were not stated.
- **U**: needed for connectivity but not found in any source.

This table is derived, not quoted. Treat it as a starting graph to check against a 1936 map.

| From | To | Via / line | Conf. |
|---|---|---|---|
| Madrid | Ávila | Norte trunk | V |
| Madrid | Segovia | Madrid–Segovia | V |
| Madrid | Guadalajara | MZA Madrid–Zaragoza | V |
| Madrid | Toledo | Aranjuez–Castillejo–Toledo branch; Madrid–Talavera (Oeste) | V |
| Madrid | Cuenca | Aranjuez–Cuenca (dead end) | V |
| Madrid | Ciudad Real | Madrid–Ciudad Real; Aranjuez–Alcázar | V |
| Toledo | Cáceres | Talavera–Cáceres (Oeste) | I |
| Ávila | Valladolid | Norte trunk via Medina | V |
| Ávila | Salamanca | Oeste | V |
| Segovia | Valladolid | Segovia–Medina | U |
| Valladolid | Palencia | Norte trunk (Venta de Baños) | V |
| Valladolid | Salamanca | Medina–Salamanca | V |
| Valladolid | Zamora | Medina–Zamora | I |
| Valladolid | Burgos | Ariza–Valladolid via Aranda | I |
| Palencia | Burgos | Norte trunk | V |
| Palencia | Santander | Alar del Rey–Santander | V |
| Palencia | León | Palencia–León | I |
| León | Asturias | Pajares | V |
| León | Zamora | Vía de la Plata (Astorga) | V |
| León | Lugo | Ponferrada–Monforte | U |
| Lugo | Ourense | Monforte–Ourense | V |
| Ourense | Pontevedra | Ourense–Vigo | V |
| Lugo | A Coruña | Monforte–Lugo–Coruña | I |
| Pontevedra | A Coruña | Pontevedra–Santiago (Santiago is in A Coruña province) | V |
| Zamora | Salamanca | Vía de la Plata | V |
| Salamanca | Cáceres | Plasencia–Salamanca | V |
| Burgos | Álava | Miranda–Vitoria | V |
| Burgos | Vizcaya | Miranda–Bilbao (TB) | I |
| Burgos | La Rioja | TB via Haro–Logroño | I |
| Burgos | Soria | Santander–Mediterráneo | S |
| Álava | Navarra | Alsasua | V |
| Navarra | Gipuzkoa | Alsasua–Beasáin–San Sebastián | V |
| Navarra | La Rioja | TB (Castejón) | I |
| Navarra | Zaragoza | ZPB | V |
| Soria | Zaragoza | Calatayud / Ariza | V |
| Soria | Guadalajara | MZA Madrid–Zaragoza main line | I |
| Guadalajara | Zaragoza | MZA main line | I |
| Zaragoza | Huesca | ZPB | V |
| Zaragoza | Lleida | ZPB | V |
| Zaragoza | Teruel | Central de Aragón | I |
| Zaragoza | Tarragona | MZA via Caspe–Reus | I |
| Huesca | Lleida | Monzón | I |
| Lleida | Barcelona | ZPB | V |
| Lleida | Tarragona | Lleida–Reus–Tarragona | V |
| Tarragona | Barcelona | coast line | I |
| Barcelona | Girona | Barcelona–Portbou | I |
| Tarragona | Castellón | AVT | V |
| Castellón | Valencia | AVT | V |
| Teruel | Valencia | Central de Aragón (via Sagunto) | I |
| Valencia | Albacete | Almansa–Valencia (AVT) | V |
| Ciudad Real | Albacete | Alcázar–Albacete | V |
| Albacete | Alicante | MZA | V |
| Albacete | Murcia | Chinchilla–Cartagena | V |
| Murcia | Alicante | Murcia–Alicante | U |
| Murcia | Almería | Lorca–Baza via Huércal-Overa | M |
| Murcia | Granada | Lorca–Baza | M |
| Ciudad Real | Jaén | Despeñaperros | V |
| Ciudad Real | Badajoz | Almorchón | V |
| Jaén | Córdoba | Linares-Baeza–Córdoba | V |
| Jaén | Granada | Linares–Moreda | M |
| Granada | Almería | Moreda–Guadix–Almería | M |
| Granada | Málaga | Bobadilla–Granada | M |
| Córdoba | Sevilla | | V |
| Córdoba | Málaga | via Puente Genil–Bobadilla | M |
| Córdoba | Badajoz | Belmez–Almorchón | V |
| Sevilla | Málaga | Utrera–Osuna–Bobadilla | M |
| Sevilla | Cádiz | Utrera–Jerez–Cádiz | M |
| Sevilla | Huelva | | V |
| Sevilla | Badajoz | Mérida–Sevilla | V |
| Badajoz | Huelva | Zafra–Huelva | M |
| Badajoz | Cáceres | Mérida–Cáceres | I |
| Málaga | Cádiz | Bobadilla–Ronda–Algeciras | M |
| **Málaga** | **Almería** | **none (the coast road only)** | M |
| Asturias | Cantabria | narrow gauge only (Cantabrian coast) | U |
| Cantabria | Vizcaya | Santander–Bilbao narrow gauge | V (named) |
| Vizcaya | Gipuzkoa | Ferrocarriles Vascongados, narrow gauge | V (named) |

**Hubs and junctions this implies.** Medina del Campo (Valladolid), Venta de Baños (Palencia), Miranda de Ebro (Burgos), Alcázar de San Juan (Ciudad Real), Linares-Baeza (Jaén), Bobadilla (Málaga province), Mérida and Almorchón (Badajoz), Zaragoza, and Chinchilla (Albacete). The Norte and MZA material confirms Medina, Venta de Baños, Miranda, Alcázar, Chinchilla and Ariza by name [V]. Bobadilla, Linares and Espeluy are from the atlas [M].

**Poorly served (single line, dead end or late).**
- **Cuenca**: a dead end from Aranjuez.
- **Teruel**: one line.
- **Soria.**
- **Almería**: linked by the 1890s–1900s Linares and Guadix line only.
- **Galicia**: one route to the Meseta, via León and Monforte, until 1958.
- **Málaga**: one exit, via Bobadilla.
- **Huelva's west.**
- **The Cantabrian coast**: broad gauge only by north–south spurs (Pajares, Alar–Santander, Miranda–Bilbao). East–west links were narrow gauge.
- **The Balearics**: island narrow gauge only [U].

### Roads and mountain barriers

- **The Circuito Nacional de Firmes Especiales (1926).**
  - It was created by a Real Decreto-Ley of 10 February 1926 to build asphalt "carreteras asfálticas" for "tráfico moderno".
  - Its itineraries included I Madrid–Burgos–Irún, XIII Madrid–Zaragoza–Barcelona–La Junquera, XII Madrid–Tarancón–Valencia, IX Madrid–Bailén–Córdoba–Sevilla–Cádiz and VII Madrid–Talavera–Mérida–Badajoz, plus III to Oviedo via Valladolid and León, and IV to A Coruña via Ávila, Salamanca and Benavente.
  - The war interrupted most projects. The Republic is credited with about 7,000 km of roads, not attributed to the CNFE alone [V] ([es.wikipedia, Circuito Nacional de Firmes Especiales](https://es.wikipedia.org/wiki/Circuito_Nacional_de_Firmes_Especiales)).
  - No 1936 completion total was found [U].
- **Mountain barriers.**
  - **Guadarrama**: Somosierra and the Alto del León were the two passes Mola's columns took and then held; the front froze there until 1939 [V] (Battle of Guadarrama). Navacerrada was not covered [U].
  - **Pajares**: one rail ramp with 70 tunnels [V] (Norte).
  - **Asturias**: the mountains gave the Republic "excellent defensive positions". The El Mazuco valley held for 33 days with 5,000 men [V] (War in the North).
  - **Despeñaperros**: the only natural pass of the Sierra Morena, carrying both the main road and the railway [S].
  - The Pyrenees were not researched this session [U].
- **Motorisation.**
  - The Army of Africa advanced up the Extremadura road in trucks supplied by Queipo de Llano, not by rail [P] (`map.md`, [Battle of Mérida](https://en.wikipedia.org/wiki/Battle_of_M%C3%A9rida)).
  - The CTV attacked Málaga as motorised Blackshirt battalions [V].
  - At Guadalajara, mud stopped the motorised Italian columns [P] (`military.md`).
  - The Republic's FAI armoured car was built on a GAZ chassis, about 20 of them [S] ([FAI armoured car](https://en.wikipedia.org/wiki/FAI_armoured_car)).
  - **Truck numbers are unverified [U].** Figures circulating online, "under 1,500 Soviet trucks" against "at least 12,000 American trucks to the Nationalists", or 11,787 Soviet trucks, are unsourced and conflict ([search results](https://www.tapatalk.com/groups/missinglynx/gaz-aa-truck-in-spanish-civil-war-t305418.html)). A targeted search for the Ford, Studebaker and GM credit story found nothing.
  - Whether motorised units were strictly road-bound is not stated in any source read [U]. The Guadalajara mud and the Málaga road axis both point that way.
- **Bearing on notes 6 and 6a.**
  - **Supports** a graph. Rail was radial and sparse, with clear junctions and dead ends.
  - The owner's "Madrid–Toledo–Extremadura" example is roughly real. The southern exits from Madrid ran through Aranjuez and Toledo province to Alcázar, and west via Talavera.
  - **Refines** 6a. Roads existed almost everywhere at some quality, and the strategic barriers were a handful of passes.
  - Movement friction in the north is well grounded: Pajares, the Asturian ridges, and no east–west broad gauge.

---

## Note 12: how strong were dug-in defences?

- **Bilbao's Iron Belt (Cinturón de Hierro).**
  - Built from late 1936 for about 50 million pesetas, it had two lines 200–300 m apart.
  - Its weaknesses:
    - It had no depth.
    - Trenches were straight and visible from the air.
    - Nests were built to resist 10.5 cm guns.
    - Only 28 percent of the trenches were in optimal condition.
    - The engineer Goicoechea defected in February 1937 with the plans.
  - After a bombardment of about 150 guns plus Condor and Legionary aircraft (11–12 June 1937), the Navarrese broke the weak Gaztelumendi sector. **Resistance "había durado menos de dos días"** (had lasted less than two days), and other sectors then abandoned the line [V] ([es.wikipedia, Cinturón de Hierro de Bilbao](https://es.wikipedia.org/wiki/Cintur%C3%B3n_de_Hierro_de_Bilbao)).
- **Madrid, November 1936.**
  - Twenty thousand attackers, mostly Regulares with armour and Condor air, met defenders who outnumbered them "by over two to one". The defenders also held the captured attack plans.
  - House-to-house fighting pinned the attackers. They took about three-quarters of the University City, then Franco stopped infantry assaults.
  - The front then froze through University City, the Casa de Campo and Carabanchel until 1939 [V] ([Siege of Madrid](https://en.wikipedia.org/wiki/Siege_of_Madrid)).
  - **Urban terrain and numbers held Madrid, not prepared works.**
- **The Ebro, 25 July – 16 November 1938.**
  - The Republicans held bare, rocky ridges where the ground was **too hard to dig**.
  - The Nationalists ground them down over six counter-offensives, with 500 guns firing over 13,000 rounds a day and roughly 500 aircraft.
  - Casualty estimates range from 50,000–60,000 up to 110,000 [V] ([Battle of the Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)).
- **Mountain fronts held.**
  - Guadarrama stayed static from 1936 to 1939 [V].
  - El Mazuco held 33 days [V].
- **Bearing on note 12.**
  - History supports a **real but bounded** defensive edge that artillery and air superiority, or flanking, can overcome.
  - Ground (mountains, cities) mattered at least as much as digging. Prepared lines that were static and visible failed fast.
  - The owner's 2/4/6 is closer to this than today's 3/6/9 (see `design.md`, note 12).

---

## Note 13: factories and manpower

- The CIG's Catalan war industry employed **50,000–80,000** workers [V].
- "Young men were often conscripted despite efforts to keep them in the factories". Factories gave food advantages to keep workers from leaving for bread queues.
- The biggest problems were "the irregularity of the raw material and the lack of foreign exchange" [V] ([War Industries Commission](https://en.wikipedia.org/wiki/War_Industries_Commission)).
- **Bearing:** **supports** a manpower cost for factories. Factory labour and front-line soldiers came from the same pool, and the war fought over them.

---

## Note 14: control after withdrawal (historical angle)

- No source was read on when a province counted as "held" after one side withdrew.
- Historically, territory went to whoever occupied it. Fronts were lines, and abandoned ground was simply occupied: the Iron Belt sectors "abandoned the line" and were walked into [V] (Cinturón de Hierro).
- **Bearing:** consistent with the owner's rule. The design precedents are in `design.md`.

---

## Unverified items (consolidated)

- Dates of the Nationalist capture of Antequera and Bobadilla.
- Seaborne supply of Republican Málaga.
- San Sebastián's fall date.
- Navacerrada.
- The Pyrenees.
- SB bomber specifics.
- All truck counts.
- Whether motorised units were road-bound.
- Madrid's industry.
- Toledo, Sevilla, Murcia and Granada arms works.
- Rail edges marked I or U in the adjacency table, especially León–Lugo, Segovia–Valladolid, Murcia–Alicante, Asturias–Cantabria and the Cuenca–Utiel gap.
