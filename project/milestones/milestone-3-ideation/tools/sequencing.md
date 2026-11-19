## Sequencing and dependencies

**The argument.** Build the instruments before the experiment, then the floor before the furniture.

1. **Harness, data model, and gate first (ideas 11, 13, 10).**
   - Nearly every other idea changes who wins and how often games freeze.
   - Today the only instrument is a 200-game soak inside the unit suite, which reports bands rather than intervals and cannot compare two rule variants.
   - The Engine cluster measured it once at about 12 ms per game. Speed is not the problem: the missing parts are reports, Wilson intervals, and paired-seed A/B runs.
   - The same revision adds the `rules` object and scenario spec version 2 (mismatch d), so later revisions add modules instead of renaming the ruleset each time.
   - It also adds the CI gate the process review asks for.
   - The turn timer (3) rides along. It touches no rules, so it is a low-risk first vertical slice to prove the new gate and file-ownership table.
2. **Graded results and sub-regions together (ideas 9 and 7).**
   - The split rule reads each d20 grade's `ground` value. A ladder designed without a split rule, or a split rule designed without a ladder, would have to be redone.
   - The two belong in one contract stream: grade ids, `ground`, the sub-region schema, and the start-of-game control table.
3. **Economy on top of sub-regions (ideas 2, 1, 4, and supply from mismatch c).**
   - Income per sub-region, cities as features of sub-regions, and the supply trace all need step 2.
   - Recruit and Replenish need resources and sites.
   - This is also when the first orders that are not moves arrive, a contract change of its own.
4. **Content (ideas 12, 8, 6).**
   - Weather, artillery, abstract air wings, commander chips, and exhaustion each read existing hooks: the d20 modifiers, morale, and the calendar.
   - Each can ship or be held back on its own harness result.
5. **Later (idea 5 and the deferred parts of 6 and 8).**
   - Rail capacity matters once armies can make strategic moves of more than one step, and its real 1936 role was moving troops behind the front.
   - It waits for multi-step movement, which the Military cluster recommends only if sub-regions become the movement grid.

<div class="diagram" role="img" aria-label="Dependency diagram: platform work in revision 1 feeds graded results and sub-regions in revision 2, which feed the economy in revision 3 and content in revision 4; rail and movement points come later.">
<svg viewBox="0 0 1000 390" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead"/></marker></defs>
<text class="col" x="95" y="30" text-anchor="middle">REV 1 &#183; PLATFORM</text>
<text class="col" x="295" y="30" text-anchor="middle">REV 2 &#183; MAP AND BATTLE</text>
<text class="col" x="495" y="30" text-anchor="middle">REV 3 &#183; ECONOMY</text>
<text class="col" x="695" y="30" text-anchor="middle">REV 4 &#183; CONTENT</text>
<text class="col" x="895" y="30" text-anchor="middle">LATER</text>
<g>
<rect class="node m3" x="10" y="60" width="170" height="40" rx="5"/><text x="95" y="85" text-anchor="middle">11 Harness CLI</text>
<rect class="node m3" x="10" y="120" width="170" height="40" rx="5"/><text x="95" y="145" text-anchor="middle">13 Rules modules, spec v2</text>
<rect class="node m3" x="10" y="180" width="170" height="40" rx="5"/><text x="95" y="205" text-anchor="middle">10 CI gate, contracts</text>
<rect class="node m3" x="10" y="240" width="170" height="40" rx="5"/><text x="95" y="265" text-anchor="middle">3 Turn timer</text>
<rect class="node m3" x="210" y="80" width="170" height="40" rx="5"/><text x="295" y="105" text-anchor="middle">9 d20 graded ladder</text>
<rect class="node m3" x="210" y="180" width="170" height="40" rx="5"/><text x="295" y="205" text-anchor="middle">7 Sub-regions</text>
<rect class="node m3" x="410" y="60" width="170" height="40" rx="5"/><text x="495" y="85" text-anchor="middle">2 Funds, Manpower</text>
<rect class="node m3" x="410" y="120" width="170" height="40" rx="5"/><text x="495" y="145" text-anchor="middle">1 Recruit, Replenish</text>
<rect class="node m3" x="410" y="180" width="170" height="40" rx="5"/><text x="495" y="205" text-anchor="middle">4 Cities, 4 buildings</text>
<rect class="node m3" x="410" y="240" width="170" height="40" rx="5"/><text x="495" y="265" text-anchor="middle">(c) Supply trace</text>
<rect class="node m3" x="610" y="60" width="170" height="40" rx="5"/><text x="695" y="85" text-anchor="middle">12 Weather</text>
<rect class="node m3" x="610" y="120" width="170" height="40" rx="5"/><text x="695" y="145" text-anchor="middle">8 Artillery, air wings</text>
<rect class="node m3" x="610" y="180" width="170" height="40" rx="5"/><text x="695" y="205" text-anchor="middle">6 Exhaustion</text>
<rect class="node m3" x="610" y="240" width="170" height="40" rx="5"/><text x="695" y="265" text-anchor="middle">8 Commander chips</text>
<rect class="node later" x="810" y="60" width="170" height="40" rx="5"/><text x="895" y="85" text-anchor="middle">5 Rail capacity</text>
<rect class="node later" x="810" y="120" width="170" height="40" rx="5"/><text x="895" y="145" text-anchor="middle">6 Movement points</text>
<rect class="node later" x="810" y="180" width="170" height="40" rx="5"/><text x="895" y="205" text-anchor="middle">8 Tanks, cavalry, AA</text>
<rect class="node later" x="810" y="240" width="170" height="40" rx="5"/><text x="895" y="265" text-anchor="middle">Support orders</text>
<rect class="node later" x="810" y="300" width="170" height="40" rx="5"/><text x="895" y="325" text-anchor="middle">Political capital</text>
</g>
<g>
<path class="edge" d="M180 140 C195 140 195 100 208 100" marker-end="url(#arr)"/>
<path class="edge" d="M180 140 C195 140 195 200 208 200" marker-end="url(#arr)"/>
<path class="edge" d="M295 120 L295 178" marker-end="url(#arr)"/>
<path class="edge" d="M380 200 C395 200 395 80 408 80" marker-end="url(#arr)"/>
<path class="edge" d="M380 200 L408 200" marker-end="url(#arr)"/>
<path class="edge" d="M380 200 C395 200 395 260 408 260" marker-end="url(#arr)"/>
<path class="edge" d="M495 100 L495 118" marker-end="url(#arr)"/>
<path class="edge" d="M495 180 L495 162" marker-end="url(#arr)"/>
<path class="edge" d="M580 140 L608 140" marker-end="url(#arr)"/>
<path class="edge" d="M895 120 L895 102" marker-end="url(#arr)"/>
</g>
<rect class="band" x="10" y="300" width="770" height="40" rx="5"/>
<text x="395" y="325" text-anchor="middle">Every merge: CI fails on correctness (lint, types, unit, build); a paired-seed harness run must be no worse than the last revision</text>
<text class="col" x="10" y="372">Arrows show "needs". Also, not drawn: 9 feeds artillery's roll bonus (8); supply gates recruitment (1); 7 and movement points gate rail (5).</text>
</svg>
</div>

**What each revision proves before the next starts.**

| Revision | Lands | Exit check |
|---|---|---|
| 1 Platform | Harness CLI, `rules` object and spec v2 (with `m2-strength` as a preset), AI weights in data, CI gate, turn timer | `npm run sim` reproduces today's soak figures exactly on the same seeds; CI is green on every commit |
| 2 Map and battle | d20 ladder with ground grades, about 55 sub-regions for control and income, new battle card | Paired-seed harness run against Rev 1: chance to take per column within 5 points; freeze rate and faction shares reported with intervals |
| 3 Economy | Funds and Manpower, Recruit and Replenish, cities in sub-regions with three buildings and port features, supply trace, foreign-aid schedule | Freeze rate does not rise beyond its interval; the Southern command's share is reported and, if the owner sets a target (Q-MIS-e), checked |
| 4 Content | Weather (soft set), artillery, air wings, commander chips, exhaustion | Each feature ships only if its own A/B run is no worse than revision 3 (Q-SEQ-3); otherwise it stays behind its module flag |

### Questions

<!-- questions:sequencing -->
