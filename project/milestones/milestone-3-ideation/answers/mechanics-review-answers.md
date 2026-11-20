# Owner answers to the Milestone 3 mechanics review (2026-11-19)

Pasted by the owner from "Copy my answers" on the mechanics review page (mechanics-review/). 37 of 37 answered.
"(Recommended)" marks the review's recommended option.

## Contested ground
- Q-MR-01 Morale recovery: rest (uncontested), Replenish (uncontested), general rallies in contested ground. (Recommended)
- Q-MR-02 Demoralized army in contested ground holds and defends, gains no fatigue, may withdraw; recovers only if a general rallies it. (Recommended)
- Q-MR-03 Keep M27; "attack by default" = no entrench/rest; only the M27 attacker's armies gain fatigue. (Recommended)
- Q-MR-04 Fatigue 2 = "Fatigued" -2 d20; 3 = demoralized; +1 per attack turn; quiet uncontested turn resets to 0. (Recommended)
- Q-MR-05 Any battle cancels Replenish (Q-RECR-5 as ticked); defending has no other effect.
- Q-MR-37 Capital holder (else last controller) always defends, in M27 and M19; attacker = greatest attack. (Recommended)

## Combat numbers
- Q-MR-06 13 grades; explicit 7x21 table of grade ids in data; harness tunes. (Recommended)
- Q-MR-07 General +1 d20, barricades +1 d20. (Recommended)
- Q-MR-08 Break-up below 10% of full strength. (Recommended)
- Q-MR-09 Barricades apply whenever the battle territory has a city the defender controls, every faction.

## Income and balance
- Q-MR-10 Leave it; Southern command is poor. Note: "if they need more income, we'll increase the Money they get from those ports" (Ceuta, Melilla).
- Q-MR-11 Build queues pause in contested territory; forfeit/inherit on change of hands. (Recommended)
- Q-MR-12 Farms (Manpower), Mines (Funds), Industry (Funds, city only), levels 0-3, 1936 starting levels. (Recommended)
- Q-MR-13 Barracks, Factory, Depot, Fortifications, Hospital, Airfield, Rail yard; Port and Rail are levelled sub-territory improvements; Depot gates trucks and tanks and raises the replenishment cap. (Recommended)
- Q-MR-14 Training under way when contested: militia finish, others pause; no new Recruit there. (Recommended)

## Movement, rail, ports
- Q-MR-15 Allowance: 1, +1 trucks, -1 mountain/swamp entry, -1 Mud/Snow, min 1; rail legs free. (Recommended)
- Q-MR-16 Transit can be intercepted: if an enemy army enters a territory you pass through, your army stops there and defends.
- Q-MR-17 Move-then-rail only into friendly ground; attack is always the last step. (Recommended)
- Q-MR-18 Rail level 0-3 per sub-territory; board at capital; route's lowest level sets range; boarding capital's level (+1 Rail yard) sets armies per turn. (Recommended)
- Q-MR-19 Each connection names its entry sub-territory on each side; its terrain applies. (Recommended)
- Q-MR-20 One truck per two other units; trucks take losses. (Recommended)
- Q-MR-21 Contested = 2+ factions hold sub-territories; entry into whole enemy territory with no army takes all (M6); P7 sweep one a turn inside contested, outer first, capital last. (Recommended)
- Q-MR-22 Forced retreats need a path through own sub-territories, else surrender. (Recommended)
- Q-MR-23 Sail from a friendly port; land in friendly port up to capacity; amphibious assault -4 d20, one army per sea connection per turn. (Recommended)

## Armies, units, air
- Q-MR-24 (Recommended ticked) Note overrides: "Armies are wayyy more quasi. Basically, an army exists for a turn evaluation. They are units from the same territory with the same orders. From meaning they are moving out of the same territory that turn (not where they were necessarily recruited)."
- Q-MR-25 Artillery per side, +1 d20 per 3 points, max +3. (Recommended)
- Q-MR-26 Unit effect table is the starting sheet. (Recommended)
- Q-MR-27 Aircraft counters based at Airfields; one mission a turn in range (raid, intercept, support, recon); weather grounds unless paved; losses from raid roll and fighters. (Recommended)
- Q-MR-28 Roster of 3-5 generals per faction, one trait each; +1 and rally; free sacking brings the next; death only when his army is destroyed or routed, seeded. (Recommended)

## Weather and calendar
- Q-MR-29 One roll read against each zone's ordered seasonal table (Recommended), note: "but make it d20".
- Q-MR-30 Rain in a winter month closes the sea.
- Q-MR-31 24 half-month turns a year from Late July 1936; harness 60-70 turns. (Recommended)

## Harness, data, scope
- Q-MR-32 Freeze <= 15% over 1000 games by end of M3; each faction >= 20% of decided games. (Recommended)
- Q-MR-33 Blunder chance is a scenario value in the computer player (1 in 100 orders), real games and harness; harness reports with and without. (Recommended)
- Q-MR-34 src/scenarios/<id>/ with scenario.json, map.json, assets, optional plugin.ts registering named modules; MANIFEST.md + scenario.schema.json; shared symbols in one shared folder. (Recommended)
- Q-MR-35 Folder/id spanish-civil-war-1936; one war + one start date per scenario; tiny-front same layout under src/test/fixtures/scenarios/. (Recommended)
- Q-MR-36 Rev 1 attempts everything: contract stream fixes types/schema for all systems first; computer player gets a simple heuristic for each new order. (Recommended)

## Interpretations Claude applied (owner to correct if wrong)
1. Q-MR-24 note: the lasting piece is the unit. An "army" is formed each turn from the units that leave the same territory with the same order (or hold there together); there is no Organize order and no home territory. Men, morale and fatigue live on units. A general is attached to a unit and gives his +1 and rally to whichever army that unit is part of that turn (at most one general bonus per side). Trucks count per army that turn (one per two other units).
2. Q-MR-16 with Q-MR-17: only the last step may attack; earlier steps pass through ground held whole at the start of the turn. If an enemy army moves into one of those transit territories this turn, the passing army stops at the first such territory on its path and defends there as a reinforcement (M11).
3. Q-MR-09: barricades (+1 d20) stack with the Republic's Popular resistance (+3 d20 under Q-D20-6's x3 rule).
4. Q-MR-29: one d20 roll per turn, read against each zone's table ordered best to worst.
5. Q-MR-30: winter months are December, January and February; Rain in a coastal zone those months closes the sea connections touching it.
