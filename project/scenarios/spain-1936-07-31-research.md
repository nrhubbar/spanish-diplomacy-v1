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
- `nafziger-1936`: U.S. Army Combined Arms Research Library, Nafziger Collection, [Spanish Army in Quarters: Strengths and Assignments, July 1936](https://cgsc.contentdm.oclc.org/digital/api/collection/p15040coll6/id/9540/download). Used as the baseline garrison order of battle.
- `spanish-defence-human-factor`: Spanish Ministry of Defence, [El factor humano](https://publicaciones.defensa.gob.es/media/downloadable/files/links/e/l/el_factor_humano_adalid_75_.pdf). Used to compare competing strength estimates and avoid false precision.

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

The prewar regiment list and Republican/insurgent zone assignment in `nafziger-1936` provide the baseline. The implementation uses representative regiment or battalion tokens rather than treating every paper formation as a fully effective field unit.

| Operational command | Representative starting formations |
|---|---|
| Republican Government | Wad-Ras No. 1, Covadonga No. 4, Otumba No. 9, Guadalajara No. 10, Badajoz No. 13, Alcantara No. 14, Sevilla No. 34 at Cartagena, Vitoria No. 8 at Malaga, an Asturian workers militia token at Gijon, a Basque loyalist column at Bilbao, and a Santander loyalist column. |
| Northern Insurgent Command | Zamora No. 29, San Marcial No. 22, San Quintin No. 25, America No. 23, Aragon No. 17, Gerona No. 18, La Victoria No. 28, Milan No. 32 at Oviedo, and a Simancas barracks detachment at Gijon. |
| Southern Insurgent Command | Granada No. 6, Lepanto No. 5, Cadiz No. 33, a Spanish Legion detachment, and a Regulares detachment. |

The Asturian militia and detachment tokens are game-scale groupings. Prewar barracks location is not treated as proof that a complete regiment was available for field movement. Future research may replace representative tokens with a more detailed post-uprising order of battle without changing the engine model.

## Known Limitations

- The modern-region SVG cannot show 1936 provincial front lines precisely.
- Spanish Morocco is represented through Ceuta and Melilla rather than a complete protectorate map. Both connect to Andalucia by sea (the Strait of Gibraltar and the Alboran Sea), and the Balearics connect to Catalunya and Valencia. Sea connections are ordinary single-step moves under the `m2-movement` ruleset; naval rules are deferred.
- Naval and air forces are not yet modeled.
- Political groups inside the Republican coalition and insurgent coalition are aggregated into operational commands.
- The resolver still uses Milestone 1 deterministic movement/bounce rules; formation names and approximate strengths do not yet alter combat.
- Recruitment, reinforcements, and income are explicitly deferred to Milestone 3.

## Revision 5 Changes (18 November 2026)

These scenario decisions were made under the Milestone 2 Revision 5 defaults (OD-1 and OD-3). Each needs historical sign-off before release.

- **Canarias out of scope.** The Canary Islands and the Canarias No. 39 regiment were removed from the playable scenario. They had no map geometry and no route to the mainland, so the regiment could never act. Their insurgent alignment is not in doubt; they are simply outside the operational map at this scale.
- **Northern coast garrisons.** Two representative tokens were added: a *Basque Loyalist Column* at Bilbao and a *Santander Loyalist Column*. The scenario previously left Pais Vasco and Cantabria, both loyal in July 1936, with no Republican formation at all, so computer players took them unopposed on turn 1 of every game. Like the existing Asturian militia token, these are game-scale groupings, not specific regiments. They are cited to the broad control sources (`warwick-timeline`) and the garrison baseline (`nafziger-1936`) without page references, and their unit records say that individual formation identities need review. Strengths (700 and 650) are placeholders in line with the other tokens, not claims.
- **Per-formation sources.** Every unit now carries its own `sources` list in `scenario.json` (previously one shared pair). Page or table references are blank where the research does not yet provide them; adding them is the remaining OD-3 work.
- **Dangling references removed.** The Legion and Regulares tokens referred to cities `ceuta` and `melilla`, which were never defined; the Canarias regiment referred to `las-palmas`. The loader now rejects such references, so these were removed. The two detachments stand at their territory anchors.
- **Starting thresholds re-checked.** With 18 territories (10 needed for a territorial victory) and 25 cities (19 needed), no faction starts at a threshold (loader rule L9).
