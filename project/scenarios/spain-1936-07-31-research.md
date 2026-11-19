# Spain Scenario Research: 31 July 1936

## Purpose And Accuracy Standard

This note records the historical basis and game-scale abstractions used by the scenario package `src/main/scenarios/spain-1936-07-31/` (`scenario.json` for rules data, `map.json` for presentation).

The scenario uses 31 July 1936 as one coherent snapshot. Historical control in the first weeks of the war changed quickly and did not follow today's autonomous-community borders. The current SVG cannot draw provincial borders, so regions with material divided control are explicitly marked contested and city control records the important local exceptions.

The game has three operational commands for playability:

- Republican Government.
- Northern Insurgent Command, associated with Emilio Mola's northern zone and advance.
- Southern Insurgent Command, associated with the Seville bridgehead, Francisco Franco, and the Army of Africa.

The northern and southern insurgent commands were cooperating parts of the same uprising, not independent countries. Their separation is a disclosed scenario abstraction. Unit strengths are approximate game metadata, not claims of exact effective strength on 31 July.

## Source Catalog

- `warwick-timeline`: University of Warwick Modern Records Centre, [Illustrated timeline of the Spanish Civil War](https://warwick.ac.uk/services/library/mrc/collections/digital/scw/simpletimeline2/). Used for the July chronology, terminology, and broad initial control.
- `spanish-memory`: Spain Ministry of Territorial Policy and Democratic Memory, [Por vuestra libertad y la nuestra](https://mptmd.gob.es/content/dam/mpt/memoria-democratica/publicaciones-memoria/catalogos_y_monografias/Por%20vuestra%20libertad%20y%20nuestra%20%28catalogo%29_WEB.pdf). Used for the uprising, initial rebel successes, and failure to seize Madrid and Barcelona.
- `country-study-map`: U.S. Marine Corps, [Spain: A Country Study](https://www.marines.mil/portals/1/Publications/Spain%20Study_1.pdf?ver=2012-10-11-163301-923), Figure 4. Used for the comparative July control map.
- `ubc-july-map`: University of British Columbia Press, [Spain, July 1936](https://www.ubcpress.ca/asset/9430/1/9780774814171.pdf). Used for the insurgent/Republican zones and important city locations.
- `nafziger-1936`: U.S. Army Combined Arms Research Library, Nafziger Collection, [Spanish Army in Quarters: Strengths and Assignments, July 1936](https://cgsc.contentdm.oclc.org/digital/api/collection/p15040coll6/id/9540/download). Used as the baseline garrison order of battle. The finding aid lists it as file `936SGAB` (2 pages). **Not accessible on 18 November 2026:** the download returns a bot-check page, and the old CARL path (`usacac.army.mil/cac2/CGSC/CARL/nafziger/936SGAB.pdf`) returns 404. Its figures reach this note only through `arzanegui-1993`, which cites it.
- `spanish-defence-human-factor`: Spanish Ministry of Defence, [El factor humano](https://publicaciones.defensa.gob.es/media/downloadable/files/links/e/l/el_factor_humano_adalid_75_.pdf) (Lucas Molina Franco, Pablo Sagarra Renedo, Oscar Gonzalez Lopez; Coleccion Adalid no. 75). Used to compare competing strength estimates and avoid false precision. **Not accessible on 18 November 2026:** the server refused the connection. Wikipedia cites figures from "Molina et al. 2021" (see `enwiki-breakup-1936`); that this is the same book is an inference.

Added in Revision 6. Tier 1 means read directly, with the page stated. Tier 2 means read in a Wikipedia article that footnotes a published work; the underlying page was not seen. Tier 3 means an estimate, with its basis given where it is used.

- `alpert-2013` (tier 1): Michael Alpert, *The Republican Army in the Spanish Civil War, 1936-1939*, Cambridge University Press, 2013. Read pages 1-10 of chapter 1 in the publisher's sample PDF. Page 1 gives the establishment as 101,455 men on the Peninsula, Canaries, and Balearics and 30,383 in the Moroccan Protectorate. Page 2 says the Legion and Regulares "benefited from more intensive training". Chapter 2, "Military and paramilitary forces in Spain on 18 July 1936" (pp. 17-28), was not accessible.
- `puell-2012` (tier 1): Fernando Puell de la Villa, "Julio de 1936: un ejercito dividido?", in Jorge Martinez Reverte (coord.), *Los militares espanoles en la Segunda Republica*, Madrid: Pablo Iglesias, 2012, pp. 77-98. Read in the author's [preprint](https://asehismi.es/catalogo/docs/20200412120103_2012_06_14_Ejercito_dividido_Julio_36.pdf). Page numbers below are the preprint's (pp. 1-17), because the book's own page for each figure is unknown.
- `arzanegui-1993` (tier 1 for the text, but a secondary source): Alberto Arzanegui, "The Spanish Army in 1936", *El Miliciano* no. 1 (1993), translated by Wolf Broszies, [generalstab.org](https://generalstab.org/military_history/spanish-civil-war/the-spanish-army-in-1936/), 2018. It cites the Nafziger Collection for its order of battle. Sections used: the infantry regiment list (nos. 1-40 with garrisons), Army of Africa garrisons, paper strengths, and the infantry barracks-strength table. The web text is badly flattened (see "Deriving Regiment Strengths"). Medium confidence.
- `aportes-2025` (tier 1): Ricardo Rodriguez Cobos, "De la tradicion a la trinchera: formacion, evolucion y unidad de los Tercios de Requetes en Navarra...", *Aportes* no. 119 (3/2025), pp. 109-132. Page 119: Lizarza reported 5,694 red berets (enrolled requetes) in Navarre in March 1935, and 8,000 at the start of 1936. Page 128: the July 1936 mobilisation ran through the Arapiles Mountain Battalion No. 7.
- `asensio-milicias-valencianas` (tier 1, one quotation): Miguel Asensio Gomez, *Las milicias valencianas en la Guerra Civil*, Diputacio de Valencia ([PDF](https://memoriahistorica.dival.es/wp-content/uploads/Las-Milicias-Valencianas-en-la-Guerra-Civil-WEB.pdf)). Page 62 quotes a witness: the workers stormed the Alameda barracks "a los ocho dias", after the garrison had stayed inside. Most of the PDF's text could not be extracted.
- `eswiki-oviedo-1936` (tier 2): Spanish Wikipedia, "Sitio de Oviedo (1936)". It cites Martinez Bande, *Los anos criticos* (2007), pp. 350-351, for the Oviedo garrison: about 660 soldiers, 1,300 Guardia Civil, 270 Asalto, and 300 Carabineros. It cites Fraser, *Blood of Spain* (1979), p. 241, for about 200 defenders of the Simancas barracks at Gijon. Its infobox figure of 10,000 miners' militia has no footnote.
- `eswiki-barcelona-1936` (tier 2): Spanish Wikipedia, "Golpe de Estado de julio de 1936 en Barcelona". It cites Martinez Bande (2007), pp. 315 and 318, for the Badajoz No. 13 and Alcantara No. 14 regiments rising and being defeated. Page 305 gives about 3,000 rebels against a nominal 5,000 reduced by leave. Pages 305-306 give 2,000-3,000 Guardia Civil, 2,800-3,200 Asalto, and about 300 Mossos d'Esquadra. It cites Thomas (1976), p. 275, for 5,000 security forces in total, and Thomas (2001), pp. 237-238, for about 30,000 armed CNT men after the rising.
- `eswiki-madrid-1936` (tier 2): Spanish Wikipedia, "Golpe de Estado de julio de 1936 en Madrid". It cites Martinez Bande (2007), p. 391, for the Wad-Ras No. 1 regiment at Carabanchel staying loyal after its general was killed by his own soldiers. It cites Mendez Luengo (1977), p. 121, for the loyal forces in Madrid: 25 Asalto companies, 14 Guardia Civil companies, and 5 Carabineros companies.
- `enwiki-montana-1936` (tier 2): English Wikipedia, "Siege of the Montana barracks". It cites Fraser (1979), pp. 75-78, for a peacetime garrison of three infantry regiments and an engineer regiment, depleted by summer leave. It cites Thomas (2001) for about 2,000 soldiers and 500 civilian volunteers inside (p. 233), and for about 6,000 Assault and Civil Guards in Madrid (p. 208).
- `eswiki-sevilla-1936` (tier 2): Spanish Wikipedia, "Golpe de Estado de julio de 1936 en Sevilla". It cites Ortiz (2006), p. 144, for 2,073 Army of Africa personnel reaching Seville during July, most by air. It cites Salas, *Sevilla fue la clave* (1992), pp. 168-170, for the two battalions of the Granada No. 6 regiment being under half strength from leave. It cites Espinosa, p. 33, for about 4,000 rebel soldiers in Seville.
- `eswiki-ejercito-africa` (tier 2): Spanish Wikipedia, "Ejercito de Africa (Espana)". Its strength table cites Hugh Thomas, p. 440 (edition not stated): Legion (two Legions) 4,200; Regulares infantry (5 groups of 3 tabors) 8,990; Regulares cavalry 1,416; Cazadores and machine-gun battalions 6,097; Mehal-la 5,442; Mejaznia 1,640; total 34,911.
- `enwiki-breakup-1936` (tier 2): English Wikipedia, "Breakup of Spanish armed forces (1936)". It collects competing estimates with footnotes. Used only to show the spread:
  - Army of Africa: 24,741 (Molina et al. 2021, p. 51), 30,000 (Puell), 40,000 (Beevor 2009, p. 126).
  - About 65,000 men in barracks (Alpert 2013, p. 19; Molina et al., p. 52).
  - Guardia Civil 32,477 (Molina et al., p. 51).
  - Asalto 17,660 (Alpert 2013, p. 19), about 70 percent loyal.
  - Carabineros 14,113 (Alpert 2013, p. 20).
- `enwiki-airlift-1936` (tier 2): English Wikipedia, "Spanish airlift of 1936". It cites Garriga (1980), p. 68, for 837 men carried in 102 round trips in July; Beevor (2009), p. 176, for about 1,500 by 5 August; and Corum (2020), p. 28, for 2,853 carried by German aircraft from 10 to 16 August.
- `eswiki-sierra-1936` (tier 2 or 3): Spanish Wikipedia, "Batalla de Guadarrama" and "Columna Durruti". Serrador's column was "two or three hundred men", and Madrid had about 40,000 militia in columns of about 300; the source footnote for that figure could not be identified. The Durruti column left Barcelona on 24 July with about 2,500 men; that figure has no footnote.

## Territory Control Mapping

| Game territory | Initial state | Confidence and interpretation |
|---|---|---|
| Galicia | Northern insurgent | High; the uprising rapidly controlled Galicia. |
| Asturias | Contested: Republican / Northern insurgent | High; loyalist Gijon and the Oviedo insurgent enclave cannot be represented as one controller. |
| Cantabria | Republican | High; part of the isolated loyal northern coast. |
| Pais Vasco | Republican | Medium; represents the loyal coastal area while acknowledging local political variation. |
| Navarra | Northern insurgent | High; a central northern base of the uprising. |
| La Rioja | Northern insurgent | Medium; grouped with the northern insurgent zone at current map scale. |
| Aragon | Contested: Republican / Northern insurgent | High; Zaragoza/Teruel and the eastern front make whole-region ownership misleading. |
| Madrid | Republican | High; the military uprising failed in Madrid. |
| Castilla y Leon | Northern insurgent | High at the current scale; includes Burgos, Valladolid, and Salamanca. |
| Castilla-La Mancha | Republican | Medium; Toledo is simplified to city occupation rather than a separate Alcazar siege state. |
| Extremadura | Contested: Republican / Southern insurgent | High; the southern advance and Badajoz area cannot be reduced to one controller. |
| Catalunya | Republican | High for war-side control; revolutionary dual power is outside the current faction model. |
| Valencia | Republican | High. |
| Islas Baleares | Contested: Republican / Southern insurgent | High; Mallorca and Minorca did not share the same alignment. |
| Andalucia | Contested: Republican / Southern insurgent | High; Seville, Cordoba, Granada, Cadiz, and Malaga had materially different outcomes. |
| Murcia | Republican | High; includes the Cartagena naval base at game scale. |
| Ceuta | Southern insurgent | High; part of the African bridgehead. |
| Melilla | Southern insurgent | High; the uprising began in Spanish Morocco. |

No faction begins at the victory threshold. Contested territories do not count toward the 51 percent territorial condition.

## City Objectives

The 25 city records are A Coruna, Oviedo, Gijon, Santander, Bilbao, San Sebastian, Pamplona, Burgos, Valladolid, Salamanca, Zaragoza, Teruel, Barcelona, Madrid, Toledo, Badajoz, Valencia, Albacete, Alicante, Cartagena, Seville, Cordoba, Granada, Malaga, and Cadiz.

Each city has its own initial controller and counts toward the 75 percent city condition. City placement is approximate within the source SVG coordinate system. Oviedo/Gijon, Zaragoza/Teruel, the Balearics, and the divided Andalucian cities preserve distinctions that the regional path geometry cannot show.

## Formation Mapping

Revision 6 replaced the Revision 5 tokens with the researched order of battle (35 armies). The table at the end of this note ("Data Table") is the source, and "Revision 6 Applied" records how it reached `scenario.json`.

| Operational command | Starting formations (31 July 1936) |
|---|---|
| Republican Government | Wad-Ras No. 1, Covadonga No. 4, the Madrid guards and Sierra columns (Madrid); the Barcelona guards, the Durruti Column, and the Catalan militia columns (Barcelona); Otumba No. 9 and Guadalajara No. 10 (Valencia); Sevilla No. 34 (Cartagena); Vitoria No. 8 (Malaga); Castilla No. 3 (Badajoz); Valencia No. 21 (Santander); the Asturian miners' militia (Gijon); the Basque loyalist column (Bilbao). |
| Northern Insurgent Command | Zamora No. 29 (A Coruna); San Marcial No. 22 (Burgos); San Quintin No. 25 (Valladolid); La Victoria No. 28 (Salamanca); America No. 23 and the Navarrese requete tercios (Pamplona); Aragon No. 17 and Gerona No. 18 (Zaragoza); Milan No. 32 and the Oviedo guards (Oviedo); the Simancas barracks (Gijon); Mola's Sierra columns (Castilla y Leon). |
| Southern Insurgent Command | Granada No. 6 and the Army of Africa vanguard (Seville); Lepanto No. 5 (Granada); Cadiz No. 33 (Cadiz); the two Legions and the five Regulares groups, as four counters, in Ceuta and Melilla. |

Militia, guard, and colonial counters are game-scale groupings. Prewar barracks location is not treated as proof that a complete regiment was available for field movement.

## Known Limitations

- The modern-region SVG cannot show 1936 provincial front lines precisely.
- Spanish Morocco is represented through Ceuta and Melilla rather than a complete protectorate map. Both connect to Andalucia by sea (the Strait of Gibraltar and the Alboran Sea), and the Balearics connect to Catalunya and Valencia. Sea connections are ordinary single-step moves under the `m2-strength` ruleset; naval rules are deferred, so the whole Army of Africa can cross on turn 1 (D32).
- Naval and air forces are not yet modeled.
- Political groups inside the Republican coalition and insurgent coalition are aggregated into operational commands.
- Strengths are men, but combat value depends only on type and the share of full strength (M12), so relative mass comes from the number of counters (see "How The Combat Formula Shapes This Proposal").
- Recruitment, reinforcements, and income are explicitly deferred to Milestone 3.

## Revision 5 Changes (18 November 2026)

These scenario decisions were made under the Milestone 2 Revision 5 defaults (OD-1 and OD-3). Each needs historical sign-off before release.

- **Canarias out of scope.** The Canary Islands and the Canarias No. 39 regiment were removed from the playable scenario. They had no map geometry and no route to the mainland, so the regiment could never act. Their insurgent alignment is not in doubt; they are simply outside the operational map at this scale.
- **Northern coast garrisons.** Two representative tokens were added: a *Basque Loyalist Column* at Bilbao and a *Santander Loyalist Column*. The scenario previously left Pais Vasco and Cantabria, both loyal in July 1936, with no Republican formation at all, so computer players took them unopposed on turn 1 of every game. Like the existing Asturian militia token, these are game-scale groupings, not specific regiments. They are cited to the broad control sources (`warwick-timeline`) and the garrison baseline (`nafziger-1936`) without page references, and their unit records say that individual formation identities need review. Strengths (700 and 650) are placeholders in line with the other tokens, not claims.
- **Per-formation sources.** Every unit now carries its own `sources` list in `scenario.json` (previously one shared pair). Page or table references are blank where the research does not yet provide them; adding them is the remaining OD-3 work.
- **Dangling references removed.** The Legion and Regulares tokens referred to cities `ceuta` and `melilla`, which were never defined; the Canarias regiment referred to `las-palmas`. The loader now rejects such references, so these were removed. The two detachments stand at their territory anchors.
- **Starting thresholds re-checked.** With 18 territories (10 needed for a territorial victory) and 25 cities (19 needed), no faction starts at a threshold (loader rule L9).

## Revision 6 Research: Strengths, Unit Types, And Order Of Battle (18 November 2026)

This section is workstream G, phase 1 (decisions C4, C16, and C17). It is internal and is never shown in the app. Phase 2 applies the data table at the end to `scenario.json` once the `m2-strength` contract lands. Every proposal here needs historical sign-off (OD-3). Source tiers are defined in the Source Catalog.

### What Could Not Be Verified

- Neither baseline source could be opened in this session (see their catalog entries). No figure in this note is cited to a page of Nafziger or of *El factor humano*.
- No source gives an effective strength for each unit on 31 July. Regiment strengths are present strengths on 18 July, derived per division. Where a unit is known to have been disrupted, the effective strength is a tier 3 estimate.
- Militia sizes in late July are poorly documented; most are tier 3. The game's value model (below) makes their exact size matter little.

### National Figures

| Figure | Value | Source |
|---|---|---|
| Peninsular establishment (with the Canaries and Balearics) | 101,455 men | `alpert-2013` p. 1 (tier 1); `arzanegui-1993` |
| Protectorate establishment | 30,383 men | `alpert-2013` p. 1 (tier 1) |
| Conscripts on summer leave | about half of about 100,000 | `puell-2012` preprint p. 15 (tier 1) |
| Conscripts actually in barracks | 45,200; the insurgents had "slightly more than half" | `puell-2012` p. 16 (tier 1) |
| Guards and Carabineros on establishment | 52,500; 55 percent stayed with the Republic | `puell-2012` pp. 16-17 (tier 1) |
| Protectorate garrison, all insurgent | about 30,000 | `puell-2012` p. 16 (tier 1) |
| Army of Africa, other estimates | 24,741 / 34,911 / 40,000 | `enwiki-breakup-1936`, `eswiki-ejercito-africa` (tier 2) |
| Army of Africa in Seville during July | 2,073 | `eswiki-sevilla-1936`, citing Ortiz p. 144 (tier 2) |
| Men airlifted in July | 837 (one count) to 2,063 (an amateur count) | `enwiki-airlift-1936` (tier 2) |

**Leave and the dissolution decree.** On 18-19 July Casares Quiroga's decree dissolved every unit whose officers had risen and released its troops. Puell calls the result "una desbandada general en los cuarteles" (a general stampede from the barracks), because few units had not seen at least an attempted rising (`puell-2012` p. 15, tier 1). It had no effect on the insurgent units. So for loyal regiments, paper strength (establishment) is greater than strength present on 18 July, which is greater than effective strength on 31 July. The columns sent out from Madrid and elsewhere were "columnas mixtas de soldados, guardias y milicianos" (mixed columns of soldiers, guards, and militia; `puell-2012` p. 5, tier 1). That is why this proposal groups them as militia or security counters instead of regiments.

### Deriving Regiment Strengths

`arzanegui-1993` gives infantry present in barracks by division, split into Republican and Nationalist zones. The web text is flattened, so the zone column for each figure is inferred from the order it appears in. Two rows are suspect:

- One row label reads "SAW". It is assumed here to be VI Division.
- VIII Division (A Coruna) is missing.

The table assumes four line regiments per division, two brigades of two regiments each (`arzanegui-1993`), except where noted.

| Row | Men present | Percent present | Implied establishment | Per regiment |
|---|---|---|---|---|
| I (Madrid), all Republican | 2,957 | 58% | 5,098 | 1,275 (4 regiments) |
| II, Republican zone (Malaga; one regiment) | 785 | 62% | 1,266 | 1,266 |
| II, Nationalist zone | 2,860 | 56% | 5,107 | 1,277 (4 regiments) |
| III (Valencia) | 3,838 | 61% | 6,292 | 1,258 (5 regiments assumed) |
| IV (Catalonia) | 4,335 | 61% | 7,107 | not derived (regiments plus mountain battalions) |
| V, Nationalist zone | 2,618 | 52% | 5,035 | 1,259 (4 regiments) |
| "SAW", read as VI: Republican / Nationalist | 1,643 / 3,261 | 84% / 55% | 1,956 / 5,929 | not derived (mixed with mountain battalions) |
| VII (Valladolid) | 2,802 | 55% | 5,095 | 1,274 (4 regiments) |
| Balearics: Mahon / Palma (one regiment each) | 655 / 729 | 52% / 57% | 1,260 / 1,279 | 1,260 / 1,279 |
| Canaries (two regiments) | 1,475 | 58% | 2,543 | 1,272 |

The single-regiment rows (Malaga, Mahon, Palma) agree with the four-regiment rows within about 1 percent. **Proposal: `fullStrength` = 1,270 for every infantry regiment** (derived establishment, medium confidence). `strength` = 1,270 times the division's percentage present, unless a better unit figure exists. Today's placeholders (700-760) were evidently derived the same way; I Division's 2,957 / 4 = 739.

### Unit Types And Values

Values are attack-defence. A full infantry regiment, 4-6, is the yardstick.

| Type id | Name | Value | Proposed | Historical reason |
|---|---|---|---|---|
| `infantry` | Infantry regiment | 4-6 | 4-6, unchanged | Conscript line infantry: trained for one year, short of modern equipment, and with little manoeuvre doctrine (`alpert-2013` pp. 1-2). Defence is its strength, since it held barracks, towns, and passes. |
| `militia` | Militia column | 3-4 | 3-4, unchanged | Party and union volunteers: numerous and motivated, but short of officers, artillery, and training. They lost in open-field attacks and held built-up areas better. This covers Republican columns and also Carlist requetes. Requetes had more ex-soldiers and served under Army command (`aportes-2025` p. 128), and reviewers may want them at 4-4. Not proposed, to keep four types. |
| `colonial` | Colonial veterans (Legion, Regulares) | 6-5 | 6-5, unchanged | The only professional, campaign-hardened troops, given "more intensive training" (`alpert-2013` p. 2). They were the attacking force of the war's first months. Defence is lower because they were light infantry with little artillery of their own. |
| `security` | Security forces (Guardia Civil, Asalto, Carabineros) | 3-5 | 3-5, unchanged | Disciplined, well armed, and trained for public order and street fighting, but not as field units. They decided the street fighting in Barcelona and Madrid (`eswiki-barcelona-1936`, `enwiki-montana-1936`), and held Oviedo for the rising (`eswiki-oviedo-1936`). |

No value change is proposed. The evidence supports the proposed ordering. It does not support any specific shift on a d6 table. The gap between paper and present strength is modelled through `strength / fullStrength`, not through the type values.

### How The Combat Formula Shapes This Proposal

Workstream E computes each army's value as type value times `strength / fullStrength`, rounded, minimum 1 (task E.2). This has two consequences that phase 2 and the reviewers should see.

1. **Absolute size does not change combat value.** A full 10,000-man militia counter fights exactly like a full 2,500-man one. The only way to show that a side had more men is to give it more counters. The `strength` figures here are true men, so that attrition (`fullStrength / baseValue` men per point) and the counter label are honest. Relative mass comes from the number of counters.
   - The scale aimed for is roughly 1,500-5,000 men of field troops per grouped counter, with historical regiments as the smallest identity unit.
   - Regiments are about 700 men, but their fill ratio (about 0.55) already makes them about half a counter.
   - Very large forces (the Asturian miners, the Barcelona CNT) are under-weighted, to stay within the 35-counter budget. Flagged for OD-3.
   - A future contract change could add a men-per-point scale. That is outside Revision 6.
2. **The fill ratio makes July regiments hollow.** With establishment as `fullStrength`, a regiment at 55-61 percent fights at 2-3 or 2-4 instead of 4-6. For militia and security there is no meaningful establishment, so `fullStrength` = `strength` and they start at full value.
   - Militia had no establishment.
   - Guards were counted on their establishment ("de plantilla", `puell-2012` p. 16).
   - The Army of Africa was in garrison, and no leave figure was found for it.
   - **Attrition under Option A.** One point is `fullStrength / baseValue` men, so a regiment's point is 1,270 / 4, about 318 men. Wad-Ras No. 1 and Covadonga No. 4 hold about 1.7 points, and Granada No. 6 and the Valencia regiments about 1.8-1.9. A single one-point attrition result leaves them under one point, which destroys them. A 700-man regiment (about 2.2 points) survives one point but not two. July regiments are therefore brittle as well as weak. This is the strongest argument for Option B: under Option B a 740-man regiment's point is 185 men and it holds 4 points. Simancas would start under one point under Option A, so its `fullStrength` is set to 400 (see its row).
   This is the historically central fact of July 1936. Most regiments were half empty, and the fighting was done by guards, militia, and the Army of Africa. **Recommendation: Option A, the table as given.** Option B sets `fullStrength` = `strength` for regiments too, as in the tasks file's 740-man example. It would restore every regiment to 4-6 and strengthen the Northern command most (see Balance). Decision for the owner (OD-3).

### Proposed Order Of Battle

Men are on 31 July 1936 unless stated otherwise. "Start" is the value at the start under Option A.

**Republican Government: 11 armies and 7,920 men become 15 armies and 39,130 men.**

| Army | Change | Type | Men / full | Start | Basis |
|---|---|---|---|---|---|
| `rep-wad-ras-1` Wad-Ras No. 1, Madrid | kept | infantry | 550 / 1,270 | 2-3 | Loyal (`eswiki-madrid-1936`). Present 737 at 58% (`arzanegui-1993`). 550 is a tier 3 estimate: a quarter lost to the dissolution stampede (`puell-2012` p. 15). |
| `rep-covadonga-4` Covadonga No. 4, Madrid | kept, flagged | infantry | 550 / 1,270 | 2-3 | Garrison is Madrid (`arzanegui-1993`). Its fate is unverified: the Montana barracks held three unnamed infantry regiments (`enwiki-montana-1936`). If Covadonga was among them, phase 2 should make it a militia column. Same estimate as Wad-Ras. |
| `rep-madrid-security` Madrid Assault and Civil Guards | new | security | 3,000 / 3,000 | 3-5 | About 6,000 in Madrid (`enwiki-montana-1936`, Thomas p. 208). Half are counted here, on the tier 3 assumption that the rest went out in mixed columns (`puell-2012` p. 5). |
| `rep-madrid-sierra-column` Madrid Sierra Columns | new | militia | 5,000 / 5,000 | 3-4 | The columns on the Guadarrama and Somosierra passes: Castillo, Galan, Mangada, and the Fifth Regiment (`eswiki-sierra-1936`). Tier 3 estimate: a fraction of the 40,000 militia reported in Madrid. |
| `rep-barcelona-security` Barcelona Assault and Civil Guards | new; replaces `rep-badajoz-13` | security | 5,000 / 5,000 | 3-5 | Badajoz No. 13 rose and was defeated, and Barcelona was held by the guards (`eswiki-barcelona-1936`: 5,000, Thomas p. 275). |
| `rep-durruti-column` Durruti Column | new; replaces `rep-alcantara-14` | militia | 2,500 / 2,500 | 3-4 | Alcantara No. 14 rose and was defeated (`eswiki-barcelona-1936`). 2,500 at departure on 24 July (`eswiki-sierra-1936`, no footnote, so tier 3). By late July the column was historically on the Aragon front; placement is for OD-3. |
| `rep-catalan-columns` Catalan Militia Columns | new | militia | 5,000 / 5,000 | 3-4 | The other CNT and party columns leaving for Aragon. Tier 3: a fraction of about 30,000 armed CNT men (`eswiki-barcelona-1936`, Thomas 2001 pp. 237-238). |
| `rep-otumba-9` Otumba No. 9, Valencia | kept, flagged | infantry | 580 / 1,270 | 2-3 | Present 775 at 61% (`arzanegui-1993`). The Valencia garrison stayed in barracks, uncommitted, until workers stormed it about eight days after the rising, so on or before 31 July (`asensio-milicias-valencianas` p. 62). 580 is the same tier 3 quarter reduction as Madrid. Whether the regiment still existed as a Republican unit on 31 July is uncertain; phase 2 may make it a militia column (OD-3). |
| `rep-guadalajara-10` Guadalajara No. 10, Valencia | kept, flagged | infantry | 580 / 1,270 | 2-3 | As Otumba No. 9. |
| `rep-sevilla-34` Sevilla No. 34, Cartagena | kept | infantry | 775 / 1,270 | 2-4 | Garrison is Cartagena (`arzanegui-1993`); III Division at 61%. |
| `rep-vitoria-8` Vitoria No. 8, Malaga | kept, flagged | infantry | 785 / 1,270 | 2-4 | II Division's Republican-zone row: 785 at 62% (`arzanegui-1993`), the best-sourced single figure. What happened to it after the failed Malaga rising is unverified. |
| `rep-castilla-3` Castilla No. 3, Badajoz | new | infantry | 740 / 1,270 | 2-3 | Garrison is Badajoz (`arzanegui-1993`); I Division at 58%. Badajoz is Republican in the scenario, and it was the only regiment in Extremadura. Its loyalty comes from the territory control sources; no source on the unit was read. |
| `rep-asturian-militia` Asturian Miners' Militia | kept; type changed | militia | 10,000 / 10,000 | 3-4 | Besieging Oviedo and Gijon's Simancas barracks. 10,000 comes from the `eswiki-oviedo-1936` infobox, with no footnote, so tier 3. |
| `rep-basque-column` Basque Loyalist Column | kept; type changed | militia | 3,000 / 3,000 | 3-4 | Basque militia, Garellano battalion, guards, and miqueletes. Tier 3; no figure found. |
| `rep-santander-column` Santander garrison, Valencia No. 21 | kept; type and name changed | infantry | 1,070 / 1,270 | 3-5 | Regiment No. 21 Valencia was at Santander (`arzanegui-1993`). The figure assumes the 84% Republican-zone rate of the "VI" row applies. Low confidence; its loyalty comes from territory control only. Proposed rename: "Valencia Infantry Regiment No. 21". |

**Northern Insurgent Command: 9 armies and 6,330 men become 12 armies and 15,050 men.**

| Army | Change | Type | Men / full | Start | Basis |
|---|---|---|---|---|---|
| `north-zamora-29` Zamora No. 29, A Coruna | kept | infantry | 700 / 1,270 | 2-3 | VIII Division's row is missing. 55% is a tier 3 estimate, the mean of the Nationalist-zone rows. |
| `north-san-marcial-22` San Marcial No. 22, Burgos | kept | infantry | 700 / 1,270 | 2-3 | "VI" Nationalist-zone row, 55% (`arzanegui-1993`). |
| `north-america-23` America No. 23, Pamplona | kept | infantry | 700 / 1,270 | 2-3 | As San Marcial No. 22. |
| `north-san-quintin-25` San Quintin No. 25, Valladolid | kept | infantry | 700 / 1,270 | 2-3 | VII Division, 55% (`arzanegui-1993`). |
| `north-la-victoria-28` La Victoria No. 28, Salamanca | kept | infantry | 700 / 1,270 | 2-3 | As San Quintin No. 25. |
| `north-aragon-17` Aragon No. 17, Zaragoza | kept | infantry | 660 / 1,270 | 2-3 | V Division Nationalist zone, 52% (`arzanegui-1993`). |
| `north-gerona-18` Gerona No. 18, Zaragoza | kept | infantry | 660 / 1,270 | 2-3 | As Aragon No. 17. |
| `north-milan-32` Milan No. 32, Oviedo | kept | infantry | 660 / 1,270 | 2-3 | About 660 soldiers in Oviedo (`eswiki-oviedo-1936`, citing Martinez Bande pp. 350-351). |
| `north-oviedo-guards` Oviedo Civil and Assault Guards | new | security | 1,870 / 1,870 | 3-5 | 1,300 Guardia Civil, 270 Asalto, and 300 Carabineros with Aranda (same source). They were most of Oviedo's defenders. |
| `north-simancas-40` Simancas barracks, Gijon | kept | infantry | 200 / 400 | 2-3 | About 200 defenders (`eswiki-oviedo-1936`, citing Fraser p. 241). `fullStrength` 400 is a game-scale judgement: the counter is the barracks detachment, not Regiment No. 40. With 1,270 it would start at 0.63 attrition points, under the one-point destruction threshold (see the attrition note). |
| `north-navarre-requetes` Navarrese Requete Tercios | new | militia | 5,000 / 5,000 | 3-4 | 8,000 enrolled at the start of 1936 (`aportes-2025` p. 119). Tier 3: about 5,000 in the field after the Sierra and Gipuzkoa detachments. |
| `north-sierra-column` Mola's Sierra Columns | new | militia | 2,500 / 2,500 | 3-4 | Garcia Escamez (troops plus requete and Falange companies), Serrador (200-300), and Gistau, at Somosierra and the Alto del Leon (`eswiki-sierra-1936`). Tier 3 total. Mixed regulars and volunteers. Placed in Castilla y Leon. |

**Southern Insurgent Command: 5 armies and 3,800 men become 8 armies and 16,613 men.**

| Army | Change | Type | Men / full | Start | Basis |
|---|---|---|---|---|---|
| `south-granada-6` Granada No. 6, Seville | kept | infantry | 600 / 1,270 | 2-3 | Two battalions under half strength (`eswiki-sevilla-1936`, citing Salas pp. 168-170). Tier 3 value inside that bound. |
| `south-lepanto-5` Lepanto No. 5, Granada | kept | infantry | 710 / 1,270 | 2-3 | II Division Nationalist zone, 56% (`arzanegui-1993`). |
| `south-cadiz-33` Cadiz No. 33, Cadiz | kept | infantry | 710 / 1,270 | 2-3 | As Lepanto No. 5. The Regulares tabor landed at Cadiz on 19 July is not counted separately. |
| `south-africa-vanguard` Army of Africa Vanguard, Seville | new | colonial | 2,073 / 2,073 | 6-5 | 2,073 Army of Africa troops reached Seville in July (`eswiki-sevilla-1936`, citing Ortiz p. 144). The tabors landed at Cadiz and Algeciras on 19 July would add roughly 1,200 (tier 3); they are left out. |
| `south-legion` 2nd Legion (Banderas IV-VI), Dar Riffien | kept; name changed | colonial | 1,800 / 1,800 | 6-5 | Legion of 4,200 in two Legions (`eswiki-ejercito-africa`). The garrison is Dar Riffien, at Ceuta (`arzanegui-1993`). Tier 3: less the share already in the vanguard. |
| `south-legion-1` 1st Legion (Banderas I-III), Tauima | new; split from `south-legion` | colonial | 1,800 / 1,800 | 6-5 | The garrison is Tauima, at Melilla (`arzanegui-1993`). As above. |
| `south-regulares` Regulares, Melilla No. 2 and Alhucemas No. 5 | kept; name changed | colonial | 3,570 / 3,570 | 6-5 | Regulares infantry and cavalry total 10,406 in five groups (`eswiki-ejercito-africa`). The eastern two groups, less a proportional share already in the vanguard, are tier 3. |
| `south-regulares-west` Regulares, Tetuan No. 1, Ceuta No. 3, and Larache No. 4 | new; split from `south-regulares` | colonial | 5,350 / 5,350 | 6-5 | As above, for the western three groups. |

**Totals:**

| Faction | Before | After |
|---|---|---|
| Republican Government | 11 armies, 7,920 men | 15 armies, 39,130 men |
| Northern Insurgent Command | 9 armies, 6,330 men | 12 armies, 15,050 men |
| Southern Insurgent Command | 5 armies, 3,800 men | 8 armies, 16,613 men |
| All | 25 armies | 35 armies, the top of the 20-35 budget |

**Not modelled (OD-3):**
- Army of Africa: the Cazadores battalions (6,097) and the Mehal-la and Mejaznia (7,082), which garrisoned the Protectorate.
- Navy and air forces.
- The Balearic regiments, Palma No. 36 (729) and Baleares No. 37 at Mahon (655), both sourced. These would be the first two additions if the budget grows.
- The Alcazar of Toledo, and Cordoba's garrison.

### Expected Balance Effect

Sums of starting values under Option A, attack / defence:

| Faction | Option A | Option B (all `fullStrength` = `strength`) |
|---|---|---|
| Republican Government | 38 / 58 | 53 / 78 |
| Northern Insurgent Command | 27 / 40 | 45 / 67 |
| Southern Insurgent Command | 36 / 34 | 42 / 43 |

- **The Southern command gains most.** Five colonial counters at 6-5 are the strongest attackers on the map. Four of them start in Ceuta and Melilla, and the sea crossing is one ordinary move with no naval rules. So the whole Army of Africa can land in Andalucia on turn 1.
  - Historically the Republican fleet held the crossing to about 1,500 airlifted men by 5 August (`enwiki-airlift-1936`), and the bulk crossed during August.
  - Expect Andalucia and then Extremadura to fall faster than they did historically. The Republican defenders there (Vitoria No. 8 at 2-4, Castilla No. 3 at 2-3) are hollow regiments.
  - This is accurate about quality, but the timing is wrong. A blockade or sea-move limit would fix it; that is not a Revision 6 rule.
- **The Republic gains mass, not punch.** It has the most counters and the best total defence, especially with popular resistance, but weak attack. That matches July 1936: it held its cities and failed to retake Oviedo, Zaragoza, or the Sierra passes.
- **The Northern command loses ground relatively.** Its regiments are hollow (2-3), and its volunteers and Oviedo's guards carry it. Mola's columns did stall in the Sierra, short of ammunition (`eswiki-sierra-1936`). Option B would strengthen it most of the three.
- **No balance target in Milestone 2 (P3).** These are expectations, not tuning goals.

### Popular Resistance (Internal Only)

Decision C17: the Republic gets +1 defence in any territory that holds at least one city the Republic controls at the start of the turn. In battle breakdowns it appears as the named modifier "Popular resistance". It is a deliberate design edge for the Republic. Nothing in the game may describe it as balance.

**Historical grounding.** In July 1936 the rising failed mainly where workers' organisations and loyal guards fought it in the streets:
- Barcelona, where the guards and the CNT defeated a 3,000-man garrison (`eswiki-barcelona-1936`).
- Madrid, where a crowd of about 8,000 with the guards stormed the Montana barracks (`enwiki-montana-1936`).
- Gijon, where the Simancas barracks were besieged (`eswiki-oviedo-1936`).
- Valencia, where the workers stormed the barracks (`asensio-milicias-valencianas` p. 62).

Defence by armed populations of their own cities remained the Republic's strongest suit, most famously in Madrid that November. The modifier models that defensive tenacity. It gives no attack bonus, because the same militias did poorly attacking in open country.

**Where it applies at the start:** every territory with a Republican-controlled city. Those are Asturias (Gijon), Cantabria, Pais Vasco, Catalunya, Madrid, Castilla-La Mancha, Extremadura (Badajoz), Valencia, Murcia, and Andalucia (Malaga). It stops applying wherever the Republic loses its last city in the territory, which keeps it a defensive edge.

### Data Table

For phase 2. `fullStrength` for militia, security, and colonial units equals `strength`, by definition (see above). `status` is `kept`, `changed` (same id, with a new type or name), or `new`. `replaces` names an id that phase 2 removes. Citation keys are in the Source Catalog. `tier` is the weakest tier among the sources for the strength figure. Regiment rows derived from the `arzanegui-1993` barracks table are tier 2 at best: the 1,270 establishment and the zone columns are derivations, and the web source has no page numbers. Simancas (`fullStrength` 400) is the one infantry row whose establishment is not 1,270. `cityId` is blank where the army stands at its territory anchor.

```json
{
  "unitTypes": [
    { "id": "infantry", "name": "Infantry Regiment", "attack": 4, "defence": 6 },
    { "id": "militia", "name": "Militia Column", "attack": 3, "defence": 4 },
    { "id": "colonial", "name": "Colonial Veterans", "attack": 6, "defence": 5 },
    { "id": "security", "name": "Security Forces", "attack": 3, "defence": 5 }
  ],
  "removedUnitIds": ["rep-badajoz-13", "rep-alcantara-14"]
}
```

```csv
id,status,replaces,name,factionId,type,territoryId,cityId,strength,fullStrength,tier,sources
rep-wad-ras-1,kept,,Wad-Ras Infantry Regiment No. 1,republic,infantry,madrid,madrid,550,1270,3,arzanegui-1993;eswiki-madrid-1936;puell-2012
rep-covadonga-4,kept,,Covadonga Infantry Regiment No. 4,republic,infantry,madrid,madrid,550,1270,3,arzanegui-1993;enwiki-montana-1936;puell-2012
rep-madrid-security,new,,Madrid Assault and Civil Guards,republic,security,madrid,madrid,3000,3000,3,enwiki-montana-1936;eswiki-madrid-1936;puell-2012
rep-madrid-sierra-column,new,,Madrid Sierra Columns,republic,militia,madrid,madrid,5000,5000,3,eswiki-sierra-1936;puell-2012
rep-barcelona-security,new,rep-badajoz-13,Barcelona Assault and Civil Guards,republic,security,catalunya,barcelona,5000,5000,2,eswiki-barcelona-1936
rep-durruti-column,new,rep-alcantara-14,Durruti Column,republic,militia,catalunya,barcelona,2500,2500,3,eswiki-sierra-1936;eswiki-barcelona-1936
rep-catalan-columns,new,,Catalan Militia Columns,republic,militia,catalunya,barcelona,5000,5000,3,eswiki-barcelona-1936
rep-otumba-9,kept,,Otumba Infantry Regiment No. 9,republic,infantry,valencia,valencia,580,1270,3,arzanegui-1993;asensio-milicias-valencianas;puell-2012
rep-guadalajara-10,kept,,Guadalajara Infantry Regiment No. 10,republic,infantry,valencia,valencia,580,1270,3,arzanegui-1993;asensio-milicias-valencianas;puell-2012
rep-sevilla-34,kept,,Sevilla Infantry Regiment No. 34,republic,infantry,murcia,cartagena,775,1270,2,arzanegui-1993
rep-vitoria-8,kept,,Vitoria Infantry Regiment No. 8,republic,infantry,andalucia,malaga,785,1270,2,arzanegui-1993
rep-castilla-3,new,,Castilla Infantry Regiment No. 3,republic,infantry,extremadura,badajoz,740,1270,3,arzanegui-1993
rep-asturian-militia,changed,,Asturian Miners' Militia,republic,militia,asturias,gijon,10000,10000,3,eswiki-oviedo-1936
rep-basque-column,changed,,Basque Loyalist Column,republic,militia,pais-vasco,bilbao,3000,3000,3,warwick-timeline
rep-santander-column,changed,,Valencia Infantry Regiment No. 21,republic,infantry,cantabria,santander,1070,1270,3,arzanegui-1993
north-zamora-29,kept,,Zamora Infantry Regiment No. 29,north,infantry,galicia,a-coruna,700,1270,3,arzanegui-1993
north-san-marcial-22,kept,,San Marcial Infantry Regiment No. 22,north,infantry,castilla-y-leon,burgos,700,1270,2,arzanegui-1993
north-san-quintin-25,kept,,San Quintin Infantry Regiment No. 25,north,infantry,castilla-y-leon,valladolid,700,1270,2,arzanegui-1993
north-america-23,kept,,America Infantry Regiment No. 23,north,infantry,navarra,pamplona,700,1270,2,arzanegui-1993
north-aragon-17,kept,,Aragon Infantry Regiment No. 17,north,infantry,aragon,zaragoza,660,1270,2,arzanegui-1993
north-gerona-18,kept,,Gerona Infantry Regiment No. 18,north,infantry,aragon,zaragoza,660,1270,2,arzanegui-1993
north-la-victoria-28,kept,,La Victoria Infantry Regiment No. 28,north,infantry,castilla-y-leon,salamanca,700,1270,2,arzanegui-1993
north-milan-32,kept,,Milan Infantry Regiment No. 32,north,infantry,asturias,oviedo,660,1270,2,eswiki-oviedo-1936;arzanegui-1993
north-simancas-40,kept,,Simancas Barracks Detachment,north,infantry,asturias,gijon,200,400,2,eswiki-oviedo-1936;arzanegui-1993
north-oviedo-guards,new,,Oviedo Civil and Assault Guards,north,security,asturias,oviedo,1870,1870,2,eswiki-oviedo-1936
north-navarre-requetes,new,,Navarrese Requete Tercios,north,militia,navarra,pamplona,5000,5000,3,aportes-2025
north-sierra-column,new,,Mola's Sierra Columns,north,militia,castilla-y-leon,,2500,2500,3,eswiki-sierra-1936
south-granada-6,kept,,Granada Infantry Regiment No. 6,south,infantry,andalucia,seville,600,1270,3,eswiki-sevilla-1936;arzanegui-1993
south-lepanto-5,kept,,Lepanto Infantry Regiment No. 5,south,infantry,andalucia,granada,710,1270,2,arzanegui-1993
south-cadiz-33,kept,,Cadiz Infantry Regiment No. 33,south,infantry,andalucia,cadiz,710,1270,2,arzanegui-1993
south-africa-vanguard,new,,Army of Africa Vanguard,south,colonial,andalucia,seville,2073,2073,2,eswiki-sevilla-1936;enwiki-airlift-1936
south-legion,changed,,2nd Legion of the Tercio (Banderas IV-VI),south,colonial,ceuta,,1800,1800,3,eswiki-ejercito-africa;arzanegui-1993
south-legion-1,new,,1st Legion of the Tercio (Banderas I-III),south,colonial,melilla,,1800,1800,3,eswiki-ejercito-africa;arzanegui-1993
south-regulares,changed,,Regulares Groups Melilla No. 2 and Alhucemas No. 5,south,colonial,melilla,,3570,3570,3,eswiki-ejercito-africa;arzanegui-1993
south-regulares-west,new,,Regulares Groups Tetuan No. 1 Ceuta No. 3 and Larache No. 4,south,colonial,ceuta,,5350,5350,3,eswiki-ejercito-africa;arzanegui-1993
```

`warwick-timeline` stays on every unit as the control source. Phase 2 should add it when writing each unit's `sources` list. Pages for each `sources` entry are in the per-faction tables above.

## Revision 6 Applied (Workstream G Phase 2, 18 November 2026)

Internal. Phase 2 applied the data table above to `src/main/scenarios/spain-1936-07-31/scenario.json`. Everything below needs historical sign-off (OD-3) unless it is marked mechanical.

### What Was Applied

- **35 armies** with the table's ids, names, factions, territories, and cities. No city had to be added. Badajoz No. 13 and Alcantara No. 14 are removed.

  | Faction | Armies | Men | Attack / defence at the start |
  |---|---|---|---|
  | Republican Government | 15 (8 regiments, 5 militia, 2 security) | 39,130 | 53 / 78 |
  | Northern Insurgent Command | 12 (9 regiments, 2 militia, 1 security) | 15,050 | 45 / 67 |
  | Southern Insurgent Command | 8 (3 regiments, 5 colonial) | 16,613 | 42 / 43 |

- **Option B (D31).** `fullStrength` equals `strength` for every army, overriding this note's Option A recommendation. Every army starts at its type's full values. That includes Simancas, which is 200 / 200; its 400 was only an Option A workaround. The regiment establishments derived above (1,270) are kept in this note but not used.
- **Type ids (mechanical).** The table's short ids map to the existing ones: `infantry` to `infantry-regiment`, `militia` to `militia-column`, `colonial` to `colonial-veterans`, `security` to `security-forces`. Names and values are unchanged (4-6, 3-4, 6-5, 3-5).
- **Citations.** Each army cites the table's sources plus `warwick-timeline` as the control source. A citation's `reference` carries only what this note states: a page ("preprint p. 15", "p. 62"), the footnoted work a Wikipedia article cites ("citing Martinez Bande (2007), pp. 350-351"), or the part of a source used ("II Division Nationalist-zone barracks-strength row", "infobox"). Where the note gives nothing, the reference is left out.
- **Sources (mechanical).** The 13 Revision 6 keys join the catalog in `scenario.json`. Titles are ASCII, as in this note. A `url` is set only where this note gives one (`puell-2012`, `arzanegui-1993`, `asensio-milicias-valencianas`). No Wikipedia URL was constructed.
- **`nafziger-1936` is no longer cited by any army.** None of its figures was read directly; they reach the data only through `arzanegui-1993`. It stays in the catalog.
- **Historical notes** are short plain-history sentences taken from each row's basis, saying where a figure is an estimate or unfootnoted. They are not shown in the app.

### Judgements For Historical Review (OD-3)

1. **Option B** itself: July regiments fight at full values although most were about half present. Real head counts still show on counters.
2. **Legion names.** "1st/2nd Legion of the Tercio" became "Tercio Legion No. 1 (Banderas I-III)" and "Tercio Legion No. 2 (Banderas IV-VI)". The counter designation is built from a name's first words and number, and the table's names gave "SLO" and "NLO"; these give "TL1" and "TL2". Reviewers may prefer another English form.
3. **Formation kinds** (shown in the orders pane): regiments and both Legions are `regiment`; Simancas is `battalion`; militia are `column`; guards are `security`; the vanguard and the two Regulares counters (each several groups) are `other`.
4. Every tier 3 estimate in the order of battle above: the Madrid and Valencia regiments' quarter loss to the dissolution, the Madrid guards (half of 6,000), all militia sizes (Sierra columns, Catalan columns, Basque column, requetes, Mola's columns, the unfootnoted 10,000 Asturian miners and 2,500 Durruti Column), and the Legion and Regulares splits.
5. **Placement**: the Durruti Column at Barcelona (historically on the Aragon front by late July), Mola's Sierra columns at the Castilla y Leon anchor, and the Legion and Regulares at the Ceuta and Melilla anchors.
6. Unit loyalties taken from territory control only: Castilla No. 3 (Badajoz) and Valencia No. 21 (Santander). Fates unverified: Covadonga No. 4, Otumba No. 9, Guadalajara No. 10, Vitoria No. 8.
7. Not modelled: the Balearic regiments, Cazadores, Mehal-la and Mejaznia, the Alcazar of Toledo, Cordoba's garrison, the navy, and air forces.

### Map Symbols

Militia, colonial, and security counters have their own symbols (`assets/icons/nato/militia.svg`, `colonial.svg`, `security.svg`), derived from the CC BY-SA infantry symbol: a heavy dashed cross for irregular militia, a crescent for the Army of Africa, and a lozenge badge for the gendarmerie and police. The crescent stands for the Protectorate army as a whole, Legion included; reviewers may prefer a different mark for the Legion.

### Briefings

The objectives and first-turn hints were rewritten for the new opening: Madrid holds two regiments, its guards, and the Sierra columns; Barcelona sends militia columns, not regiments; Oviedo is besieged; the Army of Africa's vanguard is already in Seville. They still end in a choice, state the real victory thresholds, and do not mention the popular resistance edge.

### Computer Player (C18)

Not historical, but recorded here because it plays this order of battle. It scores attacks with the engine's `estimateAttack`: take chance times the territory's stake, plus expected hostile losses, minus expected own losses and the danger left behind at home. Attacks and reinforcements compete in one queue, so a threatened objective is defended before a lesser prize is taken. It combines armies from several origins, holds demoralized armies, and never empties an objective. Under the interim movement rules (until workstream E's battles), no game in the 200-game soak is decided within 30 turns.

