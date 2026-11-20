# Milestone 3 Ideation

> Internal. Nothing here may be imported into or rendered by the player-facing application.

This is a design review of the owner's 13 Milestone 3 ideas. It supersedes `../milestone3.md`.

- `milestone-3-ideation.html`: the report. Open it in a browser. It is self-contained, with the mockups embedded, and the answers are saved in the browser. **Copy my answers** produces Markdown keyed by question id.
- `milestone-3-ideation.md`: a Markdown copy of the same content, including every question, for diffing.
- `research/`: each research cluster's raw notes (`<cluster>.md`, with source URLs), its report sections, its questions as JSON, and its widget code.
- `images/`: mockups and captures of today's UI (WebP).
- `mockups/`: the HTML and SVG sources of the mockups and `render.mjs`, which redraws them over fresh `npm run e2e:capture` screenshots.
- `tools/`: the assembler and the coordinator's own sections (overview, sequencing, cut, tensions, assumptions).

To rebuild the report, install `marked` 15.0.12 anywhere outside the repository, then run:

```
MARKED=/path/to/node_modules/marked/lib/marked.esm.js node project/milestones/milestone-3-ideation/tools/assemble.mjs
```
