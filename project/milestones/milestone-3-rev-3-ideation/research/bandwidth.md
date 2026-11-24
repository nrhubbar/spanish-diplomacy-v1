# Bandwidth, streaming and compression (owner's note 3a)

> Internal. Checked 22 Nov 2026 against `npm run build` in this worktree and the live site. Both have the same entry file name, so they are the same code. Labels: **[measured]**, **[docs]**, **[judgement]**.

## 1. What a player downloads today [measured]

Chromium, empty cache, live site, 1440 x 900:

| Step | Files | Bytes sent | What |
|---|---|---|---|
| Start screen | 8 | **244 kB** | Entry script 152 kB, scenario checker (Zod and loader) 42 kB, scenario 21 kB, styles 15 kB, map data 11 kB |
| Create Game | 1 | 67 kB | Map screens |
| Start Campaign | 23 | **2,748 kB** | Relief images 2,531 kB, Three.js 121 kB, borders 79 kB, 15 unit icons |
| Zoom in four times, end turn | 0 | 0 | Everything had already loaded |
| **Total** | 32 | **3.06 MB** | **83% is three relief images** |

Playing music from one file would add 6 to 16 MB (see `audio.md` 2.2), up to five times the whole game.

### Files by size [measured]

| File | Raw | gzip | Sent by CloudFront (Brotli) | Best Brotli (level 11) |
|---|---|---|---|---|
| `iberia-relief-detail.webp` (4032 x 3360) | 1,809 kB | no gain | 1,809 kB | no gain |
| `iberia-relief-margin.webp` | 525 kB | no gain | 525 kB | no gain |
| `iberia-relief-overview.webp` | 195 kB | no gain | 195 kB | no gain |
| `index.js` (entry) | 517 kB | 159 kB | 151 kB | 136 kB |
| `three.module.js` | 529 kB | 130 kB | 121 kB | 106 kB |
| `mapScreens.js` | 244 kB | 70 kB | 67 kB | 59 kB |
| `iberia-sub-territories.js` | 181 kB | 48 kB | 49 kB | 42 kB |
| `lazySources.js` (Zod 94 kB of 145) | 145 kB | 43 kB | 41 kB | 38 kB |
| `scenario.js` | 136 kB | 21 kB | 20 kB | 18 kB |
| `iberia-regions.js` | 102 kB | 28 kB | 29 kB | 25 kB |
| Styles | 78 kB | 15 kB | 15 kB | 13 kB |
| Source maps (27 files) | **7,288 kB** | 1,662 kB | not compressed | |
| All JavaScript | 1,899 kB | 518 kB | | 439 kB |

`build/dist` is 11.7 MB, 62% of it source maps.

### What is in the entry script [measured from the source map]

React DOM 178 kB, **the rules engine 145 kB**, React Router 38 kB, presentation text 35 kB, **the computer player 33 kB**, state 30 kB, Redux Toolkit 14 kB, Immer 9 kB. The start screen needs none of the engine or the computer player.

### The budget is already missed [measured]

`npm run budgets:check` says: **MISSED, 159.42 kB gzip against 155 kB.** Nothing runs that check: it is not in `npm run verify`, `mise.toml`, or `.github/workflows/ci-cd.yml`. Per the file's own rule this is reported, not fixed by raising the number.

### Other facts [measured]

- **No unused map images:** the three relief files are used. The unit icons are 16 separate scripts under 1.2 kB each, so about 1.3 kB on the wire each (below CloudFront's 1,000-byte minimum, so uncompressed).
- **Notes and sources ship to players.** `scenario.json` has over 400 lines with notes or source references, and no loader step removes them. `prune-audit` measured 67.6 kB raw, 11.4 kB gzip (its `p01`).
- **The scenario is validated in every player's browser.** The repository's tests already validate the same files.
- **Three.js is 121 kB to draw three textured rectangles**; the same images placed with CSS are already the loading state and fallback.

## 2. Hosting, as it is

| Check | Result | |
|---|---|---|
| Compression | Brotli and gzip on scripts and styles; no Zstandard | [measured] |
| Hashed files | `public, max-age=31536000, immutable` | [measured], right |
| HTML | `no-cache`, revalidates by ETag | [measured], right |
| HTTP | HTTP/2, HTTP/3 advertised and used from the second step | [measured] |
| Ranges | `Range: bytes=0-99` returns **206** on images and scripts, S3 and CloudFront both | [measured] |
| Images | `image/webp`, not compressed again | [measured], right |
| Source maps | `binary/octet-stream`, uncompressed, 2.9 MB each, one year immutable, public | [measured] |
| Missing file | **403** XML, not 404 | [measured] |
| CloudFront Function | Runs on every request, including images and (later) audio ranges | from `static-site-stack.ts` |
| Old releases | Never deleted, by design; about 9 MB more each release | from `publish-site.sh` |

Notes from the docs:

- CloudFront compresses only listed types between **1,000 and 10,000,000 bytes**. No audio type and no image type except SVG is on the list, and an object with `Content-Encoding` from the origin is passed through ([AWS](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html)). So **audio and WebP are safe from double compression with no change**.
- Range requests work through CloudFront and S3, are cached, and CloudFront "might request a larger range than the client requested" ([AWS](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RangeGETs.html)). **No infrastructure change is needed to stream.** Each range request counts as a request.

## 3. Traps for the first audio release

1. **Content types.** `aws s3 sync` guesses them; Python's table on this machine gives `audio/mp4a-latm` for `.m4a` (measured; that the AWS CLI uses the same table is an inference). Firefox may refuse it. Upload audio with explicit `audio/mp4`, `audio/ogg` and `audio/mpeg`.
2. **Everything that is not HTML is immutable for a year.** Audio, cue data and the sound manifest must be imported through Vite so the name carries a hash. No fixed names.
3. **The LFS-pointer guard covers only `.webp`, `.png` and `.ico`.** A checkout without LFS would publish 130-byte text files as music. Add `.ogg`, `.m4a`, `.mp3`.
4. **The invalidation list needs no change** (HTML only).
5. **Build artefact:** CI uploads `build/dist` on every run and keeps it 7 days. Audio adds 27 MB to 11.7 MB. Dropping source maps from that artefact returns 7 MB.
6. **Never precompress or zip audio.** Nothing on this list should run on `.ogg`, `.m4a`, `.mp3`, `.webp`.

## 4. Proposals, by what players save

Savings are first-visit bytes on the wire.

| # | Change | Saves | Where | Effort | Notes |
|---|---|---|---|---|---|
| 1 | **Load the detail relief only when the map is zoomed past the point where the overview looks soft**, or when idle on a fast connection and not Data Saver | **up to 1.8 MB** (59%) for players who do not zoom; the same bytes later for the rest | App (`TerrainLayer`, asset list) | Medium | The margin layer (525 kB) can wait until the camera leaves Iberia |
| 2 | **Split music by track**, nothing until wanted | 5 to 13 MB on a first listen against one file | Build, app | Medium | `audio.md` |
| 3 | Re-encode relief | about 0.8 MB: WebP quality 75 gives 1.30, 0.34, 0.13 MB (total 1.77 against 2.53), AVIF quality 60 gives 1.22, 0.35, 0.14 MB | `maps:build` | Small | **Re-encoded from the WebP, so a slight overstatement**: 37 to 41 dB against today's file. Encode from the map source, and the owner must look. Colour and edges may shift, and visual baselines change |
| 4 | Move engine and computer player out of the entry script (load on Create Game) | about 45 to 55 kB from the start screen; the same bytes later | App (routes, store setup) | Medium | Fixes the missed budget (needs 4.5 kB) several times over. Estimate from raw size, not built |
| 5 | Validate scenarios at build time, ship checked JSON, drop Zod and the checker from the client | **about 40 kB** (all of `lazySources.js` except the registry) | Build, loader | Medium | Keep the checks in CI and dev. Coordinate with `prune-audit` |
| 6 | Strip notes and sources from the shipped scenario | about 11 kB gzip | Build | Small | Credits need only `map.attribution` |
| 7 | Upload Brotli-11 copies with `Content-Encoding: br` | about 60 kB of 490 kB (the entry goes 151 to 136) | Publish script | Small | Serves Brotli to every viewer: gzip-only clients would break, and older curl-based checks too. **Low priority** |
| 8 | Drop or replace Three.js | up to 121 kB | App | Large | The owner kept WebGL; a design decision, not asked for here |
| 9 | Merge unit icons into one sprite or script | about 14 requests, 15 kB | App | Small | Optional |
| 10 | Do not publish source maps (or publish without them in `dist`) | 0 for players, 7 MB per release in storage and artefacts | `vite.config.ts`: `sourcemap: "hidden"`, or exclude from sync | Small | The repository is public, so nothing secret is at risk |
| 11 | Serve a real 404, so a typo is not a 403 | 0 | CDK error response | Small | Do not turn it into `index.html`: a missing chunk must fail clearly |

**Preload or lazy.** Effects: fetch after the first click when idle (0.13 MB; the files are small). Music: `preload="none"`, first track on start, next track requested 30 s before the crossfade, and the element paused and its source removed when muted or hidden. Never `<link rel="preload">` audio or the detail relief.

**Data Saver.** `navigator.connection` is Chromium only, so treat it as a hint. When `saveData` is true, or `effectiveType` is `2g` or `3g`: music off until asked, effects on, detail relief only on zoom, never idle. Settings shows "Saving data".

**Not worth doing now:** a CDN change, Zstandard, image resizing at the edge, HLS, a service worker (a cache that survives releases is a new class of bug for a small game).

### Proposed budget, extending `project/budgets.json` and `check-budgets.mjs` (the owner sets the numbers)

| Budget | Now | Proposed limit |
|---|---|---|
| Entry script plus preloads, gzip | 159.42 kB | 155 kB (unchanged) |
| Start screen total, Brotli | 244 kB | 250 kB |
| Campaign start total, Brotli, before zoom | 2,815 kB | 1,200 kB (after 1 and 3) |
| Any one script, gzip | 159 kB | 160 kB |
| Any one image | 1,809 kB | 1,900 kB |
| Music total, per format | 0 | 11.5 MB Opus, 17 MB AAC |
| Any one music file | 0 | 5.5 MB |
| Effects total | 0 | 250 kB |
| Shipped `dist` without maps | 4.5 MB | 35 MB |

Add: no `.map` in the published folder, no LFS pointer, every non-HTML name hashed, each audio file of an allowed type. Run `npm run budgets:check` after `npm run build` in `verify` and in the CI build step (seconds, no new tools; Brotli from Node). It fails today by 4.4 kB, so land items 4 or 5 first or the gate blocks everyone.

## 5. Cost

[CloudFront pay-as-you-go](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/): each month **1 TB out, 10 million requests and 2 million Function runs are free, permanently**; then $0.085 a GB in North America and Europe, $0.0100 to $0.0120 per 10,000 HTTPS requests, and $0.10 per million Function runs. Fetching from S3 is free. The free amounts are shared with everything else in the account, including the personal website. AWS also sells [flat-rate plans](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/plans.html) (a free one with 1 million requests and 100 GB); not needed.

Assumptions, not measurements: each player visits 8 times a month, 3.1 MB on the first visit and 0.3 MB on repeats (5.2 MB), plus all four music files once, 11 MB (Opus) with a quarter on AAC (16 MB), so about 12.3 MB. 120 requests and Function runs.

| Monthly players | Data | Requests | Cost inside the free amounts | If nothing were free |
|---|---|---|---|---|
| 100 | 1.8 GB | 12 thousand | $0 | $0.16 |
| 1,000 | 18 GB | 120 thousand | $0 | $1.60 |
| 10,000 | 175 GB | 1.2 million | $0 | $16 |

With one 16 MB music file and today's images (21 MB a player), 10,000 players would be about 210 GB. **Money is not the reason to do this; players' data and waiting are.** About 55,000 monthly players would exhaust the free terabyte. S3 storage is under 1 GB (price not looked up). The existing setup (no WAF, no logs) has no other per-request charge that I found in `infra/`.

## 6. Who does what

| Build time (game repository) | Infrastructure (`infra/`) |
|---|---|
| Items 1, 3 to 6, 9, 10; audio encodes; budgets check | Publish script: explicit audio types, pointer guard, audio before HTML. Optional: 404 page, Function off for `/assets/*` |
| Track manifest, hashed names | Nothing needed for ranges, compression or caching |

CI needs two edits: the budget step, and the larger artefact. The production smoke test and the Linux baselines belong to the owner; items 1 and 3 and any Settings or header change alter the baselines.

## 7. Not verified

- AWS CLI's exact type for `.m4a` on GitHub's runners.
- AVIF and WebP sizes from the map's source pixels, and how they look.
- Item 4 and item 5 savings: estimated from the source map, not built.
- Phone-sized first load (measured at desktop width only), and slow networks.
- HTTP/3 for audio ranges.
- The CloudFront Function's share of cost: from the pricing page, not from a bill.
