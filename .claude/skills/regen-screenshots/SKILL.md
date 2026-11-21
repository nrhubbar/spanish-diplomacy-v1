---
name: regen-screenshots
description: Regenerate review captures (npm run e2e:capture) of the current app on a private port, and say where they landed. Use when you need fresh images of the real UI for a review, mockup base or bug report.
---

Follow `project/testing-screenshots.md` (the screenshot SOP). In short:

1. Pick a free port of your own: `E2E_PORT=<52xx> npm run e2e:capture`. Never rely on the default 5173; another session's server may answer.
2. Captures land in `build/e2e/screenshots/<project>-<NN-name>.png` (`chromium` 1440×800, `mobile-chromium` Pixel 7). Check timestamps with `ls -la` before trusting them.
3. Visual baselines (`e2e/baselines/`) are a different thing. Do not run `npm run e2e:baselines` unless the owner asks: the owner regenerates the Linux baselines CI uses.
4. Design images kept with docs are `.webp` under `project/milestones/**/images/` and are stored in Git LFS.
