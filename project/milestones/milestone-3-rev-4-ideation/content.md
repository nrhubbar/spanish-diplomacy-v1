<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Revision 4 · Playtest 3</p>
<h1>Rev 4 Questions</h1>
<p class="meta"><span>23 Nov 2026</span><span>Work has started on all 12 notes</span></p>
</header>

<p class="summary-line">Nothing here blocks the work. Each question has a default that's already being built, and each answer is a small change. The two that matter most are Manpower and the air table.</p>

**What the numbers are.** Incomes, prices and starting armies come from the scenario, and battle chances from the game's own result table. Growth figures are arithmetic with no battles. No simulations were run.

<!-- section:found -->
## What I found in the code

| Your note | Cause |
|---|---|
| 2. Recruit page jostles | This turn's orders join the training list, which sits above the unit rows, so each click pushes the rows down. |
| 4. General bonus missing | The Invade pane lists ground units only, so a general can't be ticked and his bonus can't count. |
| 4. Air Support bonus missing | The odds leave Ground Support out of the list whenever an enemy anti-air unit could contest it, and only mention it in a sentence below. |
| 3. Two versions of the logic | The map chip and the Invade pane work out odds separately. The map chip doesn't know which road each unit takes. They're becoming one function. The stuck line is being reproduced in a browser before anything is changed. |
| 7. One militia, four trucks | **No, they don't know how trucks work.** Every idle truck joins the largest army leaving, even for a one-step attack that needs none. |
| 7. Security forces | The computer counts defence as much as attack, and ignores upkeep when it compares prices. A security force costs four times an infantry regiment's upkeep. |
| 11. Air battle | The unit text says only the best aircraft counts. The game adds them all up. |

## Does artillery make sense? (note 8)

**Yes, and Ground Support more so. The computer just can't see it.** The table shows your chance of taking a city held behind barricades after each purchase. The second and third columns also face one level of digging in.

| You add | Funds | Attack 12, defence 12 | Attack 20, defence 18, dug in | Attack 24, defence 12, dug in |
|---|---|---|---|---|
| Nothing | | 10% | 0% | 15% |
| 2 infantry | 10 | 10% | 0% | 15% |
| 3 infantry | 15 | 25% | 0% | 30% |
| **2 artillery** | 12 | **20%** | **10%** | **25%** |
| 3 artillery | 18 | 25% | 15% | 30% |
| **1 bomber that wins the air** | 7 | **25%** | **15%** | **30%** |
| 2 security forces | 8 | 10% | 0% | 15% |

- **Why infantry adds nothing:** odds move in steps. More attack does nothing until it doubles the defence, and then it's worth 15 points at once. A gun or a bomber adds its points every time.
- **Guns are the reliable buy in big battles, infantry in small ones.** Artillery needs no change to its numbers.
- **What I'm changing in the computer player:** it will value each unit by what it adds to the battles it would really fight, count upkeep, and count its generals and aircraft when it decides to attack. Today it ignores both.
- **What you may need to check:** artillery needs Barracks and a Factory in the same territory, so few places can train it early.

<!-- section:manpower -->
## Manpower (note 7)

Manpower is far from short for two sides, and the South has none.

| Opening turn | Income | Upkeep | Left each turn | Funds income |
|---|---|---|---|---|
| Republic | 27 | 12.8 | **+14.3** | 14.5 |
| North | 27 | 5 | **+22** | 6 |
| South | 0 | 2.3 | **−2.3** | 1 |

Each farm level gives 1 Manpower. This is when each side runs short if it spends its Funds on infantry, with no battle losses:

| Each farm level gives | Republic, left each turn | Runs short | North, left each turn | Runs short |
|---|---|---|---|---|
| 1 (today) | +14.3 | never | +22 | never |
| 0.75 | +7.5 | turn 15 | +15.3 | never |
| **0.6** | **+3.5** | **turn 7** | **+11.2** | **never** |
| 0.5 | +0.8 | turn 4 | +8.5 | never |

- **A cut on its own squeezes only the Republic.** Losses and Replenish make it bite sooner than this table says.
- **The North is limited by Funds, not men.** With 6 Funds it buys one regiment a turn and can't use more than about 3 Manpower. So the fix for its security forces is the computer player, whichever option you choose.

<div class="questions" data-idea="manpower"></div>

<!-- section:air -->
## The air battle (note 11)

One d20 for both sides. Add your aircraft, take away the enemy's aircraft and anti-air, and read one table. High favours the attacker, low favours the defender.

| Score | Result | Attacker's Ground Support | Defender's Ground Support |
|---|---|---|---|
| 3 or less | Defender commands the air | none | all of it |
| 4 to 8 | Defender holds the edge | half | all of it |
| 9 to 12 | Contested sky | half | half |
| 13 to 17 | Attacker holds the edge | all of it | half |
| 18 or more | Attacker commands the air | all of it | none |

Halves round down. A bomber or fighter gives +3, and at most two count.

| Who is in the air | Today: wins, ties, loses | Average Ground Support today | With the table above |
|---|---|---|---|
| 2 bombers against an anti-air battery | 43 / 5 / 52% | +2.6 | **+3.5** |
| 1 bomber against an anti-air battery | 38 / 4 / 57% | +1.2 | **+1.4** |
| 2 bombers against a patrolling fighter | 48 / 5 / 48% | +2.9 | **+3.8** |
| Fighter and bomber against a patrolling fighter | 52 / 5 / 43% | +3.2 | **+4.1** |
| 2 bombers against a fighter and anti-air | 34 / 4 / 62% | +2 | **+2.9** |

Ties no longer exist, and being outmatched in the air takes your support down rather than away.

<div class="questions" data-idea="air"></div>

<!-- section:units -->
## Unit orders (notes 1, 6, 10)

Disband joins Move, Entrench, Rest and Replenish for whatever units you've ticked, with one confirm. On desktop a button sits right after the list: **Order for 3 selected units**. It opens the same menu the bar opens today.

<figure class="mockup" style="max-width:320px;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--surface-2)">
<p style="margin:0 0 6px"><strong>On a phone</strong></p>
<p style="margin:0 0 4px">☑ 1st Regiment 4-6 · Entrenching</p>
<p style="margin:0 0 4px">☑ 2nd Regiment 4-6 · Entrenching</p>
<p style="margin:0 0 10px">☐ Durruti Column 2-5 · Moving</p>
<p style="margin:0;border-top:1px solid var(--line);padding-top:10px"><span style="display:block;text-align:center;border:1px solid var(--accent);border-radius:8px;padding:12px;color:var(--accent);font-weight:600">Order for 2 selected units</span></p>
<figcaption style="font-size:.84rem;color:var(--ink-soft);margin-top:8px">The button stays at the bottom of the sheet. Tapping it raises the menu with large rows: Move, Entrench, Replenish, Disband.</figcaption>
</figure>

<div class="questions" data-idea="units"></div>

<!-- section:recruit -->
## The Recruit pane (note 2)

Adding a unit fills a slot instead of growing a list, so nothing moves.

<figure class="mockup" style="max-width:520px;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--surface-2)">
<p style="margin:0 0 8px"><strong>Recruit at Madrid</strong> · 4 orders this turn</p>
<p style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap"><span style="border:1px solid var(--accent);border-radius:8px;padding:10px 14px">Infantry ×</span><span style="border:1px solid var(--accent);border-radius:8px;padding:10px 14px">Artillery ×</span><span style="border:1px dashed var(--line);border-radius:8px;padding:10px 14px;color:var(--ink-soft)">empty</span><span style="border:1px dashed var(--line);border-radius:8px;padding:10px 14px;color:var(--ink-soft)">empty</span></p>
<p style="margin:0 0 4px"><strong>Can recruit now</strong></p>
<p style="margin:0 0 4px;display:flex;justify-content:space-between;gap:8px"><span>Infantry regiment 4-6</span><span>5 Funds, 1k, 2 turns</span><span>− 1 +</span></p>
<p style="margin:0 0 4px;display:flex;justify-content:space-between;gap:8px"><span>Militia column 2-5</span><span>3 Funds, 3k, 1 turn</span><span>− 0 +</span></p>
<p style="margin:0 0 10px;color:var(--ink-soft)">Locked here · In training (2)</p>
<p style="margin:0;border-top:1px solid var(--line);padding-top:8px;display:flex;justify-content:space-between;gap:8px"><span>This turn: 11 Funds, 2k</span><span>Left: 3.5 Funds, 8k</span></p>
</figure>

<div class="questions" data-idea="recruit"></div>

<!-- section:odds -->
## Odds and numbers (notes 3, 5, 12)

**Select all** ticks the strongest units first, uses trains while there's room and roads after that, adds your best general and the aircraft that count, and skips trucks no one needs. It never overfills a train.

<div class="questions" data-idea="odds"></div>

<!-- section:plan -->
## How Rev 4 runs

Five streams are working now: Invade, air, unit orders, the Recruit pane and the computer player. I'll merge them, review each one, run the full check and send you a build to play. `main` and production stay as they are.

<div class="questions" data-idea="plan"></div>
