# Military cluster: raw research notes (ideas 8, 9, 6)

Cluster slug `military`. Owner's ideas: 8 (unit types, special effects, recruitment times, generals), 9 (d20 and more graded, faded outcomes, feeding idea 7), 6 (movement points, action points, exhaustion). Also a short contribution to mismatch (b).

## Method and web access

- Web access worked. I used 23 searches and 4 fetches, 27 in total. Two fetches failed:
  - The OCS 4.3 rules mirror at dornshuld.chemistry.msstate.edu failed on a TLS certificate error.
  - The OCS 4.2 rules PDF from mmpgamers.com downloaded, but no PDF text tool is installed (no pdftotext, pypdf or poppler), so I could not read it.
  - OCS detail therefore comes from search snippets of the official chart key and rules summaries, and is marked as such.
- Two fetches worked and were read: the Hannibal: Rome vs. Carthage rulebook and the Europe Engulfed rulebook, both on rulespal.com.
- Most history sources are Wikipedia articles, mirrors, publisher blogs and popular-history sites. They are good enough for "did this matter strategically?" questions, not for precise numbers.
- One search result page carried an embedded instruction to change topic. I ignored it.
- Game data comes from the repository and is exact:
  - `src/main/scenarios/spain-1936-07-31/scenario.json`: `combat.table`, `unitTypes`, `combat.diggingIn {perTurn 1, max 3}`, `belowOneToOne.rollPenalty 1`, `demoralizationFactor 0.5`, and the Popular resistance modifier (+1 Republic defence).
  - `src/main/engine/combat.ts`: `dieFaces` 1-6, `lastRow` 6, `successfulResults`.
  - `project/specs/scenario-package.md`: M1-M27.
- Calibration numbers were computed with a script (scratchpad `mil/calib.js`). The same arithmetic is inside `military.widgets.js`.

## Assumptions

- A-MILITARY-1: Turns are two weeks, per the owner. `scenario.json` records no turn length. Turn 1 is 31 July 1936, so turn n starts 31 July 1936 + 14(n-1) days. That puts Mola's death (3 June 1937) in turn 22, the creation of the Nationalist 1st Cavalry Division (November 1937) at about turn 34, Alfambra (5-8 February 1938) in turn 40, and the Barcelona raids (16-18 March 1938) in turn 43. The game has no turn limit; the soak test stops at 30 turns, in late September 1937, before Alfambra and Barcelona.
- A-MILITARY-2: Idea 7 sub-regions are the Map agent's. I give every d20 grade an explicit ground value (0, 1, 2, or all sub-regions) and a kebab-case id the Map agent can reference. I also give a fallback for when partitioning is rejected.
- A-MILITARY-3: The d20 ladder has 11 grades. Its thresholds are my proposal, calibrated so that the chance to take a territory stays within 5 percentage points of today's d6 table at every odds column with no modifiers.
- A-MILITARY-4: All new unit-type values (artillery 3-2, cavalry 4-3, tank 5-3) are proposals only, measured against the yardstick infantry regiment 4-6 (1,270 men at full establishment, from the Revision 6 research).
- A-MILITARY-5: Recruitment costs, money, and where recruits appear are the Economy and City agents' business. I treat training time as unit data only.
- A-MILITARY-6: For the `mismatch-b` questions I use ids `Q-MIS-b-11` and `Q-MIS-b-12`, so they cannot collide with the Economy agent's lower numbers. The coordinator may renumber them.
- A-MILITARY-7: "Fade the impact" means proportional, partial losses and demoralization instead of all-or-nothing results. Elimination stays only as the top grade, as surrender (M21), and as a strength floor.

## Today's combat, exactly (from the repository)

- The table is `table[column][row]`.
  - Columns: column 0 is below 1:1, then 1:1 to 6:1.
  - Rows: the d6 roll plus modifiers, clamped to 0..6.
  - Column k reads `SEQ[k..k+6]` over `AE AE AA AD BD BD DD DX DE DE DE DE DE`, so the table is already a one-dimensional ladder that shifts one step per odds column.
  - On a d6, one roll point is therefore worth exactly one odds column.
- Chance to take a territory with a bare d6 (results DD, DX, DE), by column 0-6: 16.7, 33.3, 50.0, 66.7, 83.3, 100, 100 percent.
- M15 checks, reproduced by the widget: 2:1 with no modifiers takes the territory 3/6; 3:1 against works at +3 takes it 1/6.
- Today's all-or-nothing pieces:
  - `attacker-eliminated`, `defender-eliminated` and `defender-exchange` destroy whole sides.
  - A one-army side always demoralizes completely (M16, "a side with one army demoralizes it").
  - Attrition (M16) is already partly proportional: the paying side loses men worth the opposing side's value, starting with the highest-value army.

## History (idea 8: which unit types mattered)

### Cavalry
- The battle of Alfambra (5-8 February 1938, part of Teruel) opened with a charge by Monasterio's cavalry division. [Wikipedia: Battle of Alfambra](https://en.wikipedia.org/wiki/Battle_of_Alfambra) calls it "the last great mounted charge in Western Europe".
- A local Teruel source dates the charge to 6 February, from Argente towards Perales de Alfambra: [turismocomarcateruel.com](https://turismocomarcateruel.com/atrincherate-2/trincheras-serretilla-mascaron-camanas-2/).
- El Debate gives about 2,500 to 3,000 riders in five or six regiments, and says Franco created the 1st Cavalry Division under Monasterio in November 1937: [El Debate](https://www.eldebate.com/historia/20260226/batalla-alfambra-3000-jinetes-nacionales-vencieron-republicanos-teruel_389225.html).
- The Republic lost about 20,000 men, about 7,000 of them prisoners (Wikipedia, citing Beevor).
- Other accounts stress the infantry and artillery that broke the line, so the charge's own weight is debated (search summary, same sources).
- Conclusion: cavalry was real but Nationalist-only and marginal. The one famous charge falls at about turn 40, outside a 30-turn game.
- The Army of Africa's Regulares included 1,416 cavalry in 1936 (scenario research note, `eswiki-ejercito-africa`).

### Tanks
- The Soviet T-26, armed with a 45 mm gun, outclassed the German Panzer I and the Italian CV-33 tankettes. Panzer I and CV-33 units suffered heavy losses around Madrid in late 1936. Sources: [Osprey blog, Panzer I vs T-26](https://www.ospreypublishing.com/ca/osprey-blog/2026/the-first-clash-of-steel-panzer-i-vs-t-26-in-spain-1936-39/) and [warhistory.org, Spanish Republican T-26s](https://warhistory.org/2015/08/26/spanish-republican-t-26s/).
- The T-26's 15 mm armour was thin.
- Infantry-tank cooperation was poor throughout. German instructors concluded that tanks could not operate alone (same sources).
- At Guadalajara (March 1937), Italian motorized columns and tankettes stalled in mud and rain. Republican T-26 and BT-5 tanks and local air superiority defeated the CTV, the corps' only defeat of the war: [Wikipedia: Battle of Guadalajara](https://en.wikipedia.org/wiki/Battle_of_Guadalajara), [warhistory.org, Guadalajara 1937](https://warhistory.org/2016/02/07/guadalajara-1937/).
- At the Ebro (1938), bridge bombing let only 22 Republican tanks and a handful of guns cross: [Wikipedia: Battle of the Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro).
- Conclusion: tanks existed on both sides in small numbers and were rarely decisive. The owner's "if it was relevant" applies; they are a low priority.

### Air power
- The airlift of the Army of Africa (Operation Feuerzauber, from 29 July 1936) used 20 Ju 52s with six He 51 escorts:
  - About 1,500 men crossed between 29 July and 5 August.
  - Figures for later weeks vary (Hugh Thomas: about 12,000 in August-September).
  - Sources: [Wikipedia: Spanish airlift of 1936](https://wikipedia.com/wiki/Spanish_airlift_of_1936), [Air & Space Forces Magazine, The Condor Legion](https://www.airandspaceforces.com/article/0213condor/), [afterburner.com.pl](https://afterburner.com.pl/?p=9964).
  - The scenario starts on 31 July with "the first of the Army of Africa landed at Sevilla". The Strait of Gibraltar is already a sea connection (`andalucia`-`ceuta`).
- Air support of ground battles mattered:
  - Condor Legion and Aviazione Legionaria support in the 1937 northern campaign. Guernica (26 April 1937) was chosen by von Richthofen, the Condor Legion's chief of staff, for its road and bridge on the Basque line of retreat: [University of Nevada, Reno Basque Library: Strategy of the attack](https://library.unr.edu/places/basque-library/gernika/the-bombing-of-gernika/strategy-of-the-attack).
  - The bridge survived and the Basque army retreated through the town in good order: [HistoryNet, persistent myths of Guernica](https://historynet.com/persistent-myths-guernica/).
  - Republican air superiority at Guadalajara (Polikarpov fighters).
  - Nationalist air and artillery superiority at the Ebro, including daily bombing of the pontoon bridges.
- Strategic bombing:
  - Aviazione Legionaria bombers from Mallorca raided Barcelona from 16 to 18 March 1938. Mussolini ordered the raids, believing bombing could break a population.
  - Accounts report the raids did not break morale and hardened defiance: [Wikipedia: Bombing of Barcelona](https://en.wikipedia.org/wiki/Bombing_of_Barcelona), [vscw.ca, Italian Fascists Bombard Barcelona](https://vscw.ca/en/node/101).
- Conclusions:
  - Air mattered operationally (lift, battlefield support, interdiction).
  - It did not decide the war strategically.
  - "Bombing a town reduces resource collection" has weak support. Use a small, temporary effect or none.
  - Recon, fighter and bomber as separate counters would be detail the owner does not want ("lets not muddy this too much").

### Anti-air
- The Condor Legion's 88 mm Flak 18 arrived as air defence but was soon used against tanks, bunkers and batteries, in direct fire: [warhistory.org, Antitank Warfare in the Spanish Civil War](https://warhistory.org/2021/05/15/antitank-warfare-in-the-spanish-civil-war/), [Weapons and Warfare](https://weaponsandwarfare.com/?p=23249).
- Conclusion: an AA counter would mostly be an anti-tank or artillery counter in disguise. It is better as a city defence (City agent) that blunts bombing, or folded into artillery.

### Artillery
- Nationalist artillery and air superiority decided the Ebro. Republican attacks failed for lack of guns across the river ([Wikipedia: Battle of the Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)).
- At Guadalajara, Republican heavy artillery and aircraft stopped the Italian attack (same Guadalajara sources).
- The scenario research note says militia were "short of officers, artillery, and training". Colonial veterans have lower defence because they had "little artillery of their own" (`project/scenarios/spain-1936-07-31-research.md`).
- Conclusion: artillery is the one new type with clear support in the sources, and it has a clean mechanic (a roll bonus).

### Generals
- Mola commanded the Army of the North and died on 3 June 1937 when his plane crashed near Alcocero. Davila replaced him: [Wikipedia: Emilio Mola](https://en.wikipedia.org/wiki/Emilio_Mola), [Wikipedia: War in the North](https://www.wikipedia.org/wiki/War_in_the_North), [Real Academia de la Historia: Fidel Davila Arrondo](https://dbe.rah.es/biografias/5785/fidel-davila-arrondo).
- Franco commanded in the south. The deaths of Sanjurjo, Goded and Mola left him the pre-eminent leader (Wikipedia: Emilio Mola).
- Queipo de Llano held Seville. He was not confirmed by search as commander of the "Army of the South" (from recall, unverified).
- Vicente Rojo, the Republic's chief of staff, planned Brunete, Belchite, Teruel and the Ebro: [Wikipedia: Vicente Rojo Lluch](https://en.wikipedia.org/wiki/Vicente_Rojo_Lluch).
- Miaja headed the defence of Madrid from November 1936. My search did not cover him (from recall, unverified).
- The scenario's factions already are commands. "Northern Insurgent Command" is Mola's and "Southern Insurgent Command" (purple, #665089) is Franco's Army of Africa plus Seville. The owner's "francisco is in charge of the purple" is literally the faction identity.
- Conclusion: generals add flavour and recognition. A rules effect would need per-army leader placement, which muddies the game. Recommend display-only commander chips on factions and named armies, with historical turn changes (Mola to Davila around turn 22).

## History (idea 6: movement, tempo, exhaustion)

- Yague's columns advanced about 500 km in four weeks from Seville. The move was "fully motorized": Badajoz fell on 14 August, the columns gathered at Navalmoral by 27 August, and Talavera fell on 3 September. Sources: [Wikipedia: Extremadura campaign](https://wikipedia.com/wiki/Extremadura_front), [Wikipedia: Battle of the Sierra Guadalupe](https://wikipedia.com/wiki/Battle_of_the_Sierra_Guadalupe), [vscw.ca, Battle of Talavera](https://vscw.ca/en/node/993).
  - That is roughly 250 km per two-week turn. It matches today's one move per turn between autonomous-community territories, and two or three province-sized sub-regions per turn if idea 7 lands.
- The drive then halted for about two and a half weeks at Maqueda and Toledo, from 21 September (Alcazar relief; Extremadura campaign source). That is one turn of pause after about three to four turns of advance (early August to 21 September is about 3.5 turns). It fits an "offensive exhaustion" rule of about three to four attack turns before a forced pause.
- At Guadalajara, mud stopped motorized columns. That is a weather lead for the Weather agent (idea 12), and shows the movement-points idea interacts with weather.

## Game precedents

### Combat tables and graded results
- A CRT is indexed by force ratio, and a die picks the result. Common result families are step losses, retreats, exchanges and eliminations. Step losses represent "fatigue, disorganization, loss of key leaders" as much as dead men ([Wikipedia: Combat results table](https://en.wikipedia.org/wiki/Combat_results_table), search summary).
- OCS (The Gamers, now MMP) rolls 2d6 on its CRT.
  - Results combine an attacker loss number, a defender loss number and option numbers. In "Ao1 DL1o2", "o#" means a retreat-or-step-loss choice, taken after losses, attacker first ([OCS charts v4.3 key](https://gamers-hq.de/media/pdf/00/fc/bb/OCS_Chartsv4-3.pdf) and [OCS rules summary](https://www.grognard.com/gamers/rules_summary.doc), both via search snippets).
  - Surprise uses a separate 2d6 roll and a 1d6 column shift (search snippet, [bigboardgaming OCS play example](https://bigboardgaming.com/ocs-play-example/)).
  - In v4, "Combined Arms Effects" was renamed "Anti-Tank Effects", and attacking armour is "usually x2 in Open", a strength multiplier rather than a column shift (search snippet of the OCS 4.3 rules). The actual combined-arms or anti-tank shift values were not confirmed, because the rules fetch failed.
  - The full 9.0 combat text was not read (fetch failed).
- Warburg (Vive l'Empereur series) tables grade results as R1/R2 (retreat one or two hexes), disorganized, and 1-3 step losses: [VV156 Warburg Tables](https://gamers-hq.de/media/pdf/99/cc/8c/VV156_Warburg_Tables.pdf) (search snippet).
  - This is the closest precedent to "loses 1 sub-region / loses 2 sub-regions".
- Commands & Colors: Ancients:
  - Flags force retreats whose length depends on unit type.
  - A unit with an attached leader, or with friendly support beside it, may ignore a flag.
  - A unit that cannot retreat loses a block per hex it cannot complete.
  - Sources: [C&C Ancients: Retreat](https://www.commandsandcolors.net/ancients/the-game/main/12-retreat.html), [Learn and Teach C&C Ancients](https://www.commandsandcolors.net/ancients/articles/cca-related/lat-teaching-cacancients.html).
  - This supports "retreat or lose men" as a graded choice.
- Europe Engulfed (GMT), from the fetched rulebook:
  - One die per step, hit on 6+; each "hit-bonus" adds 1 to every die.
  - Ground-support air units give a hit bonus to one ground unit in Clear or Light Mud weather only. At most three ground units per side can be supported in a round, and air can dogfight instead.
  - Armour fires separately and must target armour.
  - Out-of-supply attackers roll half their dice.
  - Source: [rulespal: Europe Engulfed](https://rulespal.com/europe-engulfed/rulebook).
  - Precedent for air as a capped, weather-gated roll bonus, not a counter that fights.
- Advanced Squad Leader: 2d6, morale checks and broken units. Not researched (from recall, unverified). Not used.

### Dice choice
- A single die gives a flat distribution, and 2d6 a bell curve ([AnyDice: three basic distributions](https://anydice.com/articles/three-basic-distributions/)).
- On a bell curve a +1 near the middle shifts more probability than at the tails. On one d10, +1 is 10 percent; on a d6, 16.7 percent (search summary of [bgdf.com](https://www.bgdf.com/blog/reducing-standard-deviation-games-involving-single-die-rolls) and the design blogs below).
- One designer argues d20 granularity is "false": players cannot feel 5 percent steps, and large modifiers overwhelm it ([Blood and Spectacles: the false granularity of the d20](https://bloodandspectacles.blogspot.com/2017/03/wargame-design-false-granularity-of-d20.html)). The same author defends the humble d6 ([In defense of the humble d6](https://bloodandspectacles.blogspot.com/2019/04/wargame-design-in-defense-of-humble-d6.html)).
- [Wargame design book, chapter 9](https://lerugray.github.io/wargame-design-book/chapter_09.html) covers the same trade.
- Takeaways for the owner's d20:
  - Its real benefit here is room for more graded results and small modifiers (artillery, air, fatigue) that do not each cost a whole odds column. Today, +1 is a column.
  - Its cost: every existing modifier is d6-sized and must be restated (x3), or works and Popular resistance become nearly worthless.
  - 2d6 would add a bell curve but only 11 rows.
  - The game resolves dice in code, so physical-dice convenience does not matter. What matters is how legible the battle report is ("rolled 14, +3 for 2:1 = 17, Defender driven out").

### Leaders
- Hannibal: Rome vs. Carthage, from the fetched rulebook:
  - Generals have a Strategy Rating, which says which cards can activate them, and a Battle Rating, which sets the battle cards drawn and the rolls for interception, avoiding battle, pursuit and withdrawal.
  - Generals are "never affected" by attrition.
  - Source: [rulespal: Hannibal](https://rulespal.com/hannibal-rome-vs-carthage/rulebook).
  - Leaders there are the activation system itself, a large commitment.
- For the People: search did not find its rules. Two analogues:
  - War for America (Compass): only the most senior leader's battle rating counts, and leader rank caps stack size ([War for America rules](https://issuu.com/consimworld/docs/wfa-rulebook-print/8)).
  - GMT's A House Divided leader articles ([InsideGMT](https://insidegmt.com/how-leaders-work-in-the-new-a-house-divided-part-1-leaders-in-battles)).
- GMT's The Spanish Civil War 1936-1939 (Javier Romero, 2010) is a chit-pull hex game at column, brigade and division scale. It uses monthly turns to November 1936, then two-month turns. It represents command with Corps HQs (Nationalist) and Army HQs (Republic), not personalities: [boardgamematcher](https://boardgamematcher.com/game/the-spanish-civil-war-1936-1939), [grognard.com review](https://www.grognard.com/reviews1/scw.txt).
  - A direct SCW precedent: command as formations, not general counters.

### Exhaustion and attrition
- Hannibal rolls attrition by force size when an army crosses a mountain pass and in the winter attrition phase, not for distance moved (rulebook 10.6, 21.1-21.2, fetched).
- Unity of Command II:
  - Units carry "suppressed" steps, temporary losses that recover only when the unit is back in supply.
  - Losing all steps to suppression kills the unit.
  - Players describe suppression as partly morale.
  - Sources: search snippets of a fan page and the [Steam discussion](https://steamcommunity.com/app/809230/discussions/0/5064850575734289962). The [UoC II manual](https://cdn.steamstatic.com/steam/apps/809230/manuals/Manual_-_Unity_of_Command_II_-_Revision_8.pdf) returned only its table of contents.
  - This is a precedent for a temporary-damage track that is separate from permanent losses. Weak sourcing.
- Combat Commander: not researched; it has no fatigue mechanic that I can cite (from recall, unverified). Not used.

## Design work

### d20 ladder (idea 9)

The score is computed as `score = clamp(d20 + modifiers, 0, 20) + 3 x column`. This is the d20 version of today's "column k = SEQ[k..k+6]".

All roll modifiers are restated in d20 units, three times today's values:
- works are +3 per turn of digging in, up to +9;
- Popular resistance is 3;
- each halving below 1:1 costs 3;
- each odds step beyond 6:1 adds 3.

In the table below, the loss figures are the share of each army's current men; the demoralization figures are the share of the side's value, picked weakest first as today.

| # | Id | Score | Attacker | Defender | Ground | Colour |
|---|---|---|---|---|---|---|
| 1 | attacker-routed | up to 2 | -35%, all demoralized, returns | none | 0 | c1 |
| 2 | attacker-broken | 3-5 | -20%, half demoralized, returns | none | 0 | c2 |
| 3 | attacker-repulsed | 6-8 | -10%, half demoralized, returns | none | 0 | c2 |
| 4 | attack-stalled | 9-10 | -10%, returns | -10% | 0 | c3 |
| 5 | both-shaken | 11-12 | -10%, half demoralized, returns | -10%, half demoralized | 0 | c3 |
| 6 | defender-gives-ground | 13-14 | -10% | -10% | 1 sub-region | c4 |
| 7 | defender-pushed-back | 15-16 | -10% | -20%, half demoralized | 2 sub-regions | c4 |
| 8 | defender-driven-out | 17-19 | -10%, occupies | -10%, half demoralized, retreats | all | c5 |
| 9 | costly-breakthrough | 20-22 | -20%, occupies | -35%, all demoralized, retreats | all | c6 |
| 10 | defender-routed | 23-26 | occupies | -35%, all demoralized, retreats | all | c7 |
| 11 | defender-destroyed | 27+ | occupies | destroyed | all | c7 |

Rough analogues to today's results:
- grade 1 to AE;
- grade 2 to AA;
- grade 3 to AD;
- grades 4-5 to BD;
- grades 6-7 are new;
- grade 8 to DD;
- grade 9 to DX;
- grades 10-11 to DE.

Calibration (no modifiers). Chance to take the territory, d6 against d20, by column:

| Column | d6 | d20 |
|---|---|---|
| 0 | 16.7 | 20 |
| 1 | 33.3 | 35 |
| 2 | 50 | 50 |
| 3 | 66.7 | 65 |
| 4 | 83.3 | 80 |
| 5 | 100 | 95 |
| 6 | 100 | 100 |

Any ground changing hands on the d20 (grades 6 and up), by column: 40, 55, 70, 85, 100, 100, 100 percent.

The two M15 sentences on the d20:
- 2:1 with no modifiers: take 50 percent, as today.
- 3:1 against works at +9 (today's +3): take 20 percent (today 16.7).

Things the d20 ladder changes:
- No outright attacker elimination. An attacker dies only by surrender with no retreat path (M21), or by falling under a strength floor (proposal: 25 percent of `fullStrength`).
- Defender destruction (DX or DE, both destroy every defending army) falls from 1/3 to 0 at 2:1, and from 100 percent (83 percent counting DE alone) to 60 percent at 6:1.
- Expected losses at 2:1 (widget): attacker 9.5 percent of men, defender 18.8 percent.

Fallback if idea 7 is rejected:
- Grades 6-7 become "attack-stalled" with their losses: no ground changes hands, and the attacker returns.
- The chance to take a territory is unchanged.

Behaviour in special battles:
- M20 head-on: grades 1-3 mean the defender wins, 4-7 mean both bounce, and 8+ mean the attacker wins.
- M19 entry: grades 6-7 act as a standoff. The standing entrant holds.
- M27 standing battles: grades 6-7 hand sub-regions to the attacker inside the territory if idea 7 exists; otherwise the defender holds.

An alternative cheaper option: a d20 with today's seven M16 results. This is a 7x21 table built from the same thresholds, with 6-7 mapped to BD. It changes data only.

### Effect on the freeze rate (mismatch e)

- Faded results keep armies alive, so more armies stay on the board, which could make freezes worse.
- Partial ground (grades 6-7) counts as progress only if idea 7 lands. With it, "any ground" beats "take" by about 20 points at columns 0 to 4, which should reduce freezes.
- The soak harness (idea 11) must measure this. I cannot claim it.

### Artillery rule (idea 8), evaluated literally

The owner's rule: artillery attack points add to the attack value, and floor(artillery attack / 3) adds +1 to the roll.

Example: one infantry regiment (4) plus one artillery group (3, proposal) attacks one infantry regiment (defence 6).
- Without artillery: 4 vs 6 is 1:2, roll -1. On the d6 that takes 0 percent; on the d20, 5 percent.
- On the d6:
  - With artillery counted as value only: 7 vs 6 is 1:1, take 33.3 percent.
  - With the literal rule: 1:1 and +1, take 50 percent.
  - On the d6, +1 is a whole odds column, so the rule counts the same guns twice: once in the odds and once as a column. Three artillery points weigh as much as doubling the side.
- On the d20:
  - Value only: 35 percent.
  - Literal rule (+1 on d20): 40 percent.
  - At d20 scale the literal rule is mild and sensible: about one-third of a column per 3 artillery points.
- If the d20 modifiers are restated x3, do not scale the artillery bonus too, or it becomes the d6 problem again.

Proposal:
- Keep the owner's rule on the d20 scale, unscaled: +1 per 3 artillery points, taken from the M12 rounded value, so depleted artillery gives less.
- Cap the bonus at +3.
- Artillery cannot attack alone. It cannot take ground without a ground unit.
- Name the bonus "Artillery support" in the battle breakdown (C14).
- On today's d6, use value only, with no roll bonus.
- Optional, symmetric: defending artillery subtracts the same.

### Air (idea 8)

- Faction-level air wings, scheduled in scenario data (foreign aid arrivals). They are not map counters.
- Each turn a faction may assign each wing to one mission:
  - Support one battle: +2 on the d20, at most two wings per battle side.
  - Intercept: cancels one enemy wing assigned to the same territory.
  - Bomb a city: the Economy or City agents decide the yield cut. Proposal: -25 percent for one turn, and a city AA defence (City agent) cancels one bombing wing.
- Weather may ground all wings (Europe Engulfed precedent: support only in Clear or Light Mud weather).
- This needs a non-move order kind. That is an Engine change (mismatch d): M1 and M22 assume submissions are lists of move orders.

### Training times (idea 8, as unit data)

Each unit type gets `trainingTurns`, with an optional `trainingTurnsByFaction` override. Proposals, with two-week turns:
- militia 1 turn for the Republic (union and party militias formed in days in July 1936, from recall, unverified) and 2 for others;
- infantry 3;
- artillery 4;
- cavalry 3;
- colonial veterans recruit only in Ceuta or Melilla, in 3 turns (from recall, unverified, that Regulares kept recruiting in Morocco).

Recruitment location (territory capitals) and cost are the Economy and City agents'.

### Exhaustion (idea 6)

- Option A, offensive exhaustion, recommended:
  - A per-army counter, like `quietTurns`, counts consecutive turns in which the army attacked.
  - At `combat.exhaustion.attackTurns` (proposal 3), the army is demoralized at the end of the turn. It recovers with one turn of no move order, as M23 already does.
  - No new order type; no new value multiplier.
  - It models Yague's halt after three to four turns of advance and gives the defender a window.
- Option D, fatigue track 0-3:
  - +1 per battle fought, attacking or defending; -1 per turn with no move order.
  - At 2 the army is "worn": x0.75 values and one sub-region of movement. At 3 it is demoralized.
  - It compounds with strength x morale. Example: 50 percent strength x 0.75 = 1.5 for a 4-attack regiment, rounded to 2. The widget shows the product.
- Movement points:
  - Today's one move per turn between autonomous communities fits about 250 km per two-week turn.
  - Movement points matter only if idea 7 makes sub-regions the movement grid. Then use a per-type allowance in sub-regions: infantry, militia and artillery 2; colonial (motorized in 1936), cavalry and tanks 3; demoralized armies 1. The Map agent supplies terrain costs.
- Action points:
  - A faction-wide activation budget, like Hannibal's cards or GMT SCW's chit pull, is a different game.
  - Recommend dropping it, in line with the owner's question mark.

## Options and tradeoffs, mapped to the engine

### Idea 9 (die and outcomes)

| Option | Engine mapping | Notes |
|---|---|---|
| A. d20 graded ladder, 11 grades, faded losses (recommended) | New ruleset id (mismatch d). `combat.die: 20`, `combat.columnStep: 3`, `combat.ladder[] {id, name, minScore, attacker {lossPercent, demoralize}, defender {...}, ground: number | "all"}`. `dieFaces` and `lastRow` in `combat.ts` come from data. The `BattleResult` union in `types.ts` becomes ladder ids. `successfulResults` derives from `ground`. M15 and M16 are rewritten; M17 losses add as percentages of start-of-battle men. M18 claims only on full-take grades. M21 retreats only on full-take grades. All modifiers are restated x3. `estimateAttack` (C15) and the computer player use the ladder distribution. | Most expressive, and feeds idea 7. Larger rewrite of M16. |
| B. d20 with today's 7 results | A 7x21 table of today's keys, from the same thresholds. Rows clamp 0..20, modifiers x3. | Cheap. Gains granularity only: no fade, nothing for idea 7. |
| C. Keep the d6, fade losses only | Change M16 effects to percentages and keep the table. | No room for partial-ground grades. |
| D. 2d6 bell curve | Rows 2..12, 11 results. | Middle-weighted, but players misjudge it. Same rewrite cost as A. |

### Idea 8 (unit types)

| Option | Engine mapping |
|---|---|
| A. Four types plus artillery (support rule), plus air as faction wings (recommended) | `unitTypes[]` gains `support {rollPerPoints, maxRoll}`, `canAttackAlone`, `trainingTurns`, and `trainingTurnsByFaction`. The map package needs new `unitSymbols` (L10). There is a new air mission order. |
| B. Full owner list as counters | Seven or more new types, AA versus air interactions, and air counters that cannot hold ground. High cost. |
| C. Values-only new types | `unitTypes` data only. No code. Little flavour. |
| D. Defer new types; add only training data | Smallest. |

Generals are display-only: `commanders[] {id, name, factionId, unitIds?, fromTurn, untilTurn, sources}`. The UI shows them in the Briefing, on the counter tooltip, and on a faction chip. No rules effect.

### Idea 6 (movement and exhaustion)

| Option | Engine mapping |
|---|---|
| A. One move per turn plus offensive exhaustion (recommended) | `UnitState.attackStreak`; `combat.exhaustion.attackTurns`; demoralize through M23. Recovery uses M22's "no move order" trigger, so no new order type is needed. The computer player must plan pauses. |
| B. A, plus movement allowance in sub-regions (only with idea 7) | M2 becomes a path of up to `unitTypes[].movement` sub-regions. Map sub-region adjacency and costs are needed. M20 head-on meeting on paths is harder. |
| C. Faction action points | A new order budget per faction. This changes the Diplomacy-like "every army may move" feel. |
| D. Fatigue track with value penalty | `UnitState.fatigue` 0-3 and a multiplier in M12. It compounds. |

## Recommended options

- Idea 9: A, the d20 graded ladder. Restate the modifiers x3 in the new ruleset's data. Fallback when idea 7 is not adopted: grades 6-7 act as stalemates.
- Idea 8: A, artillery plus air wings. Generals are display-only commander chips. Defer tanks, cavalry and AA, or add them as values-only types later.
- Idea 6: A, one move plus offensive exhaustion. Use B only if idea 7 lands. Drop action points.

## Draft questions

See `military.questions.json`: 8 for idea 8 (6 Q-UNIT, 2 Q-GEN), 7 for idea 9, 6 for idea 6, and 2 for mismatch b (`Q-MIS-b-11`, `Q-MIS-b-12`).
