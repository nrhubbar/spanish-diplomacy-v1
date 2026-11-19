## Tensions and risks

### Cross-cutting tensions

1. **A generic engine against "avoid premature generic abstractions".**
   - The north star (idea 13) wants game modes as "jpegs and jsons".
   - `coding-principles.md` says to avoid premature generic abstractions.
   - Revision 6 section 1.6 kept resolution algorithms in code, because encoding them as data makes them untestable.
   - The Engine cluster proposes a middle ground: numbers live in data, and each algorithm is a named module, picked by a `rules` object and tested on its own. That is a choice of direction, so it is put to the owner as Q-DATA-1 rather than decided here.
2. **How much ground a graded result takes.**
   - The two clusters agree on the interface: each grade carries `ground`, which is 0, a number of sub-regions, or "all", and the split rule P1 flips that many sub-regions, nearest the attacker first.
   - The open question is calibration. The Military ladder takes the whole territory on its four best grades, which keeps today's chance to take a territory per odds column, and only two grades flip 1 or 2 sub-regions.
   - With 8 provinces in Andalucia but only 1 in La Rioja, going from "2 sub-regions" to "all" is a large jump in one territory and no jump in another.
   - Partitions, the point of idea 7, would then be fairly rare.
   - See Q-TEN-1.
3. **Standing battles or a Push order.**
   - Military keeps M27: armies of factions sharing a territory fight once a turn, with no new order.
   - Map replaces M27 with a `push` order that attacks a neighbouring enemy sub-region inside the same territory. A move to your own territory would break M2 and L6.
   - The Map cluster's design is the more faithful; M27 is cheaper and already tested.
   - See Q-TEN-2.
4. **The first orders that are not moves.**
   - Revision 7 kept every submission a list of move orders, with Entrench and Rest derived (O5).
   - Replenish (idea 1), Recruit and builds (ideas 1 and 4), and air missions (idea 8) all break that.
   - This is a contract change and should land once, in the revision 3 contract stream, not piecemeal.
   - See Q-TEN-3.
5. **Game length and the calendar.**
   - No turn length is stored anywhere. Every cluster assumed two weeks, from the owner's weather note.
   - At that rate the soak's 30 turns end in late September 1937, before Teruel, Alfambra, the Ebro, and the winters that weather is for.
   - Mola's death falls in turn 22.
   - A `calendar` block is needed, and the harness should also run 60 to 70 turns.
   - See Q-TEN-4.
6. **Balance pressure points the same way.**
   - Several proposals lean toward more stalemate:
     - weather penalties fall on attackers;
     - faded results destroy fewer defenders;
     - recruitment adds defenders.
   - Economy at the illustrative yields gives the Republic 23 Funds on turn 1 against 14 for both insurgent commands together, widening the Southern command's weakness.
   - Capturable income and the 1- and 2-sub-region grades push the other way.
   - None of this can be judged by argument. That is why the harness comes first and every revision has a harness exit check.
7. **The map pipeline.**
   - About 55 sub-regions means a new ADM2 boundary source, its checksum and attribution, a split of the Baleares, and hand-drawn overrides for Asturias and Madrid.
   - It also means a sub-region wash in the renderer.
   - This is the largest single piece of new art and data in the cut.
   - Province adjacency in the research is from recall. A real build derives it from the geometry.
8. **Scope against complexity.**
   - All 13 ideas together would push the game well past the 6/10 complexity of `plan.md`.
   - The cut keeps the per-turn decisions to: move, plus at most recruit, replenish, and build per site.
   - Everything else is either automatic (weather, exhaustion, supply) or display-only (commanders).
9. **Process.**
   - Milestone 3 touches the same hotspot files in nearly every idea: `engine/types.ts`, the loader, the scenario schema, `CampaignMap.tsx`, and `state/planning.ts`.
   - Revision 7 D28 is the warning sign.
   - Without a contract stream and a file-ownership table, parallel streams will collide more than in Milestone 2.

### Questions on these tensions

<!-- questions:tensions -->

### The five known mismatches in the old draft

<!-- include:mismatch:a -->

<!-- questions:mismatch-a -->

<!-- include:mismatch:b -->

<!-- include:mismatch:b-military -->

<!-- questions:mismatch-b -->

<!-- include:mismatch:c -->

<!-- questions:mismatch-c -->

<!-- include:mismatch:d -->

<!-- questions:mismatch-d -->

<!-- include:mismatch:e -->

<!-- include:mismatch:e-economy -->

<!-- questions:mismatch-e -->
