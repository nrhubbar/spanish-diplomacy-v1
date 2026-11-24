# Owner answers, round 1 (2026-11-23, verbatim)

# Milestone 3 Rev 3 review answers

Answered 29 of 29 questions. Copied 2026-11-23.

## Upkeep

- **Q-R3-6a** What shape should upkeep take?
  - Answer: (no option chosen)
  - Notes: I don't know about any of these, we have a man power upkeep table in the next section.
- **Q-R3-6b** What happens when a side can't feed its armies?
  - Answer: A. No recruiting or Replenish, and the missing Manpower leaves as men, at most 10% of a unit a turn and never below half (Recommended)
  - Notes: A and C if upkeep costs are going to drive the player negative the next turn.
## Troop values

- **Q-R3-6c** Which value package should we build?
  - Answer: A. Moderate (Recommended)
  - Notes: Here is my write up about this section, please weight this answer, more than the answers to the below unit recruitment answers / # Spanish Diplomacy: economy and unit balance handoff / ## Problems found / 1. Manpower barely constrains anything (about 27 a turn of income against unit costs of 1–2), so Funds decides every choice. / 2. With no upkeep, armies are a stock, not a flow, so the leader keeps getting further ahead. / 5. Efficiency fell with training time, so waiting was punished twice. / 6. The artillery chain is long: Barracks (2) + Factory (4) run one after the other in the capital, then 3 turns of training, so 9 turns to the first gun. / ## Tenets agreed / - **Payoff:** a decision should pay for itself within about 15% of expected game length (about 5 turns in a 30-turn game; tune for the average game not the max length). / - **Lead time:** reactive units 1–2 turns; specialist units 3–4 turns (about 5%); full unlock chains under about 10% of the game. / - **Lead time vs threats:** reactive units should train within the time an enemy army takes to reach a territory from the front. / - **Equal efficiency:** baseline = infantry. Ordinary combat units sit within about ±15% of the baseline efficiency index. A unit may sit below only if an ability makes up the gap (the Axis & Allies 1940 model: land units are flat at 0.5 there, and abilities differentiate them). / - **Flexibility costs efficiency:** the most efficient unit must not also be the most flexible. / - **Specialist units** (trucks, anti-air, aircraft) are judged by the value of their job, not the index. / - **Length is an outcome:** watch the decision turn, the first turn after which the territory leader wins more than 80% of the time, not just the end turn. / - **Scope:** prefer tuning existing effect types and data over new mechanics. The user judged several new-rule proposals too disruptive. / Efficiency index: `((attack + defence) / 2) / (funds + 0.5 × manpower)`. With upkeep: add `0.5 × 10 × upkeep` to the cost. Manpower is weighted at 0.5 from the Republic's roughly 14 Funds to 27 Manpower income ratio. / ## Changes to make / 1. **Apply the unit table** below to `scenario.json` `unitTypes[].recruit.cost` and `attack`/`defence`/`trainingTurns`. / 2. **Implement upkeep** (new code): Manpower per unit per turn, per the CSV. Wire it into income/treasury and the existing ledger upkeep row. Decide what happens when it can't be paid (open question). / ``` / unit,funds,manpower,upkeep_manpower_per_turn,attack,defence,training_turns,attack_per_fund,defence_per_fund,strength_per_manpower_10_turns,strength_per_training_turn,efficiency_index,efficiency_index_with_10_turns_upkeep / Infantry regiment,5,1,0.25,4,6,2,0.80,1.20,2.86,5.00,0.91,0.74 / Militia column,3,3,1.5,2,5,1,0.67,1.67,0.39,7.00,0.78,0.29 / Colonial veterans,7,2,0.25,6,6,2,0.86,0.86,2.67,6.00,0.75,0.65 / Security forces,5,1,0.75,2,6,1,0.40,1.20,0.94,8.00,0.73,0.43 / Artillery group,6,1,0.1,2,3,2,0.33,0.50,2.50,2.50,0.38,0.36 / Cavalry regiment,4,1,0.3,3,3,2,0.75,0.75,1.50,3.00,0.67,0.50 / Tank company,8,1,0.15,5,3,3,0.62,0.38,3.20,2.67,0.47,0.43 / Truck column,3,1,0.1,0,0,1,0.00,0.00,0.00,0.00,0.00,0.00 / Anti-air battery,5,1,0.15,0,1,2,0.00,0.20,0.40,0.50,0.09,0.08 / Reconnaissance flight,5,1,0.05,0,1,2,0.00,0.20,0.67,0.50,0.09,0.09 / Fighter squadron,6,1,0.05,0,1,3,0.00,0.17,0.67,0.33,0.08,0.07 / Bomber squadron,7,1,0.05,0,1,3,0.00,0.14,0.67,0.33,0.07,0.06 / ``` / 3. **Artillery roll bonus:** change `roll-bonus-per-points` from `per: 3` to `per: 2`. Its attack is now 2, so at `per: 3` a single gun gives no bonus. / 4. **Tanks carry infantry:** add `{"@type": "transport", "@data": {"carries": 1}}` to `tank-company` effects, so a tank and one foot unit move 2 together. / 5. **Limit rail:** reduce rail departures per station level first (ahead of range or damage). This makes trucks and tanks more valuable. / 7. **Raid table** (`air.raidTable`): 1–3 air eliminated (15%), 4–7 nothing hit (20%), 8–14 income cut (35%), 15–20 building hit (30%).
- **Q-R3-6d** How should militia change?
  - Answer: A. 3 Funds (from 2), attack 2 (from 3), defence stays 4 (Recommended)
- **Q-R3-6e** What should security forces be for?
  - Answer: A. A quick garrison: 4 Funds, 1 Manpower, 1,000 men, trained in 1 turn (Recommended)
## Payback

- **Q-R3-7a** How fast should mines and industry pay back?
  - Answer: A. Cheaper and 2 turns to build: mines back by turn 6, industry by turn 7 (Recommended)
- **Q-R3-7b** Should some building cost Manpower as well as Funds?
  - Answer: A. Yes: fortifications, roads and rail take part of their price in Manpower (Recommended)
## Popular Resistance

- **Q-R3-11** When Popular Resistance goes, what should replace it?
  - Answer: C. Barricades worth 2, and Madrid and Barcelona start fortified
## Computer player

- **Q-R3-10a** When a rival is one step from winning, what should the computer players do?
  - Answer: A. Attack the leader as readily as they guard, accept worse odds, and count a foothold that spoils a territory as a full success (Recommended)
- **Q-R3-10b** Should the computer players change how they spend when a rival is close to winning?
  - Answer: A. Yes: at 2 steps or fewer, no saving for builds, and prefer units that train in one turn (Recommended)
## Music

- **Q-R3-3a** How should the music be delivered?
  - Answer: Four files, one per track, with the fades built in (Recommended)
- **Q-R3-3b** Which quality should the music ship at?
  - Answer: Opus 64 and AAC 96, after you listen (Recommended)
- **Q-R3-3c** What should happen with sound on a first visit?
  - Answer: Music starts with the first campaign, at a modest level, with a notice and a mute button (Recommended)
## Sound effects

- **Q-R3-3d** Which sounds should we make now?
  - Answer: Your eight, plus a soft refused tick and one distant-guns sound when the battle report opens (Recommended)
- **Q-R3-3e** Which candidate sounds do you like? Tick every one to keep.
  - Answer: Create order: Typewriter burst; Recruit: Snare drum roll (Recommended); Build: Two anvil strikes (Recommended); Air mission: Fighter flyover (Recommended); Rail move: Whistle, then train on rails (Recommended); Truck move: Diesel pulls away (Recommended); Reinforce on foot: Squad marching (Recommended); Battle report opens: Distant cannon (Recommended)
  - Notes: I didn't like any of the end turn noises, lets keep trying. I kinda like Empire Total War's noise.
- **Q-R3-3f** How strict should the limits on repeated sounds be?
  - Answer: Strict: one sound per action, a special sound at most every four seconds, then a quiet tick (Recommended)
## Bandwidth

- **Q-R3-3.a-1** When should the detailed map picture load?
  - Answer: Only when the player zooms in, or when idle on a fast connection (Recommended)
- **Q-R3-3.a-2** Should a download size limit stop a build?
  - Answer: Report only
## Aircraft markers

- **Q-R3-2** What should an aircraft card print?
  - Answer: Attack-defence like other units
## Recruit page

- **Q-R3-4** How should Recruit show a unit's special effects?
  - Answer: A fold-out line per unit
## Battle sheet

- **Q-R3-5** Should the battle sheet show why a unit's strength is what it is (men, morale), not just the total?
  - Answer: Yes, show men and morale per unit (Recommended)
  - Notes: I am really just trying to evolve the "p.battle-score" section of the existing UI. I just want a "Effects on the Roll:" and then green pluses and red minuses. We don't need a "helps the defender" or "helps the attacker" section, this can just be 1 long running ledger, the the total at the bottom. / I want something like: / [icon of the die roll] / [ledger of effects] / Outcome: [the final die roll] / [... rest of the existing UI]
## Invasion pane

- **Q-R3-8** On Invade, keep the odds pinned while you scroll the units?
  - Answer: Scroll everything
  - Notes: And then, we should show the defender's unit stats, honestly it should use the same card as the attacker's units (sans checkbox and travel chip). We also need to show any known die effects in the "odds view". / I am skeptical of the floating "order 10 units to invade" button, I think this button should either be at the bottom of the scroll or somewhere else. Similar to note 1; this view should have a sizing handle. Also, when units are selected in the invasion panel, they should be highlighted in the map view, the same way we do for the single region view.
## Casualties

- **Q-R3-9a** What should the casualty counter count?
  - Answer: All men lost: battles, surrenders, disbanded units and cold (Recommended)
- **Q-R3-9b** Where should the casualty total sit, and how long can it be?
  - Answer: Beside the faction name, as 12.4k, tapping shows the split by side (Recommended)
  - Notes: Yes, and use skull and bones icon
## Pruning

- **Q-R3-P1** The game no longer uses the old six-sided-die battle rules, but most tests still run on them. Remove them?
  - Answer: Remove them completely
- **Q-R3-P2** When should the pruning happen?
  - Answer: Both
## Left open from Rev 2

- **Q-R3-C1** Should a paved airfield still let aircraft fly in rain and snow?
  - Answer: Yes, keep the exception (Recommended)
- **Q-R3-C2** Should trucks move on any road, not only main roads?
  - Answer: Yes, any road, but still not across a mountain pass (Recommended)
## How Rev 3 runs

- **Q-R3-S1** May I run balance sims on the finished economy?
  - Answer: Only after I've playtested



We need to iterate on rev 3 notes, here are my answers, lets iterate on the UX and Economy(Buildings, Units, Upkeep, etc.)
