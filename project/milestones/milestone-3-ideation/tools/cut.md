## Proposed Milestone 3 cut

Milestone 3 should still read as one milestone: **"a war economy on a finer map, measured by a harness."** The cut below keeps the game near the 6/10 complexity `plan.md` aims for. Each player decision added per turn has to earn its place.

Only one idea is dropped outright: action points, which the owner's own question mark already hedged.

| Idea | Milestone 3 (revisions 1 to 4) | Later milestone | Dropped or parked |
|---|---|---|---|
| 11 Harness | CLI, worker threads, reports, Wilson intervals, paired-seed A/B variants, CI-sized soak | Balance dashboards across commits; AI tournaments | |
| 13 Generic engine | `rules` object, spec v2, `m2-strength` kept as a preset, AI weights and new blocks as data | Second game mode as the real test of genericity | Encoding resolution algorithms as data |
| 10 Process | CI gate, short steering file, contract stream first, file-ownership table, owner-reviewed harness check at each merge, read-only reviewer per stream | Scripted multi-agent workflows; cloud runs | Agent teams before the gates work |
| 3 Timed turns | Off, 1, 5, 10 min on a shared PC; Pause; planned orders lock on timeout | 30 min and 1 h with online play | |
| 7 Sub-partitioning | About 55 sub-regions for control, cities, income, and supply; ground grades flip sub-regions | Sub-regions as the movement grid | Dynamic geometry |
| 9 d20 | 11-grade ladder with faded losses and ground values; new battle card | | |
| 2 Resources | Funds and Manpower, build limit per site, foreign-aid schedule | Materiel or production capacity, if the harness shows Funds alone is too flat | Oil and food as separate stocks; research points; action points |
| 1 Recruitment | Recruit and Replenish orders, training time per type, recruitment tags per site | Faction-specific militia rules beyond site tags | Reviving destroyed armies |
| 4 Cities | Cities as features of sub-regions; stationing in cities removed; Depot, Workshop, Fortifications; ports as map features | Airfield (with air units), rail yard (with rail) | |
| 12 Weather | Four zones, monthly tables, visible before planning, soft effects | Movement and air effects once ideas 6 and 8 land | |
| 8 Unit types | Artillery; air as abstract faction wings; commander chips with no rules effect | Tanks, cavalry, AA as values-only types; commander effects if wanted | Bomber missions that cut income, until air wings prove themselves |
| 6 Movement | Offensive exhaustion through the existing morale rule | Movement points, if sub-regions become the movement grid | Action points |
| 5 Rail | | Track levels 0 to 3, capacity and range, damage on capture | Gauge breaks (a later, wider-map scenario) |
| OD-9 Support orders | Not in Milestone 3: measure first | Revisit if the freeze rate stays above budget after revision 3 | |

**Why rail waits.**
- Its historical role in 1936 was moving troops behind the front, such as Madrid to Valencia, more than carrying the assault.
- Its game value comes from moves of more than one step, which do not exist while armies move one connection a turn.
- It also needs the sub-region and supply plumbing from revisions 2 and 3.
- Once those exist, rail is a small, self-contained follow-on milestone, and the Map cluster's design is ready for it.

**What makes the cut smaller if the owner wants less.**
- Drop revision 4 entirely and keep weather, artillery, and exhaustion for Milestone 4.
- Revisions 1 to 3 still deliver the old draft's goal of recruitment, replacement of lost men, and income, on a sounder footing.
