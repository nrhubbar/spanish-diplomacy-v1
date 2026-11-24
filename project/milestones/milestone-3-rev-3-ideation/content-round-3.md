<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Revision 3 · Third round</p>
<h1>Rev 3 Round 3</h1>
<p class="meta"><span>23 Nov 2026</span><span>Economy and sound</span><span><a href="https://claude.ai/artifact/HktbNEZfn4FDYcrstuV4jf">Round 2</a> and <a href="https://claude.ai/artifact/CgbQKZ5TAzYyFzVxxMcfGw">round 1</a> stay as the record</span></p>
</header>

<p class="summary-line">The North chose militia because it couldn't afford anything else: 27 Manpower a turn and 5 Funds. Your merged Factory fixes most of that, and half a Fund of pay for each militia column fixes the rest. Mixed armies already win on attack with your numbers. They don't on defence, and the computer player doesn't know they win.</p>

**What the numbers are.** Prices, incomes and starting armies come from the scenario, and battle chances from the game's own result table. Growth figures are arithmetic with no battles. No simulations were run.

<!-- section:militia -->
## Why the North bought militia

You asked whether it's because it can't afford anything better. **Yes.** Its 5 Funds buy one regiment a turn, or most of two militia columns, and its 27 Manpower feeds up to 18 columns. Manpower upkeep never bites, because nothing else it can afford uses Manpower. It also banks what it doesn't spend, about 200 by turn 10, and can feed a large army from the bank for several turns. So raising Manpower upkeep mostly punishes the Republic, which starts with five columns.

**The merged Factory** gives the North something to buy with Manpower. Pay in **Funds** makes militia cost what the North is short of.

| North, turn 10, with merged Factories | Strongest army it can keep | Militia only | Infantry only |
|---|---|---|---|
| Your table | 15 militia, 9 infantry: 110 / 200 | 78 / 156 | 116 / 179 |
| **Plus 0.5 Funds a turn for each militia** | **17 infantry: 112 / 173** | 78 / 156 | 112 / 173 |
| Plus 0.25 Funds a turn | 1 militia, 17 infantry: 114 / 178 | 78 / 156 | 112 / 173 |
| Militia upkeep 3 Manpower | 5 militia, 15 infantry: 114 / 186 | 60 / 111 | 116 / 179 |
| Militia price 4 Funds | 18 infantry: 116 / 179 | 78 / 156 | 116 / 179 |

- **Half a Fund or a quarter?** Both end it for armies the North can keep. A quarter still lets it raise 28 columns for a few turns out of banked Manpower. A half doesn't.
- **What it costs the others:** the Republic's five starting columns cost it 2.5 of 14.5 Funds a turn, and the North's one costs 0.5. At 3 Manpower upkeep instead, the Republic could never keep more than 30 regiments.
- **Militia keeps a job.** It's still the only unit you can raise in one turn anywhere, even in contested ground. Raise it in an emergency and disband it when the danger passes.
- **History:** Republican militia were paid 10 pesetas a day, by a 1936 decree I've only seen quoted in search results.

<!-- widget:militia-lab -->

<div class="questions" data-idea="militia"></div>

<!-- section:arms -->
## Mixed armies

On attack, your table already rewards mixing arms. Every row spends 60 Funds or less, against a city held by 24 points of defenders.

| Army | Attack | Bonus | Takes it | Gains ground |
|---|---|---|---|---|
| 12 infantry | 48 | – | 25% | 55% |
| 5 infantry, 3 guns, 2 tanks | 36 | +5 | 35% | 65% |
| 2 infantry, 3 guns, 2 tanks, 2 aircraft that win the air | 24 | +11 | **65%** | **95%** |
| 20 militia | 40 | – | 10% | 40% |

<!-- widget:arms-lab -->

Three things stand in the way:

1. **Guns and tanks don't help you hold.** They add to the roll only when attacking. The game already has the same effect for defence, so giving guns +1 for every 3 defence points, up to +2, is only a data change.
2. **Two sides can't build the parts.** On turn 1 the North and the South can't train a gun, tank, truck, anti-air battery or aircraft. The merged Factory and shorter chains below change that.
3. **The computer player doesn't see bonuses.** It values a unit by attack plus defence over price, and buys guns only up to one for every four ground units. Rev 3 will teach it what a bonus is worth, whatever you choose here.

<div class="questions" data-idea="arms"></div>

<!-- section:factory -->
## The merged Factory

As you wrote it: 6 Funds and 4 Manpower, 2 turns, pays 1.5 Funds a turn, replaces Industry and the old Factory. It pays back 4 turns after ordering, inside your 5. This replaces your 5 Funds and 1 Manpower for Industry.

| | Today | One Factory a city | Each Industry level becomes a Factory |
|---|---|---|---|
| Republic income | 14 Funds | **14.5** | 19 |
| North income | 5 | **6** | 6 |
| South income | 1 | **1** | 1 |
| South, once Andalucía is clear | 11 | **12.5** | 12.5 |
| Factories on the map at the start | – | **17**, and 8 more cities can build one | 23 levels, and three to a city |

- **One a city** keeps today's incomes, which you like. A city has one at the start if it has Industry or a Factory today.
- **Its extra recruit slot goes.** The slots never ran out.
- **Half Funds** carry over to the next turn, like upkeep.
- **Nothing in the game will say "pays for itself".** The mockup from round 2 is dropped.

**What each unit needs.** You asked for guns and tanks from the Factory. Trucks, anti-air and aircraft needed the old Factory too, so they need a new home.

| Unit | Today | Proposed | First one, from nothing | Places on turn 1: Republic, North, South |
|---|---|---|---|---|
| Artillery | Barracks, Factory | Barracks, Factory | turn 5 (was 9) | 6, 1, 0 |
| Tanks | Factory, Depot | Factory, Depot | turn 6 (was 10) | 3, 1, 0 |
| Trucks | Factory, Depot | **Depot** | turn 2 (was 8) | 3, 3, 0 |
| Anti-air | Factory | **Depot** | turn 3 (was 6) | 3, 3, 0 |
| Scouts | Airfield, Factory | **Airfield** | turn 4 (was 10) | 3, 1, 1 |
| Fighters, bombers | Airfield, Factory | **Airfield** | turn 5 (was 10) | 3, 1, 1 |

Once Andalucía is clear, the South can train all of these in Seville, which has a Barracks, a Depot, an Airfield and, after the merge, a Factory.

<div class="questions" data-idea="factory"></div>

<!-- section:south -->
## The South's opening

You asked me to leave it, and said the Republic has under a 15% chance of throwing the South out of Andalucía. I checked with the result table. **You're right once the South's reserves land, and right before that unless the Republic bets everything.**

| The Republic attacks Andalucía with | South as it starts (24) | After Ceuta and Melilla land (48) |
|---|---|---|
| Its regiments there and in Murcia (8) | 0% | 0% |
| plus Madrid's garrison (20) | 0% | 0% |
| plus Valencia's (28) | 5% | 0% |
| The same, with a general and two aircraft that win the air | **45%** | 15% |

The South's real danger is time. It starves from turn 3, so it must clear the Republic out first:

| What the Republic does on turn 1 | South's chance to clear Andalucía each turn, with Ceuta and Melilla landed |
|---|---|
| Nothing (6 points there) | 100% |
| Sends Murcia's regiment (12) | 40% to 50% |
| Also sends Madrid's garrison by rail (35) | 10% to 20%, and Madrid is empty |

So Franco's part stays aggressive, and a human Republic can make it a fight by uncovering Madrid. **The computer's South must know this:** it has to attack on turn 1 and not spend Manpower it needs to eat. That gets a test.

<div class="questions" data-idea="south"></div>

<!-- section:endturn -->
## End-turn sound

I looked for a description of Empire: Total War's end-turn sound and found none, and I haven't used any of that game's audio. So here are eight new ones made from real recordings, each a different idea. The five you turned down were all cinematic hits, drum strikes or cannon, so most of these go elsewhere.

<!-- widget:endturn-board -->

**Where I'd start:** the bugle over drums, which is the most military, and the church bell, which is the plainest. The fife and drum corps is closest to Empire's century and wrong for 1936, and I couldn't identify its tune. The bugle call isn't a Spanish one as far as I can tell.

**Or make your own.** Tick layers, slide when they start, and play. **Copy my mix** gives you the recipe to paste back.

<!-- widget:endturn-mixer -->

- Most run close to 3 seconds. The last part is a fade, so any of them can be cut to 2.
- The field drum and the street band are CC BY 4.0 and the cannon is CC BY 3.0, so their makers go on the Credits screen. The rest are CC0.
- Freesound gives only previews without an account. Before release, someone has to sign in and download the originals of whatever you keep.

<div class="questions" data-idea="endturn"></div>


<!-- section:settled -->
## Settled by your round 2 answers

| Area | What Rev 3 will do |
|---|---|
| Security forces | 4 Funds, 1 Manpower, 1 Manpower of upkeep, 2 / 6, one turn |
| Colonial veterans | 1 Manpower |
| Upkeep | Every unit pays its full number at any strength. No free allowance. Fractions carry over |
| Shortage | Warning, no recruiting or Replenish, then men leave: at most 10% a turn, never below half. At half strength the rest of the bill goes unpaid, so the way out is to disband or take ground |
| Disband | An order like any other, at any time. Nothing comes back, and the men don't count as casualties. The computer player learns it |
| Chains | Barracks and Depot 1 turn, Factory 2 |
| Game length | Tuned for 30 turns, checked against your playtest |
| Rail | 2 units a station level, and 2 more for a rail yard |
| Aircraft cards | The role shows only when zoomed in |
| Battle report | Plus is green for everyone. Who fought is a closed fold-out |
| Invade | Order button at the bottom of the odds card. Grouped counters glow when a unit in them is ticked |
