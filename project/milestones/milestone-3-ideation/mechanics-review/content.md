<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Step 2 of 4 · Mechanics review</p>
<h1>Milestone 3 Mechanics Review</h1>
<p class="meta"><span>19 Nov 2026</span><span>Source: your 110 answers and notes (branch <code>m3-ideation</code>, <code>answers/owner-answers.md</code>)</span><span>Against: <code>m2-strength</code> rules M1–M27</span></p>
</header>

<p class="summary-line">Your answers describe a coherent game: armies fight and move at territory scale, and sub-territories hold the economy, terrain, rail and ports. Most of the remaining problems are places where two answers, or an answer and its note, pull against each other. A few come from rules we kept from Milestone 2.</p>

This page has four parts:

1. **What I understood.** The model in one place, with the words fixed. Check it before anything else, because everything below builds on it.
2. **Contradictions.** Each one says what clashes and proposes a fix, then asks you to pick.
3. **Gaps.** Things none of the 110 questions covered that the build will need.
4. **The turn sequence, parked UI notes and deferrals,** for reference.

Where a note disagreed with the option you ticked, I treated the note as your answer. Those cases are listed in the first section, so you can tell me if I misread one. No widgets or mockups appear here; those come in the UI pass.

<!-- section:model -->
## What I understood

### The words

| Word | Meaning from now on |
|---|---|
| **Territory** | One of today's 18 regions. Armies move between territories and fight for a whole territory. Control, victory and recruitment are judged per territory. |
| **Sub-territory** | A 1936 province, or a scenario override such as Baleares' three islands (about 55 in all). It holds development, a build queue, terrain, rail and a port. It changes hands after battles, but armies never stand in one or fight for one. |
| **Capital sub-territory** | The sub-territory holding the territory's capital. Recruiting happens there, it has the most build options, and defenders keep it longest. |
| **Army** | A group of units that comes from one territory and takes one order. Today's 35 starting formations become armies of one unit each. |
| **Unit** | One piece of an army, such as infantry, militia, artillery, truck, cavalry, tank or anti-air. Its type gives the army values and bonuses. |
| **Contested territory** | A territory where more than one faction holds sub-territories (see Q-MR-21). |
| **Funds, Manpower** | The only two resources in Milestone 3. Sub-territory development produces both. Food is folded into Manpower: farms raise Manpower, and losing farmland lowers it. That answers your Q-ECON-1 question. |

### The model

- **Battles are territory-wide.** A battle's grade decides losses, morale and how much ground changes hands. Ground means a number of sub-territories, or the whole territory.
- **Contested ground is chaos.** Armies in a contested territory attack or withdraw. They cannot entrench, rest or recover morale. They withdraw only to an adjacent territory, through sub-territories their own faction holds.
- **Income only comes from a whole territory.** A faction earns from a territory only while it holds every sub-territory there. It recruits only in an uncontested territory, and only in the capital sub-territory.
- **Buildings, not tags, decide what a territory can train.** For example, a Barracks trains infantry, a Barracks with a Factory trains artillery, and a Factory with a Depot trains trucks. Every unit type is visible; a greyed-out type says on hover what is missing.
- **Every sub-territory has its own build queue.** You pay when you queue an order. Losing the sub-territory forfeits the money on the order in progress, and the new owner inherits it. Orders queued behind it are refunded.
- **Movement:**
  - an army always moves at least one territory;
  - trucks add one;
  - mountains or swamp take one away;
  - rail is a sub-territory movement bonus.
- **Air power:**
  - recon, fighter and bomber aircraft appear as counters;
  - an air raid on a sub-territory rolls one of four outcomes;
  - anti-air is a unit.
- **Generals** give armies a small boost and have a part in morale. They are never scripted; a bad general nudges you to sack him, and generals can die.
- **Combat uses a d20** on an explicit 7 × 21 table. Each odds column has its own spread of outcomes, and only the relevant column is shown after a battle.
- **Turns are half-months** (Early or Late Month, 24 a year), and turn 1 gets double time.
- **Weather** is seasonal and consistent across the map. It shows in the territory pane and next to move targets, never as effects drawn on the map.

### Notes I treated as overriding the tick

| Question | You ticked | Your note says | I used |
|---|---|---|---|
| Q-PART-2 | Hybrid: orders on territories, sub-regions for control and income | Withdrawals path through sub-territories; battles stay territory-wide | Hybrid, plus sub-territory paths for withdraw, retreat and rail |
| Q-RECR-2 | Recruitment tags in scenario data | Tags are not needed; buildings gate the unit types | Buildings gate it; no tags |
| Q-D20-1 / D20-3 | 11-grade ladder / explicit 7 × 21 table | Each odds column has its own outcome set | An explicit table over a catalogue of grades (Q-MR-06) |
| Q-HARN-1 | Command-line tool writing JSON, CSV and HTML | JSON only, for robots | JSON only |
| Q-DATA-2 | `src/main/scenarios/spain-1936-07-31/` | `src/scenarios/spanish-civil-war-1936/` with a manifest and a schema | Your folder (Q-MR-34) |
| Q-RAIL-1 | Per-line levels and capacity | Rail is a sub-territory capability; adjacent rail joins up automatically | Sub-territory rail (Q-MR-18) |
| Q-MOVE-1 | Keep one move per turn | Trucks +1, terrain −1, rail legs | A movement allowance (Q-MR-15) |
| Q-UNIT-4 | Yield cut, no defence | A raid roll with "air eliminated" as one outcome | The raid roll, with anti-air and fighters affecting it |
| Q-ECON-5 | (note only) | Turn order: combat, then training and building progress, then income | Whole-territory income; cities in contested ground pay nothing |

### Already settled by your notes (no question)

- **Supply is gone.** Q-CITY-5's siege rule leaned on supply, so it needs a replacement (Q-MR-09).
- **No CI in Milestone 3.** The platform phase of Q-SEQ-1 loses its CI gate. "A gate reads the budgets" (Q-PROC-6) now means a local check script.
- **Foreign aid waits for Milestone 4,** so Q-ECON-8 (aid size) is void. The balance gap it addressed is still real (Q-MR-10).
- **Q-PART-8 is moot.** An army entering a contested territory joins the territory battle.
- **Pausing** stops the timer in local play only, and the chips show each player's readiness. Local computer players are always ready.
- **`milestone3.md` is out of date.** It says balances are public, recruitment needs supply, and builds take one turn. I will rewrite it from this review before execution.

<!-- section:contested -->
## Contradictions: contested ground, morale and fatigue

These answers interact the most, and combined literally they trap armies.

**The trap.** Take an army in contested Asturias:

- it must attack every turn (PART-2 rule 1);
- after three attack turns it is demoralized by fatigue (MOVE-2, MOVE-4);
- a demoralized army cannot attack (M23);
- it cannot rest or recover in contested ground (PART-2);
- only a general can restore morale (GEN-1 note).

It ends up stuck, unable to attack or recover, until it withdraws. That fits "contested ground is chaos", but long sieges such as Oviedo, the Madrid front and the Alcázar become impossible unless both sides rotate armies out. The questions below make it coherent without dropping your intent.

<div class="questions" data-idea="contested"></div>

<!-- section:combat -->
## Contradictions: combat numbers

<div class="recommend">

**Proposed grade catalogue (illustrative).** The explicit 7 × 21 table (Q-D20-3) holds a grade id in each cell, and a catalogue defines what each grade does. Each odds column uses only the grades that fit it: 1:1 can roll Attacker destroyed, while 4:1 cannot (your note). The losses and ground below are starting values for the harness to tune.

</div>

<div class="table-wrap">

| # | Grade | Attacker men lost | Defender men lost | Demoralized | Ground |
|---|---|---|---|---|---|
| 1 | Attacker destroyed | all | – | – | none |
| 2 | Attacker routed | 35% | 0 | attacker all | none |
| 3 | Attacker repulsed | 20% | 0 | attacker half | none |
| 4 | Attack checked | 10% | 0 | none | none |
| 5 | Bloody stalemate | 20% | 20% | both half | none |
| 6 | Stalemate | 10% | 10% | none | none |
| 7 | Defender gives ground | 10% | 10% | none | 1 sub-territory |
| 8 | Defender pushed back | 10% | 20% | defender half | 2 sub-territories |
| 9 | Costly victory | 35% | 35% | none | whole territory |
| 10 | Defender driven out | 10% | 20% | defender half | whole territory |
| 11 | Defender routed | 10% | 35% | defender all | whole territory |
| 12 | Defender broken | 0 | 35% | defender all; its weakest army is destroyed | whole territory |
| 13 | Defender destroyed | 10% | all | – | whole territory |

</div>

Following your Q-PART-3 note, sub-territories flip from the outside in: first the ones nearest the attack's origin, the capital last. On a whole-territory grade, defenders retreat (M21). On a 1- or 2-sub-territory grade, they fall back inside the territory (Q-PART-6). Where a territory has only one sub-territory (Ceuta, Melilla), grades 7–8 act as a stalemate (Q-D20-7). This replaces the shape in Q-TEN-1 ("four best grades take all"): here five grades take the whole territory.

<div class="questions" data-idea="combat"></div>

<!-- section:economy -->
## Contradictions: income and balance

**What whole-territory income does on turn 1.** I took each territory's starting control from today's `scenario.json` and assumed every split territory starts partitioned (Q-PART-7). I also applied the historical holders of each province (Q-PART-9), so Álava makes País Vasco contested. Six territories start contested: Asturias, País Vasco, Aragon, Extremadura, Baleares and Andalucia.

| Faction | Territories it holds whole on turn 1 | Cities in them |
|---|---|---|
| Republic | Cantabria, Madrid, Castilla-La Mancha, Catalunya, Valencia, Murcia (6) | 8 |
| Northern command | Galicia, Navarra, La Rioja, Castilla y León (4) | 5 |
| Southern command | Ceuta, Melilla (2) | 0 |

All four Southern cities (Sevilla, Córdoba, Granada, Cádiz) are in contested Andalucia. Q-PART-7 starts Andalucia with 3 Republican provinces: Málaga, Jaén and Almería. Málaga fell in February 1937, but Jaén and Almería stayed Republican until the end of the war in March 1939. So, if the war goes as it did, **the Southern command never earns from Andalucia at all**. It can recruit only in Ceuta and Melilla. A starting stock cannot cover two and a half years of no income from its home region.

The cause is the map, not the rule. Whole-territory income works where fronts move, but the Andalusian front barely moved for the whole war, and Aragon's held from 1936 until March 1938. Q-MR-10 asks how to fix it.

<div class="questions" data-idea="economy"></div>

<!-- section:movement -->
## Contradictions: movement, rail and ports

Today every move is one connection, and all of M11 and M17–M21 assume that. Trucks, rail and "move one then rail" create moves that cross several territories. In simultaneous resolution, that raises three questions: what happens when you pass through a territory that the enemy enters that same turn, where you meet an enemy moving the other way, and where you retreat to. These questions settle it.

<div class="questions" data-idea="movement"></div>

<!-- section:units -->
## Contradictions: armies, units, buildings and air

Under the new definition, an army is a group of units. Today the engine has no such grouping: each formation is one army with one type. So recruitment, replenishment, artillery counting and trucks all need an answer to "per unit or per army?"

<div class="table-wrap">

| Unit | Proposed effect (one line each, Q-UNIT-6 allows several) | Needs |
|---|---|---|
| Militia | Cheap; trains in 1 turn with no building; the only unit that completes training in a contested territory | – |
| Infantry, security forces, colonial veterans | Today's values; 2 turns | Barracks |
| Artillery | +1 d20 per 3 artillery attack points on the attacking side, at most +3; cannot attack alone; 3 turns | Barracks + Factory |
| Cavalry | +1 movement like a truck, also in mountains; 2 turns | Barracks |
| Tanks | +1 d20 per 3 tank points, at most +2, on attack; none in Mud or Snow; 4 turns | Factory + Depot |
| Truck | +1 movement for its army (Q-MR-15, Q-MR-20); no combat value | Factory + Depot |
| Anti-air | Worsens enemy raid rolls in its territory by 3; no attack | Factory |
| Fighter | Escorts or intercepts raids within range; grounded by weather | Airfield |
| Bomber | Raids a sub-territory (four-outcome roll), or supports a battle with +2 d20 | Airfield |
| Recon | Reveals one enemy territory's balances, build queues and units in training this turn (balances are hidden under Q-ECON-7) | Airfield |

</div>

<div class="questions" data-idea="units"></div>

<!-- section:weather -->
## Contradictions: weather and calendar

<div class="questions" data-idea="weather"></div>

<!-- section:harness -->
## Contradictions: harness, data and scope

<div class="questions" data-idea="harness"></div>

<!-- section:sequence -->
## Proposed turn sequence

This merges M26 with your order (combat, then training and building progress, then income) and with the new systems. Each step uses the state the previous step leaves.

<div class="table-wrap">

| Step | What happens | Rules |
|---|---|---|
| Before planning | The turn's weather is rolled and shown, with next turn's odds as a forecast; the timer starts (turn 1 gets double time) | weather, timer |
| 1 | Orders are revealed. Spending is checked against start-of-turn balances and paid. | M1, M9, purchases |
| 2 | Air missions: recon reveals, fighters intercept, raids roll. Bombers on battle support wait for their battle. | air |
| 3 | Transit legs (rail and truck moves through friendly ground) and reinforcements arrive | M11, Q-MR-16 |
| 4 | Head-on meeting battles, on the final leg only | M20 |
| 5 | Battles in defended and empty territories; grades apply losses, morale and ground | M17–M19, grades |
| 6 | Occupation, returns, retreats, surrenders and withdrawals, along sub-territory paths | M18, M21 |
| 7 | Standing battles in contested territories, and their retreats | M27 |
| 8 | Control, including the one-sub-territory-a-turn sweep where no enemy army stands | M6, M7, P7 |
| 9 | Morale recovery, fatigue, digging in, general deaths | M22, M23, fatigue |
| 10 | Training, replenishment and build queues advance; finished units appear and cannot move this turn | recruitment, builds |
| 11 | Income from whole territories | economy |
| 12 | Victory | M10 |

</div>

<!-- section:ui -->
## Parked for the UI pass (step 3)

These notes from your answers are about how things look, so they move to the UI pass. Your two missing notes are first.

- **Battle result icon:** hovering over it on the map names the result, for example "Attacker attrition".
- **Weather:**
  - weather has no effects drawn on the map;
  - clicking a territory shows its weather in the detail pane on the right;
  - when you give move orders, each reachable territory shows its weather next to the attack odds.
- **The territory pane:**
  - it lists the sub-territories with their development and build queues;
  - zooming in and clicking one sub-territory opens the same pane focused on it;
  - three things can now be ordered (armies, sub-territory builds, territory recruitment), so this layout needs options.
- **Recruitment:** every unit type is listed, and greyed-out types say on hover which buildings or resources are missing.
- **Rail on the map:** thinner lines drawn as Bezier curves, clearly tied to their sub-territories, with adjacent rail sub-territories joining automatically.
- **Status chips:**
  - the row of chips shows each player's readiness;
  - a countdown chip appears when there is a timer;
  - warnings come at 1 minute and at 10 seconds.
- **Dates** read "Early" or "Late" plus the month, for example "Late July 1936".
- **Battle results** show only the table column for that battle's odds.

<!-- section:deferred -->
## Deferred and dropped

| Item | Where it went |
|---|---|
| Political capital, foreign aid (as a "focus") | Milestone 4 |
| CI/CD (GitHub Actions), CLAUDE.md and hooks, hosting | Milestone 5 |
| Supply as a rule | Dropped; control only |
| Diplomacy-style support orders | Dropped for good |
| Action points | Dropped |
| Rail gauge | Not now. It may matter for a WW1 or WW2 invasion scenario in the long run. |

