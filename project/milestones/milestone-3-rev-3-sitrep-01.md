# Milestone 3 Rev 3: sitrep 1 (2026-11-23)

Built on branch `m3r3` and squashed onto `main` as one commit, on top of the CI work (`ddd77b4`).

## Checks
- Linux container (`npm run verify:linux`): lint, types, 1,756 unit tests, build and 41 browser tests pass, 3 skipped; coverage 98.9 statements, 95.4 branches.
- The owner approved the new desktop visual baselines, and the production smoke test counting 46 cards (aircraft use the same card now). Only the deployed site runs the smoke test; it passed on a local production build.

## Built
Everything in `milestone-3-rev-3-tasks.md` D1 to D9.

## Read before playing
- Militia has no Funds pay (the round 3 note won over the option).
- Factories: one to a city, levels 0 to 3, 15 at the start (Barcelona and Bizkaia level 2). Nine have a source; Gijon, Zaragoza, Madrid, Valladolid, Valencia and Seville rest on design notes.
- Road upgrades fit only a link with no road, since trucks use any road.
- Madrid and Barcelona start fortified by design; no source.
- A raid lowers a Factory only at a site with no buildings, as before.
- An accepted Recruit can still be refused at reveal if the player then removes the Disband that made room; the shortage warning shows first.
- Units the computer leaves off a full train hold.

## Not done or not verified
- Nobody has listened to any audio. Freesound files are previews; `ATTRIBUTION.md` lists the originals.
- No sims, by request. An all-computer game ended on turn 2 before the pair rule (`e410265`); the 10-game smoke test allows at most 5 percent of wins before turn 4 and passes.
- Screen readers, real touch, Safari and Firefox.
- `e2e:capture` was not run. Phone baselines are old.
- Review: pane, cards, audio, upkeep, computer player (a partial one for numbers, Factory and rail). The d6 deletion had none.
