# Code audit: principles, separation of concerns and multiplayer readiness

Audited: `main` at `d1bfa81`, 2026-11-24. The unmerged `m3r4` branch (`5ca3211`, 71 commits ahead) was compared by count where noted.
Sources of the rules: `CLAUDE.md` and `project/coding-principles.md`. Paths below are under `src/main/` unless they start with another folder.

Counts marked (h) come from a heuristic scan: string literals of three or more words, outside comments and thrown errors. They include a few false positives and are for tracking progress, not exact totals.

## 1. Summary

**Are we doing too much markup in the stateless files? No. The problem is English and wording decisions, not markup.**

- There is no JSX or HTML in `engine/`, `ai/`, `scenarios/`, `state/` or `presentation/`. SVG is built as strings in `map/markup.ts` and `assets/outcomes/`, which are client-only. `presentation/outcomeArt.ts` passes that SVG through, and `presentation/style.ts` imports a React type.
- Ten components inline that SVG through 14 `dangerouslySetInnerHTML` uses. All of it is bundled art, so it is safe today. Outcome art goes through an allowlist sanitizer, the map geometry has scripts and event handlers stripped, and unit symbols (`prepareSymbol`) are not sanitized. Keep player-supplied text, such as player or game names, out of these paths online.
- `engine/` holds about 98 (h) player-facing sentences and `state/` about 47 (h). `presentation/text.ts` says "The engine itself produces no prose", which is not true.
- Some of that English is stored in turn outcomes and game state, so a cloud service would save it into game records.
- Because refusals are English, other code has to re-derive or compare them. `state/planning/recruitment.ts` re-implements the engine's Replenish checks to get shorter wording (`replenishSkipReason`), and line 195 branches on a sentence.
- Components are mostly thin. The exception is 27 of 114 that call engine rule functions directly. That is a tidiness issue and does not block multiplayer.

**The engine is in good shape to move to the cloud. The layer around it is not.** `resolveTurn` is pure, has no outside dependencies and survives a JSON round trip. But the turn service runs inside Redux reducers and trusts whoever calls it, and hidden information is filtered on the client. Four problems were reproduced by running them (section 2).

Gates on this commit: lint and typecheck clean; 1756 tests in 137 files pass; coverage is 95.4% branches, 99.3% functions, 99.6% lines, 98.9% statements. Build and Playwright were not run.

## 2. Reproduced problems

None can be exploited in today's hot-seat game, where the only input is our own UI. Each would be serious on a server.

| # | Problem | What happened when run | Cause |
|---|---|---|---|
| S1 | A player can order another player's units | Faction A submitted a Move carrying B's `factionId`. `validateSubmission` returned `ok`, and `resolveTurn` moved B's unit. A forged Disband removed the unit. | `engine/validation.ts:36-61` compares the submission's faction with the argument but never each order's. `state/coordinator.ts` `lockSubmission` passes the submission's own faction as the argument, so that check always passes. |
| S2 | A player can destroy another player's units | A repeated B's valid Move. Both copies became "ordered twice", so the unit was disbanded. | S1, plus the rule that an impossible move disbands its unit (`engine/orders.ts` `partitionOrders`). Closing S1 closes this. |
| S3 | Malformed orders crash or leak | `null` throws. `kind: "constructor"` made `validateSubmission` return the hook context itself, which holds the scenario and the whole unfiltered state. | Orders are never parsed at runtime. `engine/hooks.ts` `hookedValidateOrder` looks up `validateOrder[order.kind]` without an own-property check. |
| S4 | Players can predict every die | `visibleSession` returned the game seed to a human player. Removing it is not enough: a one-thread script recovered a 32-bit seed from 12 simulated d20 rolls in 54 seconds, using the game's own derivation. The weather roll (`GameState.weather.roll`) and battle die (`BattleOutcome.die`) are public data. The weather die alone, one a turn, should be enough within about 8 turns (arithmetic, not run). | `state/visible.ts` spreads `...game`. The seed is 32 bits from `Math.random` (`state/gameSlice.ts`), and `engine/random.ts` derives every stream, the computer player's included, from it. |

## 3. Rubric

Grades: **Meets**, **Partial**, **Fails**. "MP" means it blocks server-side turns.

### A. Our own principles

| Id | Principle | Grade | MP | Evidence | Done when |
|---|---|---|---|---|---|
| A1 | Engine is pure and deterministic | Meets | - | No `Math.random`, clocks, browser APIs or locale calls in `engine/` or `ai/`. Only identity-keyed `WeakMap` memos are kept between calls. | Stays at 0; engine compiles without DOM types |
| A2 | Engine imports no app layer | Meets | - | No imports out of `engine/`. `ai/` imports only `engine/`. ESLint enforces it. | Same fence on every layer (A3) |
| A3 | Layers have one direction | Partial | - | Wrong-way imports: `state -> map` (2), `state -> audio` (1), `state -> presentation` (11), `map -> screens` (2), `map -> state` (1), an `assets <-> presentation` cycle, and `main.tsx -> src/test`. ESLint fences only `engine/` and `ai/`. One `tsconfig` gives every layer DOM types. | 0 wrong-way imports, enforced by lint |
| A4 | Engine explains in data, not prose | Fails | Yes | 98 (h) sentences in `engine/`. `reason: string` in seven places under `types/outcomes/`: `moves.ts:8,45,55`, `recruitment.ts:38,58`, `economy.ts:50`, `air.ts:63`. Unit names such as "Truck column No. 1" are stored in `GameState.raised`. | 0 sentences in `engine/`; outcomes hold codes and parameters |
| A5 | State holds intent, presentation holds words | Fails | - | 47 (h) sentences in `state/`, and 56 (h) on `m3r4`, so it is growing. `Draft.feedback` is an English string. `recruitment.ts:195` compares a sentence. | 0 sentences in `state/planning/`; feedback is a typed code |
| A6 | Components only render and take input | Partial | - | 27 of 114 components call engine rules. Heaviest: `SiteCard` (4 modules), `TerritoryIncomeChip` (3), `RecruitTab` and `RailLayer` (2). About 134 (h) sentences in `.tsx`. | Rule queries go through view models in `presentation/` |
| A7 | One copy of each rule | Partial | - | `state/planning/air.ts` `raidPreview` re-implements the raid roll and its 1-20 clamp from `engine/air/missions.ts:70`. `replenishSkipReason` re-implements `replenishProblem`. | Both call the engine |
| A8 | Trust data past the loader | Partial | - | 33 (h) `?.name ?? id` fallbacks in engine, state, presentation and screens, instead of `require*`. These are where an internal id could reach a player. | 0 fallbacks to an id |
| A9 | Rules and numbers are scenario data | Partial | - | No scenario ids in code. Exceptions: `?? 2` Motor range in `engine/network/reach.ts:83`, the d20 as scattered literals (`weather.ts`, `d20/rules.ts`, `air/airBattle.ts`, `air/missions.ts`), double time on turn 1 in `timerSlice.ts`, and English unit words in `presentation/text.ts` `unitDesignation`. | One named d20 constant; the others in data |
| A10 | Computer player can use every order | Meets | - | Planners exist for all 8 order kinds and link works. It plans on `viewFor`, so it cannot cheat. | Still true for each new kind (a test per kind was not checked here) |
| A11 | One routing point; screens do not navigate after state changes | Meets | - | `SessionGuard`. The three `useNavigate` uses are menu links. | - |
| A12 | Type safety and tests | Meets | - | 0 `as any`, 0 `ts-ignore`, 1 `as unknown as`, and 3 `eslint-disable`, each with a reason. Coverage above the gate. | - |
| A13 | Docs agree with the code | Partial | - | Principles say 90% coverage; the gate is 93/92. `plan.md` says Firebase; `infra/` is AWS. `text.ts` says the engine has no prose. | Corrected |

### B. Multiplayer readiness

| Id | Requirement | Grade | Evidence | Done when |
|---|---|---|---|---|
| B1 | Every submission is checked against its sender | Fails | S1, S2 | Forged-order tests fail closed |
| B2 | Untrusted input is parsed once, at the boundary | Fails | S3. No runtime schema for orders, and no cap on orders or legs. | Zod submission schema with limits |
| B3 | Submissions name their game and turn, and locking is safe to retry | Fails | `PlayerSubmission` has neither, so a late order can land in the next turn. `lockSubmission` overwrites an existing lock. `timedOut` comes from the client. `resolveTurn` accepts two submissions from one faction. | Stale and repeated submissions are refused or ignored by test |
| B4 | Secrets never reach a client | Fails | S4. `viewFor` and `visibleSession` start from `...state` and `...game`, so a new private field is public by default. The store holds the full state and every locked order. Screens read `game.seed` (`BattleReport`, `LastTurnView`, `TimerChip`). | The client receives a `PlayerView` built field by field |
| B5 | Dice cannot be predicted | Fails | S4 | Server-side secret of at least 128 bits |
| B6 | Turn service runs without React or Redux | Partial | `state/coordinator.ts` is pure and the sim already runs it in Node, but it lives in `state/`, imports session types with UI drafts, and runs synchronously inside `startGame`, `endTurn` and `startNextTurn`. | Own layer, built for client and server |
| B7 | Players plan at the same time | Fails | `advance` returns the first unlocked human as a single `planning` or `handoff` session. Online needs all humans planning at once, so hand-off must be a hot-seat concern only. | Service knows locks, not whose screen it is |
| B8 | Server owns the clock | Fails | `timerSlice` runs in the browser and submits on zero. | Deadline stored by the server |
| B9 | State is serializable | Meets | 8 computer-played turns, with the game passed through JSON every turn, matched an uninterrupted game exactly. `Map`s are only in the scenario index. | Round-trip test in the suite |
| B10 | Games survive upgrades | Fails | `GameRecord` has no schema, rules or scenario version. Nothing is persisted today. | Versions recorded and pinned per game |
| B11 | Records stay small | Partial | After 8 turns the record was 736 KB: 690 KB of history (about 86 KB a turn) and 39 KB of state. Each outcome list is stored up to 5 times (all, each faction, shared). | Outcomes stored once per turn, projected on read |
| B12 | Scenario loads on a server | Partial | `registry.ts` takes plain objects, but the built-in sources use Vite's `import.meta.glob` and rules cannot load without the map package. The sim works around this by bundling with stubbed art. | Rules load from JSON without the map |

Totals: section A has 5 Meets, 6 Partial and 2 Fails. Section B has 1 Meets, 3 Partial and 8 Fails.

## 4. Target shape

```
engine      rules and types; codes, no words        no DOM
ai          plans orders                            -> engine
scenarios   schema and loader (rules apart from map) -> engine
game (new)  submission schema, locks, turn service,
            PlayerView projection, history          -> engine, ai, scenarios
presentation  codes and state -> words, view models -> engine types and queries, PlayerView
state       drafts, panes, client cache             -> engine, game types
map, components, screens, audio                     -> state, presentation
server (new)  auth, storage, deadlines              -> game
```

The client keeps the engine, for odds and legal moves on its own view. It loses the authority to resolve turns. Screens use one `GameClient` interface with two hosts: local (hot-seat, the same service in the browser) and remote. Hot-seat stays trust-based because the device holds everything.

## 5. Plan

S, M and L are relative sizes. Of the files phases 1 and 2 edit (coordinator, visibility, history, validation, hooks, order types, dice, battle text, timer chip, battle report), `m3r4` changes only `gameSlice.ts` (28 lines) and `session.ts` (11). Those phases can start before it lands, with a small merge in those two files; leave the seed's removal from them until last. `m3r4` also rewrites `state/planning/` and parts of `presentation/`, so phases 3 to 5 wait for it.

**Phase 0: guardrails (S).** Rubric: A3, A13.
- Add failing tests for S1 to S4, plus the JSON round trip (B9).
- Add ESLint fences per layer, listing today's violations so the list can only shrink.
- Add a `tsconfig` without DOM types for `engine/`, `ai/` and later `game/`.
- Correct the stale docs.

**Phase 1: trust boundary (S-M).** Rubric: B1, B2, B3.
- Refuse any order whose `factionId` is not the authenticated sender's. Refuse two submissions from one faction.
- Parse submissions with Zod, with limits on orders and legs. Use own-property lookups for order kinds.
- Add `gameId` and `turnNumber` to submissions. Make locking idempotent. Derive `timedOut` on the service side.
- Exit: S1 to S3 tests pass.

**Phase 2: secrets (M).** Rubric: B4, B5.
- Pass a roll source into `resolveTurn` and `beforePlanning` instead of `seed: number`. The sim and tests keep the current 32-bit source, so their numbers do not move. Online games use a 128-bit server secret and a keyed hash (such as HMAC-SHA-256) per stream.
- Replace `viewFor` and `visibleSession` with a `PlayerView` built field by field, and a test that fails when a new state field has no visibility decision. `privacyOf` already does this for outcomes.
- Key battle flavor lines and the timer on a public game id, not the seed.
- Exit: S4 test passes; no `seed` in any client type.

**Land `m3r4`.**

**Phase 3: game service (M).** Rubric: B6, B7, B10, B11, B12.
- Move the coordinator, history and projection to `src/main/game/`. Split `GameRecord` from `Session` and `Draft`.
- Commands: create, submit, resolve, view. The service reports which factions are locked; hot-seat hand-off moves to the local host.
- Store outcomes once per turn. Record schema, rules and scenario versions.
- Load scenario rules without the map or Vite.
- Exit: the sim uses only `game/`, and a Node test plays a full game with no DOM.

**Phase 4: codes instead of words (L).** Rubric: A4, A5, A7, A8.
- Replace `reason: string` with a `Refusal` union of code and parameters. `presentation/refusals.ts` turns it into text.
- Go module by module: movement and network, recruitment, economy, air, partition. `Draft.feedback` follows.
- Store a raised unit's type and serial, and build its name in `presentation/`.
- Delete `replenishSkipReason`'s copy of the rules, `raidPreview`'s copy of the roll, and the `?? id` fallbacks.
- About 111 (h) test lines assert refusal or feedback text. Move them to codes, and keep one text test per code.
- Exit: 0 sentences in `engine/` and `state/planning/`, enforced by a lint rule.

**Phase 5: view cleanup (M, can run beside phase 6).** Rubric: A3, A6, A9.
- Move rule queries out of the 27 components, heaviest first. Move `SiteIcons`, `layerChoice`, the map view types and the test fixtures import to fix the wrong-way imports.
- Exit: the lint violation list is empty.

**Phase 6: online host (L).** Rubric: B8, plus sign-in, storage, deadlines and notifications.
- Design it after decisions 1 to 4 below. Server: check sender, parse, lock in one conditional write, resolve once when all are locked or the deadline passes, and return a `PlayerView`.
- Exit: two browsers finish a game, and the network traffic contains no seed, hidden balance or unrevealed order.

Suggested order if time is short: 0, 1, 2 and 3 are required for online play. Phase 4 should land before the first online game is saved, or old records will hold English text. Phase 5 can wait.

## 6. Decisions (owner, 2026-11-24)

1. AWS serverless: Lambda and Cognito, Google sign-in, an allow list of player emails, and lobbies. The design review replaced AppSync with API Gateway (`multiplayer-design.html`) and parked the cloud work.
2. Phases 0 to 5 go ahead now. Rev 4 landed first, so they are built on it (`7ebaff5`).
3. An impossible order is refused at submission. Orders are saved as the player changes them; a turn resolves when everyone has ended or time runs out, on what was last saved. Computer players run in the cloud.
4. A game has a seed, which a player may give at creation. It is discoverable only once the game has ended.
5. Local games use the same architecture.

This replaced phase 1's "make locking idempotent" with whole-set saves, and brought the server-owned clock (B8) forward into the game service.

## 7. After phases 0 to 5 (Rev 6)

| Id | Was | Now | Evidence |
|---|---|---|---|
| A3 layers | Partial | Meets, one exception | Fences in `eslint.config.js` for every layer, no exceptions listed; `tsconfig.core.json` compiles the server layers without browser types. `main.tsx` still loads test fixtures in e2e mode. |
| A4, A5 words | Fails | Meets | 0 sentences in `engine`, `ai`, `game`, `state` (were about 98 and 56); lint rule `noSentences`. |
| A6 components | Partial | Meets | 0 of the components call engine rules (were 27); lint rule, no exceptions. |
| A7 one copy | Partial | Meets | Raid odds and Replenish reasons come from the engine. |
| A8 trust the loader | Partial | Partial | 20 `?.name ??` fallbacks left, from 33 (h) counted more narrowly; about 13 tests assert them on made-up ids. |
| A9 data | Partial | Partial | The d20 is named once and Motor range comes from data. Double time on turn 1 (`game/clock.ts`) and the unit words in `unitDesignation` are still code. |
| A13 docs | Partial | Meets | Principles and plan corrected. |
| B1-B5 trust and secrets | Fails | Meets | S1 to S4 are tests in `src/test/game/`. Dice are HMAC-SHA-256 streams of a 128-bit seed, or of the player's own. |
| B6, B7 service | Partial, Fails | Meets | `src/main/game/`; Redux keeps drafts and the last view. |
| B8 clock | Fails | Meets in the service | Nothing wakes the in-browser host by itself; the cloud needs a scheduler. |
| B10 versions | Fails | Partial | Recorded in the game; nothing checks them yet. |
| B11 size | Partial | Meets | Each outcome is kept once. |
| B12 loading | Partial | Meets | `loadRules` needs no map. |

Behavior: `src/test/golden.test.ts` pins 30 computer-played turns, their report lines and 196 refusal sentences, recorded on Rev 5 (the balance) without any of this work. It passes with its fixture unchanged, so numeric-seed replays match Rev 5. The shipped game's own dice differ from Rev 4 for the same number typed as a seed, by design.

Left: the remaining fallbacks (A8), A9, refusals the player is not told in words (`wrong-turn`, `turn-ended`, `game-ended`; the host sends the current view instead), and a screen for waiting on other players (phase 6).

## 8. Not covered

Build, Playwright, sims, accessibility, styles, `infra/` security and the correctness of individual game rules. `src/sim/` was read only for its imports. Server design was not evaluated beyond what the code allows.
