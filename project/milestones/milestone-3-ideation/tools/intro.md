<p class="eyebrow">Design review &middot; Milestone 3</p>

# Milestone 3 Ideation

<p class="meta"><span>19 November 2026</span><span>Branch <code>m3-ideation</code></span><span>Base <code>main</code> at <code>d7f3006</code></span><span>13 ideas &middot; 6 research clusters</span></p>

This review covers the owner's 13 Milestone 3 ideas. For each idea we checked game precedents, designer notes, reviews, and Spanish Civil War history. We then mapped each idea onto today's engine and turned it into options and multiple-choice questions. It replaces the older draft `project/milestones/milestone3.md`, and it is ideation only: nothing in the game was changed or tuned.

**How to use this page.**
- Each idea ends with its questions. The recommended option is listed first and marked.
- Answers are saved in this browser as you go.
- **Copy my answers** in the contents panel gives you Markdown keyed by question id, to paste back to the team.
- **Use recommended for blanks** fills only the questions you have not answered. Change any you disagree with.
- Every question also has a notes box.
- The widgets are live, and they use the real numbers from `scenario.json` where there are any.
- The mockups are drawn over real captures of today's app and labelled as illustrative.

<!-- mockup:current-planning -->

## The short version

The order matters more than the ideas themselves. Three of the 13 are platform work: the harness (11), the data model (13), and the build process (10). Those come first, because every other idea changes balance, and today balance can only be measured with one 200-game soak test. Sub-regions (7) and graded d20 results (9) come next, since cities (4) and supply depend on them, and income per sub-region would otherwise be built twice. The economy (2, 1) can work at territory level if the owner wants it sooner (Q-SEQ-1, option 2). Everything else adds content on top.

| Idea | Recommended direction | Where it lands |
|---|---|---|
| 11 Harness | `npm run sim` CLI over worker threads, sharing one game loop with the soak; JSON, CSV, and HTML output with Wilson intervals; paired-seed A/B variants | <span class="pill m3">M3 rev 1</span> |
| 13 Generic engine | Numbers in data, algorithms as named, tested modules picked by a `rules` object; AI weights move to data now (put to the owner as Q-DATA-1) | <span class="pill m3">M3 rev 1</span> |
| 10 Process | A CI gate on every push, a short steering file, a contract stream first, a file-ownership table, and the harness as a merge gate; at most 3 to 4 streams | <span class="pill m3">M3 rev 1</span> |
| 3 Timed turns | Each player's clock runs only on their own planning screen; on timeout, planned orders lock and other armies hold; Off, 1, 5, 10 min now | <span class="pill m3">M3 rev 1</span> |
| 7 Sub-partitioning | About 55 sub-regions (the 1936 provinces, with overrides) decide control, cities, income, and supply; moves and battles stay on the 18 territories | <span class="pill m3">M3 rev 2</span> |
| 9 d20 | An 11-grade ladder; each grade sets losses (10, 20, or 35 percent), morale, and ground taken; the chance to take a territory stays within 5 points of today | <span class="pill m3">M3 rev 2</span> |
| 2 Resources | Funds and Manpower, plus a build limit per site; oil and food fold into Funds and foreign aid; political capital and action points deferred | <span class="pill m3">M3 rev 3</span> |
| 1 Recruitment | Separate Recruit and Replenish orders (not "reinforce"); militia trains in 1 turn and other types in 2; Replenish restores up to half establishment per turn | <span class="pill m3">M3 rev 3</span> |
| 4 Cities | Cities become features of a sub-region, and armies are no longer stationed in them; three buildings (Depot, Workshop, Fortifications) and ports as map features; sieges through supply | <span class="pill m3">M3 rev 3</span> |
| 12 Weather | Four climate zones, each with a table for every month, rolled and shown before planning; soft effects only | <span class="pill m3">M3 rev 4</span> |
| 8 Unit types | Artillery with the owner's rule on the d20 scale, capped at +3; air as abstract faction wings; commanders as display-only chips; tanks, cavalry, and AA deferred | <span class="pill m3">M3 rev 4</span> partly |
| 6 Movement | Keep one move per turn; three straight turns of attacking demoralize an army; drop action points | <span class="pill m3">M3 rev 4</span> |
| 5 Rail | Three track levels that set capacity and range, rail moves into friendly ground only, and a one-level drop on capture | <span class="pill later">Later</span> |

**Biggest risks.**
- **Balance.** Every new rule may move the 58 percent freeze rate. Economy, weather, and faded results all lean toward more stalemate, and only the harness can tell.
- **Two cluster conflicts.** Which grades take a whole territory, and whether standing battles stay. See "Tensions and risks".
- **Orders.** The new orders are the first that are not moves.

**Research status.** Web search and fetch worked for all six clusters, at about 18 to 31 calls each. Some sources could not be read:
- **Blocked:** the GMT Paths of Glory rules PDF (403), the Unity of Command II manual (image-only), the HOI4 wiki, the War in the East 2 rules site, the OCS rules, a Paradox forum thread, and the tsx docs. Claims from those games are tagged as recall or as search snippets.
- **No source found:** VR Designs' "Spain 1936", "Brother Against Brother", Backstabbr's and Neptune's Pride's timeout behaviour, or Civilization's timer behaviour.

Every claim made from memory is tagged "(from recall, unverified)" in the text.
