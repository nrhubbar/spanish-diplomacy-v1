<!-- idea:6 -->
## Idea 6: Movement, action points, and exhaustion

### Summary
The owner asked for army movement points or action points, and for exhaustion to have an effect.

### Findings
- **Today's pace already fits two-week turns.**
  - Yague's motorized columns covered about 500 km from Seville in four weeks in August 1936, roughly 250 km per two-week turn ([Extremadura campaign](https://wikipedia.com/wiki/Extremadura_front), [Sierra Guadalupe](https://wikipedia.com/wiki/Battle_of_the_Sierra_Guadalupe)).
  - That is about one move between autonomous-community territories per turn, which is today's rule (M2).
  - If idea 7 made provinces the movement grid, the August 1936 pace was about one province border a turn (see idea 7, Tempo).
- **Offensives ran out of breath.**
  - After Talavera (3 September 1936) the drive halted at Maqueda and turned to Toledo (from recall; the cited [Extremadura campaign](https://wikipedia.com/wiki/Extremadura_front) page does not describe the pause, [vscw.ca](https://vscw.ca/en/node/993)). The halt is usually tied to the decision to relieve the Alcazar, a political choice, not exhaustion.
  - The advance to Talavera took about 2.3 turns (2 August to 3 September). So the 3-turn exhaustion threshold is a judgement to test, not a measured figure.
- **Mud stopped motorized columns at Guadalajara** in March 1937 ([Battle of Guadalajara](https://en.wikipedia.org/wiki/Battle_of_Guadalajara)), so movement rules will meet the weather idea (12).
- **Precedents:**
  - Hannibal applies attrition by force size when crossing mountain passes and in winter, not for distance moved ([rulespal: Hannibal](https://rulespal.com/hannibal-rome-vs-carthage/rulebook)).
  - Unity of Command II tracks temporary "suppressed" steps that recover in supply, separate from permanent losses. This is weakly sourced: a search snippet and a [Steam discussion](https://steamcommunity.com/app/809230/discussions/0/5064850575734289962).
  - Europe Engulfed halves the attack dice of out-of-supply units and limits their movement ([rulespal: Europe Engulfed](https://rulespal.com/europe-engulfed/rulebook)).
  - Action-point and activation systems (Hannibal's strategy cards, the chit pull in GMT's *The Spanish Civil War*) make command itself the scarce resource ([boardgamematcher](https://boardgamematcher.com/game/the-spanish-civil-war-1936-1939)). That is a different game from simultaneous Diplomacy-style orders.
- **Compounding risk.** Strength fraction times morale (0.5) already multiplies. A third fatigue multiplier drives values toward the minimum of 1 quickly: a regiment at 50 percent strength and 0.75 fatigue attacks at 1.5, which rounds to 2.

### Fit with today's engine
- **M1, M2:** one move along one connection stays.
- **M22, M23:** an army with no move order entrenches when healthy and rests when demoralized. Exhaustion recovery can use the same "no move order" trigger, so submissions stay lists of move orders and no new order type is needed.
- **Engine:**
  - add `attackStreak` to `UnitState`, beside `quietTurns`, in `engine/types.ts`;
  - add `combat.exhaustion.attackTurns` to `scenario.json`;
  - demoralize through M23 at end of turn (M26 step 9).
- **Computer player:** `ai/computerPlayer.ts` must plan pauses.
- **If idea 7 lands:**
  - add `unitTypes[].movement`, in sub-regions;
  - M2 becomes a path;
  - M20 head-on meetings on paths need a rule;
  - the Map agent supplies sub-region adjacency and costs.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. One move plus offensive exhaustion | An army that attacks in N consecutive turns (data, proposal 3) is demoralized at end of turn; one turn without a move order recovers (M23). | Reuses morale; no new multiplier or order. Coarse: defending never tires. | Low | One data field; fits any era. |
| B. A plus a movement allowance | Allowance per unit type in sub-regions (infantry 2, colonial, cavalry and tanks 3, demoralized 1); terrain costs from the map. | Real tempo differences. Only meaningful with idea 7; path resolution is harder. | Med-High | Data-driven per type and map. |
| C. Faction action points | Each faction gets N activations per turn. | Strong focus lever, but it ends "every army may move" and adds a resource. | High | Generic, but changes the game's identity. |
| D. Fatigue track 0-3 | +1 per battle, -1 per rest; x0.75 values at 2, demoralized at 3. | Finer, but compounds with strength and morale; more to explain. | Med | Data-driven. |

**Recommendation:** A now: offensive exhaustion through the existing morale rules, with no new order type. Add B only if idea 7 makes sub-regions the movement grid. Drop action points, in line with the owner's own question mark.

### Widget
<!-- widget:exhaustion-sim -->
One infantry regiment, 4-6 from `scenario.json`, at the 1,270-man establishment from the research note (no scenario regiment is that large), over ten two-week turns of attacking, marching, defending or holding. It shows morale, men, attack value (M12), works (M22) and moves under rule A or D. The losses per battle are illustrative.

### Mockup
<!-- mockup:movement-exhaustion -->

### Questions
<!-- questions:6 -->

<!-- idea:8 -->
## Idea 8: Unit types, special effects, training, generals

### Summary
The owner asked for new unit types (cavalry, tanks, aircraft, anti-air, artillery) with a few special effects, training times per type and faction, and perhaps generals, "without muddying".

### Findings
- **Artillery mattered most.**
  - Nationalist artillery and air superiority decided the Ebro, where bridge bombing let only 22 Republican tanks and a handful of guns cross ([Battle of the Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)).
  - Republican aircraft, the XI International Brigade and the weather stopped the Italians at Guadalajara ([Guadalajara](https://en.wikipedia.org/wiki/Battle_of_Guadalajara)).
- **Tanks mattered little.**
  - The T-26 outclassed the Panzer I and CV-33, but numbers were small, armour was thin, and infantry-tank cooperation was poor ([Osprey](https://www.ospreypublishing.com/ca/osprey-blog/2026/the-first-clash-of-steel-panzer-i-vs-t-26-in-spain-1936-39/), [warhistory.org](https://warhistory.org/2015/08/26/spanish-republican-t-26s/)).
- **Cavalry was marginal, though both sides had it.**
  - Monasterio's charge at Alfambra (5-8 February 1938) is called the last great mounted charge in Western Europe ([Alfambra](https://en.wikipedia.org/wiki/Battle_of_Alfambra)).
  - The Nationalist cavalry division was created in November 1937, about turn 34; both sides later formed cavalry divisions, and Moroccan cavalry fought for the rising from 1936 ([El Debate](https://www.eldebate.com/historia/20260226/batalla-alfambra-3000-jinetes-nacionales-vencieron-republicanos-teruel_389225.html)). The game has no turn limit, but the 30-turn soak never reaches it, which is the reason to defer.
- **Air mattered operationally, not strategically.**
  - Operationally:
    - The airlift of the Army of Africa began on 19 July with Spanish aircraft; the first German Ju 52 arrived on 29 July, and there were 20 by 10 August. About 1,500 men were flown across by 5 August, when a sea convoy carried at least as many ([Spanish airlift](https://wikipedia.com/wiki/Spanish_airlift_of_1936), [Air & Space Forces](https://www.airandspaceforces.com/article/0213condor/)).
    - Close support and interdiction were used in the north in 1937 and at the Ebro.
    - Guernica was chosen for a road and bridge on the Basque retreat route; the bridge survived ([UNR Basque Library](https://library.unr.edu/places/basque-library/gernika/the-bombing-of-gernika/strategy-of-the-attack)).
  - Strategically, the Barcelona raids of 16-18 March 1938 caused panic and an exodus and had a "demoralizing effect", but the city kept fighting for ten more months ([Bombing of Barcelona](https://en.wikipedia.org/wiki/Bombing_of_Barcelona), [vscw.ca](https://vscw.ca/en/node/101)). The case for a small effect is that it did not change the war's course, not that morale held.
  - So "bombing reduces resource collection" should be small or dropped.
- **Anti-air was dual-use.**
  - The 88 mm Flak 18 was soon used against tanks and bunkers in direct fire ([warhistory.org](https://warhistory.org/2021/05/15/antitank-warfare-in-the-spanish-civil-war/)). An AA counter would mostly be artillery in disguise.
- **Generals.**
  - Mola commanded the north until his death on 3 June 1937 (about turn 22); Davila replaced him ([Mola](https://en.wikipedia.org/wiki/Emilio_Mola), [RAH: Davila](https://dbe.rah.es/biografias/5785/fidel-davila-arrondo)).
  - Rojo planned Brunete, Teruel and the Ebro ([Rojo](https://en.wikipedia.org/wiki/Vicente_Rojo_Lluch)).
  - Miaja led the defence of Madrid, and Queipo de Llano held Seville (from recall, unverified).
  - The scenario's Northern and Southern commands already are Mola's and Franco's commands.
  - Some Spanish Civil War games model command through HQs or activation rather than personalities (from recall, unverified; the cited [grognard.com](https://www.grognard.com/reviews1/scw.txt) review does not say so).
  - In Hannibal, generals are the activation system itself ([rulespal](https://rulespal.com/hannibal-rome-vs-carthage/rulebook)), a big commitment.
- **Air as a bonus, not a unit.** Europe Engulfed treats air as a capped hit bonus to one ground unit, in good weather only ([rulespal](https://rulespal.com/europe-engulfed/rulebook)).
- **The owner's artillery rule, evaluated literally** (widget numbers). Take one infantry regiment (4) plus one artillery group (3, proposal) against an infantry regiment (6):
  - Without artillery: 0 percent on the d6, 5 percent on the d20.
  - With artillery as value only: 1:1, 33 percent on the d6, 35 percent on the d20.
  - With the literal rule: 50 percent on the d6, but 40 percent on the d20.
  - On the d6, +1 is a whole odds column, so the guns count twice. On the d20 the rule is mild and sensible.

### Fit with today's engine
- **`unitTypes[]`** gains optional fields:
  - `support { rollPerPoints: 3, maxRoll: 3 }`;
  - `canAttackAlone: false`;
  - `trainingTurns`;
  - `trainingTurns` per unit type, with faster militia set by place (a `trainingTurns` value on a territory's `recruitment` entry, Q-RECR-4), not by faction;
  - `movement`, only with idea 6 B.
- **M12 is unchanged.** The artillery points are the M12 rounded values, so depleted guns give less.
- **M14** gains a named "Artillery support" modifier, shown in breakdowns (C14).
- **The map package** needs new `unitSymbols` (L10).
- **Air** is a faction-level `airWings` schedule. Air missions are a non-move order, which breaks the "submissions are move lists" assumption of M1 and M22; that is an Engine matter (mismatch d).
- **Bombing** a city hands a yield cut to the Economy and City agents.
- **Generals** are `commanders[] {id, name, factionId, unitIds?, fromTurn, untilTurn, sources}`, display only. They appear in the Briefing, the counter tooltip, and a faction chip.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Artillery plus air wings | Today's four types plus an artillery group (3-2 proposal; roll bonus, cannot attack alone). Air as faction wings assigned each turn to support (+2 d20) or intercept; bombing waits (Q-UNIT-4). | Covers the two arms with clear historical weight; one new order kind. | Med | Support rules and wing schedules are data. |
| B. The owner's full list as counters | Cavalry, tanks, recon, fighter and bomber aircraft, AA, artillery. | Rich, but many interactions (AA against air, air that cannot hold ground); against "lets not muddy". | High | Generic, but a large schema. |
| C. Values-only new types | Add artillery, cavalry and tanks as plain attack-defence types. | No code. Little difference in play. | Low | Pure data. |
| D. Defer new types | Add only training times for today's four types. | Smallest; misses the owner's interest. | Low | Pure data. |

**Recommendation:** A. Artillery is the one new type with clear evidence, and it gets the owner's rule on the d20 scale (capped at +3). Air becomes abstract wings, because counters would muddy the game. Defer tanks, cavalry and AA, or add them later as values-only types. Generals are display-only chips that change on historical turns.

### Widget
<!-- widget:unit-effects -->
Build an attacking stack from the four real types (values from `scenario.json`) and three proposed types. Toggle no rule, the owner's literal artillery rule, or the proposal, on the d6 or the d20. It shows side values, odds (M13), the modifier breakdown (M14) and the chance to take the territory.

### Mockup
<!-- mockup:unit-counters -->
<!-- mockup:general-chip -->

### Questions
<!-- questions:8 -->

<!-- idea:9 -->
## Idea 9: A d20 and graded, faded combat outcomes

### Summary
The owner asked to switch to a d20, add more combat outcomes, fade casualties and demoralization, and feed the result grade into idea 7's territory split.

### Findings
- **Today's table is already a ladder.**
  - Column k of the shipped table is `SEQ[k..k+6]`, so it is a one-dimensional ladder shifted one step per odds column (`project/specs/scenario-package.md`).
  - On a d6, +1 to the roll is worth a whole column.
  - Every existing modifier (works +1 to +3, Popular resistance 1, the halving penalty) is sized for that scale.
- **Precedents for graded results.**
  - OCS (2d6) combines attacker and defender loss numbers with "option" numbers, each a choice between retreating and losing a step ([OCS charts key](https://gamers-hq.de/media/pdf/00/fc/bb/OCS_Chartsv4-3.pdf), [rules summary](https://www.grognard.com/gamers/rules_summary.doc); search snippets, rules text not read).
  - The Warburg tables grade results as retreat 1 or 2 hexes, disorganized, and 1-3 step losses ([VV156](https://gamers-hq.de/media/pdf/99/cc/8c/VV156_Warburg_Tables.pdf)). This is the model for "loses 1 or 2 sub-regions".
  - In Commands & Colors, retreats depend on unit type, and a blocked retreat costs blocks ([C&C Ancients](https://www.commandsandcolors.net/ancients/the-game/main/12-retreat.html)).
  - CRT step losses stand for "fatigue, disorganization" as much as dead men ([CRT](https://en.wikipedia.org/wiki/Combat_results_table)).
- **Choosing a die.**
  - Single dice are flat; 2d6 is a bell curve ([AnyDice](https://anydice.com/articles/three-basic-distributions/)).
  - A d20 offers 5 percent steps, but one designer calls that granularity "false": players cannot feel it, and big modifiers swamp it ([Blood and Spectacles](https://bloodandspectacles.blogspot.com/2017/03/wargame-design-false-granularity-of-d20.html)).
  - Here the real gain is room: for 11 graded results, and for small bonuses (artillery, air, exhaustion) that do not each cost a column.
- **Proposed ladder.**
  - Score = clamp(d20 + modifiers, 0, 20) + 3 x odds column.
  - All modifiers are restated x3: works +3 per turn up to +9, Popular resistance 3, halving penalty 3.
  - The 11 grades run from `attacker-routed` to `defender-destroyed`. Each grade states its losses (10, 20 or 35 percent of each army's men), the share of the side demoralized (none, half or all), and its ground: 0, 1 sub-region (`defender-gives-ground`), 2 (`defender-pushed-back`), or the whole territory (`defender-driven-out` and above).
- **Calibration.**
  - The chance to take a territory stays within 5 points of today at every column: 20/35/50/65/80/95/100 against 17/33/50/67/83/100/100.
  - The chance that any ground changes hands is about 20 points higher at columns 0 to 4.
  - The attacker is never destroyed outright, and destruction of the defender (DX or DE) falls from 1/3 to 0 at 2:1.

### Fit with today's engine
- **Rules:**
  - M15 and M16 are rewritten.
  - In M17, losses from several battles add as percentages of start-of-battle men.
  - M18 claims and M21 retreats happen only on full-take grades.
  - Grades 6-7 hand sub-regions to the attacker (idea 7).
  - In M20 head-on battles, grades 4-7 bounce both sides.
  - In M19 entry battles, grades 6-7 are a standoff.
  - In M27 standing battles, grades 6-7 give ground inside the territory.
  - A strength floor (25 percent of `fullStrength`) breaks up an army; surrender is unchanged.
- **`combat.ts`:**
  - `dieFaces` and `lastRow` come from data;
  - the `successfulResults` constant becomes derived from the ladder;
  - `estimateAttack` (C15) and the computer player read the ladder.
- **`types.ts`:** the `BattleResult` union becomes ladder ids.
- **Schema:**
  - `combat.die`, `combat.columnStep`;
  - `combat.ladder[] {id, name, minScore, attacker {lossPercent, demoralize}, defender {...}, ground: number | "all"}`;
  - a new ruleset id (mismatch d).
- **Fallback without idea 7:** grades 6-7 act as `attack-stalled`, with no ground changing hands.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. d20 graded ladder | 11 grades with proportional losses and demoralization shares; ground 0, 1, 2 or all sub-regions; modifiers x3. | Feeds idea 7 and fades results; M16 must be rewritten and modifiers restated. | Med-High | The ladder, effects and step are all data. |
| B. d20 with today's 7 results | A 7x21 table generated from the same thresholds; modifiers x3. | Data-only change; gains granularity but no fade and no partial ground. | Low | Same schema shape as today. |
| C. Keep the d6, fade losses only | Today's table; M16 effects become percentages. | No room for grades 6-7. | Low-Med | Data plus a rule change. |
| D. 2d6 bell curve | Rows 2-12. | Middle-weighted; harder to read odds; same rewrite as A. | Med-High | Data. |

**Recommendation:** A. It is the only option that gives idea 7 a graded "how much ground" signal while keeping today's chance to take a territory per column. If partitioning is rejected, grades 6-7 collapse to stalemates and the ladder still fades losses.

### Widget
<!-- widget:d20-explorer -->
Choose an odds column and modifiers. It shows the exact d6 outcome distribution from `scenario.json`'s `combat.table`, next to the proposed d20 ladder's distribution, colour-graded, with the chance to take ground and expected losses. It self-checks against the two M15 examples.

### Mockup
<!-- mockup:d20-battle-card -->

### Questions
<!-- questions:9 -->

<!-- mismatch:b-military -->
### Mismatch (b), continued: morale and faded casualties (Military contribution)
Faded results make armies lose men often and die rarely, so the M25 relaxation ("lost men never return") becomes central: without replacements, every army slowly bleeds out.

Proposed division:
- **Strength (men)** is the only lasting damage. It falls by the ladder's percentages and returns only through the Economy agent's restore order.
- **Morale** stays a temporary binary state (M23). Results demoralize a share of the side, weakest first as today, and one turn of rest recovers it.
- **Exhaustion** (idea 6 A) is not a third multiplier. It is a counter that demoralizes, so values stay type x strength / fullStrength x 0.5 when demoralized.
- **A strength floor** (25 percent of `fullStrength`) breaks up an army, so remnants do not linger at value 1.
- **Restore orders** may be given to a demoralized army, but they do not restore morale and the army does not rest that turn (Q-MIS-b-2), so the player chooses between rest and refit.

<!-- sources -->
- [Battle of Alfambra (Wikipedia)](https://en.wikipedia.org/wiki/Battle_of_Alfambra)
- [Batalla de Alfambra (El Debate)](https://www.eldebate.com/historia/20260226/batalla-alfambra-3000-jinetes-nacionales-vencieron-republicanos-teruel_389225.html)
- [Trincheras Serretilla-Mascaron (Comarca de Teruel)](https://turismocomarcateruel.com/atrincherate-2/trincheras-serretilla-mascaron-camanas-2/)
- [Spanish airlift of 1936 (Wikipedia)](https://wikipedia.com/wiki/Spanish_airlift_of_1936)
- [The Condor Legion (Air & Space Forces Magazine)](https://www.airandspaceforces.com/article/0213condor/)
- [Operation Magic Fire (afterburner.com.pl)](https://afterburner.com.pl/?p=9964)
- [The first clash of steel: Panzer I vs T-26 in Spain (Osprey blog)](https://www.ospreypublishing.com/ca/osprey-blog/2026/the-first-clash-of-steel-panzer-i-vs-t-26-in-spain-1936-39/)
- [Spanish Republican T-26s (warhistory.org)](https://warhistory.org/2015/08/26/spanish-republican-t-26s/)
- [Battle of Guadalajara (Wikipedia)](https://en.wikipedia.org/wiki/Battle_of_Guadalajara)
- [Guadalajara 1937 (warhistory.org)](https://warhistory.org/2016/02/07/guadalajara-1937/)
- [Battle of the Ebro (Wikipedia)](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)
- [Bombing of Barcelona (Wikipedia)](https://en.wikipedia.org/wiki/Bombing_of_Barcelona)
- [Italian Fascists Bombard Barcelona (vscw.ca)](https://vscw.ca/en/node/101)
- [Strategy of the attack, Gernika (University of Nevada, Reno Basque Library)](https://library.unr.edu/places/basque-library/gernika/the-bombing-of-gernika/strategy-of-the-attack)
- [Persistent myths of Guernica (HistoryNet)](https://historynet.com/persistent-myths-guernica/)
- [Antitank Warfare in the Spanish Civil War (warhistory.org)](https://warhistory.org/2021/05/15/antitank-warfare-in-the-spanish-civil-war/)
- [Weapons and Warfare: Flak in Spain](https://weaponsandwarfare.com/?p=23249)
- [Emilio Mola (Wikipedia)](https://en.wikipedia.org/wiki/Emilio_Mola)
- [War in the North (Wikipedia)](https://www.wikipedia.org/wiki/War_in_the_North)
- [Fidel Davila Arrondo (Real Academia de la Historia)](https://dbe.rah.es/biografias/5785/fidel-davila-arrondo)
- [Vicente Rojo Lluch (Wikipedia)](https://en.wikipedia.org/wiki/Vicente_Rojo_Lluch)
- [Extremadura campaign (Wikipedia)](https://wikipedia.com/wiki/Extremadura_front)
- [Battle of the Sierra Guadalupe (Wikipedia)](https://wikipedia.com/wiki/Battle_of_the_Sierra_Guadalupe)
- [Battle of Talavera de la Reina (vscw.ca)](https://vscw.ca/en/node/993)
- [OCS Charts v4.3 (The Gamers / MMP)](https://gamers-hq.de/media/pdf/00/fc/bb/OCS_Chartsv4-3.pdf)
- [OCS Rules Summary (grognard.com)](https://www.grognard.com/gamers/rules_summary.doc)
- [OCS play example (Big Board Gaming)](https://bigboardgaming.com/ocs-play-example/)
- [VV156 Warburg Tables](https://gamers-hq.de/media/pdf/99/cc/8c/VV156_Warburg_Tables.pdf)
- [Combat results table (Wikipedia)](https://en.wikipedia.org/wiki/Combat_results_table)
- [C&C Ancients: Retreat (commandsandcolors.net)](https://www.commandsandcolors.net/ancients/the-game/main/12-retreat.html)
- [Learn and Teach C&C Ancients (commandsandcolors.net)](https://www.commandsandcolors.net/ancients/articles/cca-related/lat-teaching-cacancients.html)
- [Europe Engulfed rulebook (rulespal)](https://rulespal.com/europe-engulfed/rulebook)
- [Hannibal: Rome vs. Carthage rulebook (rulespal)](https://rulespal.com/hannibal-rome-vs-carthage/rulebook)
- [War for America rules (issuu)](https://issuu.com/consimworld/docs/wfa-rulebook-print/8)
- [How Leaders Work in A House Divided (InsideGMT)](https://insidegmt.com/how-leaders-work-in-the-new-a-house-divided-part-1-leaders-in-battles)
- [The Spanish Civil War 1936-1939 (boardgamematcher)](https://boardgamematcher.com/game/the-spanish-civil-war-1936-1939)
- [The Spanish Civil War review (grognard.com)](https://www.grognard.com/reviews1/scw.txt)
- [Unity of Command II discussion (Steam)](https://steamcommunity.com/app/809230/discussions/0/5064850575734289962)
- [Unity of Command II manual, Revision 8 (Steam)](https://cdn.steamstatic.com/steam/apps/809230/manuals/Manual_-_Unity_of_Command_II_-_Revision_8.pdf)
- [Three basic distributions (AnyDice)](https://anydice.com/articles/three-basic-distributions/)
- [The false granularity of the d20 (Blood and Spectacles)](https://bloodandspectacles.blogspot.com/2017/03/wargame-design-false-granularity-of-d20.html)
- [In defense of the humble d6 (Blood and Spectacles)](https://bloodandspectacles.blogspot.com/2019/04/wargame-design-in-defense-of-humble-d6.html)
- [Wargame design book, chapter 9: Combat resolution](https://lerugray.github.io/wargame-design-book/chapter_09.html)
- [Reducing standard deviation in single-die games (BGDF)](https://www.bgdf.com/blog/reducing-standard-deviation-games-involving-single-die-rolls)
