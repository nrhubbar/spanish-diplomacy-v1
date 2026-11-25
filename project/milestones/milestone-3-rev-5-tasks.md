# Milestone 3 Rev 5: balance

Base: `main` 7ebaff5 (Rev 4 as one commit, not pushed). Branch `m3r5`. Plan page: https://claude.ai/artifact/JJKhVjmnqcNxjV6owtatzu. Answers and how they are read: `milestone-3-rev-5-balance/owner-answers.md`.

## Baseline (the Rev 4 computer player, unfixed)

400 games, seeds 1001-1400: Republic 53.2%, North 25.2%, South 21.5%; median 14 turns; 35% over by turn 8; 8% won before turn 4; winner leads alone a median of 3 turns; 21% of winners give three arms 10% of their combat recruits. The first 200 games (seeds 1-200, 43.5 / 37 / 19.5) reproduce byte for byte but were a lucky draw (p = 0.01); pooled over 600: 50 / 29 / 21.

## Goals

28-39% a seat; median 20-30 turns and 60% of games inside; at most 5% over by turn 8; winner leads alone under 2 turns (median, territories); a player that never builds wins at most 5%; winners give three arms 10% or more of their combat recruits; most games reach January 1937; builder and combined arms win their fair share; no strategy over 50% against mixed opponents, and no cheese strategy more than 10 points above its seat's normal rate.

## Tooling

`milestone-3-rev-5-balance/goals.py RUN_DIR` prints the goals table from a recorded run.

## Workstreams

1. `personas` (branch `m3r5-personas`): persona library and seats in the scenario data, general knobs, byte-identical replay.
2. `ai-fix` (branch `m3r5-ai-fix`): aircraft, anti-air and trucks valued by worth.
3. Coordinator: static tables, goals report, runs and tuning.

## Rules

Numbers and personas only (B-15). Sims are approved for this revision. Nothing is pushed or merged to `main` without the owner.
