### Coordinator assumptions

1. **A-COORD-1.** The work lives on branch `m3-ideation`, cut from `main` at `d7f3006`. Nothing on `main` changed and no game source changed.
2. **A-COORD-2.** This report supersedes `project/milestones/milestone3.md`. That draft is left in place, unedited, for comparison.
3. **A-COORD-3.** The ideas are grouped as Platform, Map, Economy, Armies, and Time, not numbered 1 to 13. The order follows the dependency argument in "Sequencing and dependencies". Idea numbers are kept so the owner can find each idea.
4. **A-COORD-4.** Six research agents ran in parallel, one per cluster, with one mockup agent beside them. Each was capped at about 25 to 30 web searches and fetches. Their raw notes are in `research/`, unedited apart from assembly.
5. **A-COORD-5.** Each idea has exactly one owning cluster. Idea 4 is owned by Map, and Economy supplied the "City and rural yields" subsection. Each of the five mismatches has one owner, and Military and Economy added a paragraph to (b) and (e).
6. **A-COORD-6.** All the mockups share one fact sheet:
   - **Resources:** Funds, Manpower, and an optional Materiel.
   - **Orders:** Recruit and Replenish.
   - **Units:** the new unit list and its values.

   Every number in a mockup is illustrative and untuned. Where a research recommendation differs from the fact sheet, the text wins and the mockup shows one option.
7. **A-COORD-7.** There is no image-generation tool. Every mockup is HTML and SVG drawn over real Playwright captures of today's app and then rendered to WebP. The mockup agent's notes say which captures came from a live run.
8. **A-COORD-8.** Two copies of the page exist:
   - **Committed copy:** `milestone-3-ideation.html`, a full standalone document.
   - **Artifact copy:** the same page without the outer document skeleton, which the Artifact host adds itself.

   Both embed the mockups as WebP data URIs, so each is self-contained.
9. **A-COORD-9.** Answers are kept in `localStorage` under the key `m3-ideation-answers-v1`, and every call is wrapped in try/catch. When the page runs as a claude.ai Artifact with storage, each viewer's answers are also saved to the artifact's database as the document `answers/<viewer id>`, so a later agent can read them back. **Copy my answers** works in both cases and is the dependable route.
10. **A-COORD-10.** "Use recommended for blanks" fills only unanswered questions, and the copied Markdown marks each recommended pick. The owner can accept the defaults and override only where they disagree.
11. **A-COORD-11.** The assembly tool (`tools/assemble.mjs`) uses `marked` 15.0.12, installed outside the repository. It is throwaway tooling and adds no dependency to `package.json`.
12. **A-COORD-12.** Question ids are stable: `Q-<AREA>-n`, with one area per idea and `Q-MIS-<letter>-n` for the mismatches. A later revision can add questions without renumbering.
