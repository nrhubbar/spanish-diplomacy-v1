# Pruning: evidence-based inventory

Research only, nothing changed. Sizes are raw bytes / gzip on the shipped build (`vite build` run into the scratchpad). Unverified items are marked. "Other-era" = CLAUDE.md says rules live in data so other eras can reuse the engine, so I do **not** recommend deleting rule modules without the owner.

## Method
`npx knip` (27 "unused files", of which only `Placeholder.tsx` is real; `infra/`, `project/` and `src/sim/cli.ts` are false positives; 59 unused exports, 43 unused exported types, **no unused dependencies**), `tsc --noUnusedLocals --noUnusedParameters` (clean, as expected: `tsconfig` already sets both), key-by-key scan of the scenario and map JSON against every `src/main` reader, CSS class scan, asset scan, and a real build.

## Ranked: remove first (safe)
| # | What | Size | Evidence | Risk | Verdict |
|---|---|---|---|---|---|
| 1 | `note`, `sources` and `historicalNote` in the shipped scenario: 212 notes, 197 citation lists, 46 unit notes | 67.6 KB raw / **11.4 KB gzip** of the 135.8 KB / 21.4 KB scenario chunk | No screen reads them (`historicalNote`, `.basis`, `.sources` readers are only the loader, which copies them into memory: `indexScenario.ts:79-89`, `indexModular.ts:65,75`) | Low, but the loader **requires** "sources or a note" (`linkChecks.ts:30`, `subTerritoryChecks.ts:20`), so strip them in a **build step after validation**, not from the data | Remove now (build-time strip; keep the authored data) |
| 2 | `Scenario.sources` titles (38 entries) are stored in memory for no reader; 4 are cited by nothing: `spanish-memory`, `country-study-map`, `spanish-defence-human-factor`, `alpert-2013` | 6.2 KB raw in the data (included in row 1) | JSON scan: no citation | Low (delete 4 rows) | Remove now |
| 3 | Dead CSS classes: `sub-territory-focus`, `pane-actions`, `training-unit`, `order-choice` + `-description` + `-icon` + `-label`, `sub-territory-back` | 8 selectors | No string match in `src/main` or in built code paths; 31 further names are built dynamically (unverified, left alone) | Low | Remove now |
| 4 | `src/main/screens/shell/views/Placeholder.tsx` | 12 lines | knip: no importer | Low | Remove now |
| 5 | Two unused NATO icons: `engineers.svg`, `signals.svg` | 796 + 726 bytes (about 0.8 KB gzip, as two chunks) | Not in `unitSymbols`, no code reference; both ship as chunks (`engineers-*.js`, `signals-*.js`) | Low: also listed in `ATTRIBUTION.md` | Remove now |
| 6 | 59 unused exports and 43 unused exported types (knip) | ~100 lines of `export` keywords, some functions (e.g. `fatigueCost`, `weighGraded`, `territoryControlFrom`, `withdraw`) | knip list; tests may use some | Low-med: check `src/test` use first | Remove now where only the `export` keyword goes |
| 7 | Stale `TODO(m3r1-*)` comments and `MANIFEST.md` reference (`builtInSources.ts:9` names a file that does not exist) | ~10 comments | grep | None | Remove now |
| 8 | Duplicate scripts `test` and `test:unit` (identical); `personal-prod` has no reference anywhere | 2 lines | `package.json`; docs use both `test` (6 refs) and `test:unit` (3) | Low | Keep one name, drop `personal-prod` if the owner doesn't use it |

## Owner decides
| # | What | Size | Evidence | Why it's a question |
|---|---|---|---|---|
| 9 | **The old d6 combat path** (`engine/battle.ts`, `site.ts`, `standing.ts`, `meeting.ts`, `front.ts`, `combat/odds.ts` d6 parts, `BattleRoll.tsx`, `D6BattleOutcome`, `combat.table`, `combat.belowOneToOne`) | ~1,000 lines of engine and UI (upper bound: some is shared, e.g. `oddsFor`, `battleResults` `Casualties`); `combat.table` etc. ~1 KB of the scenario | Shipped scenario uses `d20-graded`; the d6 runs only in the `tiny-front` fixture (`m2-strength`) and the `onD6Dice` test helper | Other-era reuse. Tests are the big catch: `spain()` (205 uses) pins the shipped board **to the d6** (`support.ts:46`), so much of the test suite exercises a dice rule the game doesn't ship. Re-pointing them is the real cost |
| 10 | `combat` block fields that are d6-only (`table`, `belowOneToOne`, `factionModifiers`) inside the shipped scenario | ~1.2 KB | `demoralizationFactor` and `diggingIn` **are** live (`gradedValue`, `works.ts`, `BattleBasics`) | Tied to 9; schema marks them required (`coreSchema.ts`) |
| 11 | Derivable data: `subTerritoryBorders` (120 pairs) equals the `links` pairs exactly | 2.7 KB raw | JSON compare: equal sets | Dropping it needs a schema and engine change; 2 of the 120 links carry no modifiers |
| 12 | `scenario.schema.json` (166 KB on disk) and `map.schema.json` | not shipped | Not imported by the app; only `$schema` references and `spec.test.ts:43` | Keep (published docs); no bundle cost |
| 13 | `sub-territory-topology.json` (37 KB on disk) | not shipped | Read only by the map build and two tests that check `scenario.json` equals it | Keep, or generate on demand |
| 14 | `turnsPerYear` (only a type literal `24` reads it), `specVersion`, `formationKind` (copied, no reader), `historicalNote` | small | grep | Schema and spec docs mention some |
| 15 | Old design folders and images | table below | Referenced by ideation and tasks docs only | Archive, don't delete |

## Docs and large files (LFS weights)
| Folder | Files | LFS MB | Suggestion |
|---|---|---|---|
| `scripts` (map sources) | 6 | 23.1 | Keep: the map build needs them |
| `e2e/baselines` | 14 | 9.0 | Keep: owner maintains |
| `project/mockups/milestone-2-rev-4` | 3 | 7.7 | Owner decides: superseded by Rev 2 mockups |
| `milestone-3-ideation` | 55 | 7.0 | Archive: its questions are answered |
| `milestone-3-rev-2-ideation` | 36 | 5.2 | Keep until Rev 3 closes |
| `assets` | 4 | 2.5 | Ship assets |
| `m3r2-progress` | 7 | 0.8 | Archive |
Old probe test: `src/test/m3r2-probe/worksPips.test.tsx` (one file). It looks like a live test of current code; **keep unless checked** (unverified). `resolution-phase-screenshot-2026-06-29.png` (0.3 MB) is the only image at the folder root.

## Ordered plan for a pruning stream
1. Strip notes/sources at build (row 1) with a test that the shipped chunk contains no `"note"` text. Then rows 2-5, 7, 8: one small commit.
2. Knip pass (row 6): remove `export` keywords first, then truly dead functions; run full verify.
3. Ask the owner about the d6 path (row 9). If yes: re-point `spain()` to d20 first (largest, riskiest step), then delete the d6 modules and fixture ruleset, then the JSON fields and schema.
4. Archive docs last.

## Guardrails
- Run `knip` in CI with a short ignore list (`infra`, `project`, `src/sim/cli.ts`).
- A test that fails when a scenario key has no reader (the scan used here is a script, 40 lines).
- A scenario-size budget in `project/budgets.json` (for example 135 KB raw / 22 KB gzip).
- A CSS class check in the lint step.

## Part D: removing Popular Resistance (note 11)
It lives in **two** places in the data, both with id `popular-resistance`: `combat.factionModifiers` (defence 1, read only by the d6 path, `combat/odds.ts:83`) and `d20.factionModifiers` (defence 3, the one that applies in play, `d20/modifiers.ts:60`). The d20 engine ignores the `when: holds-controlled-city` field and uses its own `holdsCity` check, which **barricades also use**, so `holdsCity` stays.

- `factionModifiers` is used by **nothing else** in the shipped data: one entry per block.
- **Recommended: remove the data only** (two one-line edits: `"factionModifiers": []`), keep the mechanism for other eras. Cost under an hour plus test edits. The d6 array is required by the schema, so leave an empty array there.
- **If the mechanism goes too:** delete `ModifierCondition`, the `faction` modifier kind in `types/outcomes/battle.ts`, loader (`convert.ts`, `coreChecks.ts:57`, `systemChecks.ts:94`, `indexScenario.ts:97`, `indexModular.ts:181`), two schemas (`coreSchema.ts:104`, `systemsSchema.ts:45`), the two schema JSONs and `spec:build`. About 10 source files plus tests; larger and an other-era loss.
- **Tests that name it** (mentions): `combat.test` 6, `spec.test` 5, `engineTurn.test` 4, `ui/grades` 3, `battleFixtures` 2, `combatPresentation` 2, `engineBattles` 2, and 1 each in `combatScreens`, `outcomeText`, `partition`, `modularFixture`, `specModular`; the `tiny-front` fixture carries 1 entry. Data-only removal needs edits where a test asserts the +1 or +3 value on the Spanish board; `spec.test` checks the mechanism through a helper (which scenario it reads is unverified).
- **Player text to change:** `presentation/grades.ts` `termName` and `odds.ts` `modifierName` (both read the name from the data, so nothing to delete in data-only removal), plus the "Popular resistance +1" comment examples.
- **Barricades (-1 for any city defender) stays**, so a city is still harder to take after the change. The owner may not know the two are separate.
- **Balance effect:** in a Republic-held city the attacker's roll rises 3 (worked example: the same die moves Stalemate to Defender gives ground). This is the strongest single Republic defence bonus; the remaining city defence is barricades -1.
