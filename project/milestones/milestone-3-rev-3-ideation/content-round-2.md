<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Revision 3 · Second round</p>
<h1>Rev 3 Round 2</h1>
<p class="meta"><span>23 Nov 2026</span><span>Your 29 answers, your unit table and redrawn screens</span><span><a href="https://claude.ai/artifact/CgbQKZ5TAzYyFzVxxMcfGw">Round 1</a> stays as the record</span></p>
</header>

<p class="summary-line">Your unit table ends militia spam for the Republic and the South. Three things need a decision before it can be built: the South can't pay any of the upkeep, security forces are still the worse buy you complained about, and limiting rail departures barely limits rail, because one departure carries a whole army of any size.</p>

**What the numbers are.** Prices, incomes and starting armies come from the scenario and the engine's own code. The ten-turn figures are arithmetic with no battles in them. No simulations were run, and you said none until you've playtested.

**Where your table and your later answers differ, the table wins,** as you asked. I read the gaps in your numbering (problems 3 and 4, change 6) as items you removed.

<!-- section:units -->
## Your unit table, tested

| Your tenet | Result with your table and Moderate's buildings |
|---|---|
| Pays back in about 5 turns | Mines **pass** (5 turns after ordering). Industry **misses by one** (6) |
| Reactive units 1 to 2 turns | **Pass:** militia and security 1; infantry, veterans and cavalry 2 |
| Specialists 3 to 4 turns | Tanks, fighters and bombers take 3. Guns, anti-air and scouts take 2 and trucks 1, which is **quicker than the band** |
| Unlock chains under 10% of a game | **Fail for every unit that needs a building except security forces,** against a limit of 3 turns. See Buildings |
| Ordinary units within 15% of infantry | Militia −14% **passes**. Colonial veterans −17% and security forces −20% **miss** |
| The most flexible unit isn't the most efficient | **Pass:** militia is the flexible one (one turn, no building, trains in contested ground) and sits below infantry |
| Specialists judged by their job | **Pass for guns and tanks,** below |
| Decision turn | **Can't be measured** without sims, so it waits for your playtest |
| Tune existing effects | Mostly. Rail, disbanding and tank transport need small code changes |

Change any number below. The index, the bands and each side's turn-10 army update as you type, and **Copy as CSV** gives you the table to paste back.

<!-- widget:unit-bench -->

**What I'd look at first**

- **Security forces are still the worse buy.** Infantry costs the same, attacks twice as hard (4 against 2) and eats a third as much (0.25 against 0.75). Security wins only on one turn of training, and militia has that too, for 3 Funds. At 4 Funds, the price you picked in 6e, its index is −2% before upkeep.
- **Colonial veterans** are 2 points outside your band, with no ability to make up for it. At 1 Manpower they come inside (−12%).
- **Infantry becomes the default.** The strongest mix of the two by turn 10 is 35 infantry and 3 militia for the Republic, and all infantry for the South.
- **The North still prefers militia:** 23 columns and 1 regiment, 94 attack and 192 defence, against 96 and 149 with infantry alone. It attacks no better than regulars, so it's a wall rather than a way to win, but it's a strong wall. The cause is 27 Manpower a turn against 5 Funds.
- **Guns and tanks earn their place.** I estimate that +1 on the die is worth a third of the defender's strength in extra attack. So a gun beats another regiment on attack when the defender counts 9 or more, and a tank when it counts 4 or more. Only the first three guns and two tanks count.
- **A worn gun loses its bonus below 75% strength,** because its attack of 2 rounds down to 1. Today that happens below 83%.

| Where your answers differed | Your later answer | Your table | Used here |
|---|---|---|---|
| Militia defence | 4 | 5 | **5** |
| Security forces | 4 Funds, 1 turn, 1,000 men | 5 Funds, 1 turn, 2/6 | **5 Funds, 2/6**, and 1,000 men because the table doesn't say |
| Upkeep | no option chosen | a number for each unit | **your numbers** |
| Guns, trucks, tanks, fighters, bombers | Moderate: 7, 4, 10, 8, 10 Funds | 6, 3, 8, 6, 7 Funds | **your table** |

<div class="questions" data-idea="units"></div>

<!-- section:upkeep -->
## Upkeep on turn 1

| Side | Opening army | Upkeep a turn | Income | Starting Manpower |
|---|---|---|---|---|
| Republic | 9 infantry, 3 security, 5 militia, 3 aircraft | **12.2** | 27 | 10 |
| North | 10 infantry, 1 security, 1 militia, 1 aircraft | **4.8** | 27 | 10 |
| South | 4 infantry, 5 veterans, 1 aircraft | **2.3** | **0** | 5 |

The Republic's five militia columns are 7.5 of its 12.2. **The South is short on turn 3 even if it buys nothing,** and on turn 1 if it spends its Funds on three regiments. It earns no Manpower until it clears Andalucía (15 a turn) or the Balearics (1).

<!-- widget:upkeep-runway -->

<div class="questions" data-idea="upkeep"></div>

<!-- section:shortage -->
## When Manpower runs out

You chose both the shrinking armies and disbanding. I read that as:

1. **Warning.** If income less upkeep would take next turn's Manpower below zero, the player sees it before ending the turn.
2. **Block.** While that's true, the side can't recruit or Replenish.
3. **Disband.** The player may disband units to bring the bill down.
4. **Hunger.** If it's still short at the end of the turn, the missing Manpower leaves as men, at most 10% of a unit a turn and never below half.

Units in training don't eat until they arrive. Generals don't eat. The computer player needs its own disband rule: it would let go of the unit with the least fighting value for its upkeep, until it's no longer short.

**One thing to fix first.** If a unit costs the same to feed at any strength, hunger never ends: men leave, the bill stays the same, and only disbanding helps. If a half-strength unit pays half, hunger settles by itself.

<figure class="mockup"><img src="{{IMG}}r3b-6-upkeep-ui.webp" alt="The Manpower ledger with an Upkeep row split by unit type" loading="lazy"><figcaption>The Manpower ledger on turn 3, at your rates. The chip shows income less upkeep.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3b-6-upkeep-disband.webp" alt="A shortage warning and a Disband button on unit cards" loading="lazy"><figcaption>The warning and Disband. Stock and income are lowered here to show a shortage; in this game the Republic was never near one on turns 2 to 6.</figcaption></figure>

Stocks are whole numbers in the game today, so a bill of 12.15 needs a rule. I'd keep your fractions and carry the remainder to the next turn, which Replenish already does.


<div class="questions" data-idea="shortage"></div>

<!-- section:buildings -->
## Buildings

You picked Moderate's prices and times, and Manpower as part of the price of fortifications, roads and rail. Set the game length to see your 15% and 10% limits move.

<!-- widget:build-bench -->

- **Game length decides everything here.** Your write-up says 5 turns of a 30-turn game. Your own games end before turn 10, and past sims (an older build) ended at a median of 12 to 15. At 15 turns your limit is 2 turns, which would mean mines at 2 Funds.
- **The 3-turn chain limit** can't be met by anything that needs a Factory. **Fast chains** (the button above) is the quickest I'd go: Barracks and Depot 1 turn, Factory 2, and guns need a Barracks and a Depot instead of a Factory. The first gun comes on turn 4, down from 9 today.
- **Guns without a Factory also fixes a gap:** on turn 1 the North and the South can't train a single gun, tank, truck, anti-air battery or aircraft. With Barracks and Depot, the North can train guns in three places. The South can too once it clears Andalucía.
- **Popular Resistance** goes, as you chose: barricades are worth 2 for everyone in a city, Madrid and Barcelona start fortified, and a fortification is worth 2 on the die instead of 1.

<figure class="mockup"><img src="{{IMG}}r3b-7-build-row.webp" alt="A Build row for Mines saying it pays for itself by turn 6" loading="lazy"><figcaption>Build rows that pay Funds say when they pay for themselves.</figcaption></figure>

<div class="questions" data-idea="buildings"></div>

<!-- section:moves -->
## Rail, tanks and raids

**Rail.** One departure is one army: every unit going from the same place by the same route, however many. Ten regiments leaving Madrid for Valencia use one of Madrid's three departures. Cutting departures therefore hits small moves and leaves the large ones alone.

| | Today | One departure a station, +1 for a yard | Two units a station level, +2 for a yard |
|---|---|---|---|
| Madrid, Valencia, Zaragoza and four others | 3 armies of any size | 2 armies of any size | **6 units** |
| Three main-line stations without a yard | 2 armies | 1 army | **4 units** |
| Five single-line stations | 1 army | 1 army | **2 units** |
| All of Spain | 32 armies a turn | 22 armies a turn | **64 units a turn** |

Either way it's a small code change with one new scenario number.

**Tanks carry infantry.** The effect you wrote does what you want. It also means a tank on its own moves 2 and no longer needs a truck. Three pieces of code assume that anything that carries is a truck, so they change with it: the truck wording on the route list, the computer player keeping transport back with an army, and its count of how many trucks it wants.

**Raid table,** as you wrote it:

| Result | Today | Yours | Yours against an anti-air battery |
|---|---|---|---|
| Raiders lost | 15% | 15% | 30% |
| Nothing hit | 35% | **20%** | 20% |
| Income cut | 30% | **35%** | 35% |
| Building hit | 20% | **30%** | 15% |

<div class="questions" data-idea="moves"></div>

<!-- section:recruit -->
## Recruit

<figure class="mockup"><img src="{{IMG}}r3b-4-recruit-foldout.webp" alt="Recruit at two widths with a Special effects fold-out" loading="lazy"><figcaption>Your costs, training, values and upkeep, with a fold-out for each unit that has special effects. Nothing overflows at 416 or 320 px. The men shown are today's.</figcaption></figure>

<!-- section:markers -->
## Aircraft cards

<figure class="mockup"><img src="{{IMG}}r3b-2-air-cards.webp" alt="Aircraft drawn on the ground unit card at three zoom levels, with and without a role word" loading="lazy"><figcaption>Left: as you asked. Right: the same card with the role kept.</figcaption></figure>

The card now matches every other unit at all three zooms. Every aircraft prints 0-1, so from far away they look like an anti-air battery. Two bugs get fixed on the way: fighters are tagged BOMB today, and the app raises every printed value to at least 1, so aircraft would have shown 1-1.

<div class="questions" data-idea="markers"></div>

<!-- section:battle -->
## Battle report

<figure class="mockup"><img src="{{IMG}}r3b-5-battle-ledger.webp" alt="The die, a ledger of effects, a total, the outcome and the result bands for three recorded battles" loading="lazy"><figcaption>Your layout on three recorded battles. They use today's rules, so Popular Resistance still shows and barricades are worth 1.</figcaption></figure>

Only the score line changes; the odds line and the result bands stay as they are. The signs belong to the die, so a plus helps the attacker and a defender sees their own bonuses in red.

<figure class="mockup"><img src="{{IMG}}r3b-5-who-fought.webp" alt="An optional Who fought fold-out listing units, men and morale" loading="lazy"><figcaption>Men and morale for each unit, as a closed fold-out under the bands. The engine doesn't record these today, so this needs a small engine change.</figcaption></figure>

<div class="questions" data-idea="battle"></div>

<!-- section:invade -->
## Invade

<figure class="mockup"><img src="{{IMG}}r3b-8-invade.webp" alt="The Invade pane with effects on the roll, unit cards and the ticked units glowing on the map" loading="lazy"><figcaption>Everything scrolls, the odds card lists every known effect, the pane has its sizing grip, and ticked units glow on the map. The aircraft on the map still have their old markers here.</figcaption></figure>

<figure class="mockup"><img src="{{IMG}}r3b-8-order-button.webp" alt="Three placements for the order button" loading="lazy"><figcaption>The order button in three places. Defenders use the same card, without the checkbox and travel chip.</figcaption></figure>

<figure class="mockup"><img src="{{IMG}}r3b-8-invade-phone.webp" alt="The Invade pane on a phone" loading="lazy"><figcaption>On a phone the sheet opens at 86%, which hides most of the map.</figcaption></figure>

| Your unit cards fully visible, of 12 | At the top | After one scroll |
|---|---|---|
| Today, 10 units ticked | 0 | 0 |
| Desktop, button in the header | 2 | 6 |
| Desktop, button after the units | 2 | 6 |
| Desktop, button in the odds card | 2 | 6 |
| Phone at 86% | 0 | 5 |

- **Scrolling everything costs the first screen:** the odds card is about 300 px, so a phone shows no whole card until you scroll. The defenders come last, so you reach them at the end.
- **Known before the fight:** barricades, dug-in levels, fortifications, generals and their traits, artillery and tanks, fatigue, weather, your Ground Support and the odds steps.
- **Not known:** the die, anyone's moves, and whether their aircraft fly. The pane says so.

<div class="questions" data-idea="invade"></div>

<!-- section:casualties -->
## Casualties

<figure class="mockup"><img src="{{IMG}}r3b-9-casualties.webp" alt="A skull and crossbones chip beside the faction name with a split by side" loading="lazy"><figcaption>36,993 men is the battle total in a recorded game to turn 7. Surrenders, disbanded units and cold aren't recorded yet, so they will add to it.</figcaption></figure>

The turn line takes three lines beside the chip at 1440 px. It wraps today too, so the header fix from round 1 covers both.

<div class="questions" data-idea="casualties"></div>


<!-- section:endturn -->
## End-turn sound

You didn't like the first two. I can't use Empire: Total War's own sound, so these three are built from the snare roll you kept and the earlier free sounds, with a military lead-in. I measured their levels but can't hear them, so judge by ear.

| Sound | Made from | Licence |
|---|---|---|
| Snare roll into two drum strikes, 2.6 s <br><audio controls preload="none" src="audio-candidates/end-c.mp3"></audio> | Military Snaredrum by aUREa; drums made for this game. Changed: trimmed, mixed, levelled | CC0 |
| Snare roll into the orchestral hit, 2.7 s <br><audio controls preload="none" src="audio-candidates/end-d.mp3"></audio> | Military Snaredrum by aUREa; Cinematic Hit With Horns by DeVern. Changed: trimmed, mixed, levelled | CC0 |
| Drum strikes with distant cannon, 2.3 s <br><audio controls preload="none" src="audio-candidates/end-e.mp3"></audio> | Drums made for this game; [Cannon artillery - distant gunshots](https://freesound.org/people/Aegersum/sounds/345844/) by Aegersum. Changed: trimmed, filtered, mixed, levelled | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

<div class="questions" data-idea="endturn"></div>

<!-- section:settled -->
## Settled by your answers

| Area | What Rev 3 will do |
|---|---|
| Computer player | Attacks a side one step from winning as readily as it guards, accepts worse odds, counts a foothold as a full success. At 2 steps it stops saving and prefers one-turn units |
| Music | Four files, Opus 64 and AAC 96, starting with the first campaign at a modest level |
| Sound effects | The eight you ticked, plus a refused tick and distant guns. One sound an action, special sounds at most every four seconds |
| Bandwidth | The detailed map loads on zoom or when idle. Sizes are reported, not enforced |
| Battle odds | Artillery gives +1 for every 2 attack points, up to +3 |
| Casualties | All men lost: battles, surrenders, disbanded units and cold. Skull and crossbones, beside the faction name |
| Pruning | The old d6 rules go completely. Pruning runs both before and after the features |
| Left from Rev 2 | Paved airfields keep their weather exception. Trucks use any road except a pass |
| Right pane | A grip on the left edge and sheet heights on phones, as in round 1 |
| Sims | None until you've playtested |
