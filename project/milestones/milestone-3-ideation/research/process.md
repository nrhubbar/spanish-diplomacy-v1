# Process research notes (idea 10, cluster `process`)

Owner's idea, verbatim: "10. Meta Point: review how we've been implementing these, to see if we could be using agentic programming more efficiently"

Paths are relative to the repository root. Declog ids are written as `R5 D14` (Revision 5 decision log, entry D14), `R6 D8`, `R7 D20`; tasks-document ids as `R6 P3`, `R7 I.2`.

## 1. How the project is built today (from the repository)

The pipeline, as recorded in `project/milestones/`:

1. **Brief.** The owner writes a short brief (Rev 6: "five items"; Rev 7: "five items, 18 November 2026").
2. **Research report and answers.** Rev 6 tasks cite "the research report 'Rev 6 Briefing' and the answers saved from it on 18 November 2026" (`milestone-2-rev-6-tasks.md`, Inputs). Section 1 records each answer as "Rec" or "Changed (owner's note)". Rev 7 skipped the report: "the owner judged this revision light enough to skip the interactive research report. Four open questions were answered directly" (`milestone-2-rev-7-tasks.md`, Process).
3. **Tasks document.** Decisions table, workstreams with an "Owns:" file list each, shared rules for every agent, risks, Definition of Done.
4. **Parallel workstreams.** One agent per stream, each on its own branch, git worktree, and dev-server port (R6 D3, R7 D1). An integrator (I) merges, owns `e2e/baselines/**`, and writes the decision log.
5. **Decision log (declog).** Numbered decisions, soak results, a self-scored coding-principles rubric, "Open for the owner", follow-ups.
6. **Squash to main.** One commit per revision on `main` (read-only `git log --oneline`):
   - `cf3138d` Rev 5: 166 files, +16,744 / -5,445
   - `c9465a0` Rev 6: 194 files, +15,148 / -1,506
   - `d7f3006` Rev 7: 69 files, +2,465 / -179
   - The revision and stream branches are kept (`milestone-2-rev-5/6/7`, `m2r7-a..d`); the worktrees were removed after each squash (R7 "Open for the owner").

What the repository does not have (checked):
- No `.github/` directory, so no CI of any kind. Every check runs on the agent's machine, and only when an agent or the owner runs it.
- No `CLAUDE.md`, `AGENTS.md`, or `.claude/` settings, hooks, or agent definitions. Steering lives in `project/plan.md` (1,148 lines), `project/coding-principles.md` (68 lines), and a "Shared Rules For Every Agent" section restated in each tasks document (R6 tasks section 3).
- The soak test (`src/test/soak.test.ts`, 200 games x 30 turns) runs inside the normal unit suite, so every `vitest run` plays it.

## 2. Evidence ledger

### 2.1 Red commits and the gate

- **R5 D14.** The core rewrite "touched every layer at once", so plan steps 2 to 6 "could not land as separate commits that each pass every gate"; they landed as one combined commit. The same thing happened one step earlier: the Phase 4 handoff work was folded into one combined commit `153a32c` (R5 plan, Baseline and Supersedes lines; `milestone-2-phase-4-handoff.md` asked for it to be split into six focused commits). A repeating pattern, not a one-off.
- **R5 D30.** "Two commits went in with failing checks": `ebba659` (a failing unit test and lint errors) and `1ada094` (a lint error "that a too-narrow output filter hid"). The lesson became a rule in R6 tasks section 3: "Gate on exit codes, not on grepping output."
- **R5 D63.** "Several commits in this round do not pass every check on their own": the terrain branch left baselines failing until one regeneration (D61); merge `6ac44ca` failed unit tests until `1b6a3cd`; merge `c02ba3d` failed visual tests until `306acd4`. "Anyone bisecting this branch should skip those commits." So 2 of the 3 feedback-round merges were red.
- **R5 rubric R13** dropped from a target of 5 to 4.5 because of D30 and D63.
- **R6 D8.** Baselines updated inside each merge "to keep every commit on milestone-2-rev-6 green; Rev 5 had to note commits that failed visual tests". R6 R13 (4.5): "one stream did not re-run the gate on every intermediate commit".
- **R7 D20.** Each stream merged `--no-ff`, "any fix-up was folded into that stream's merge commit, so every commit on the integration line passes lint, typecheck, and unit tests". Baselines left for one pass at the end (R7 I.2, D31).
- **R7 D34.** "Not run. The owner waived `npm run verify` from a clean checkout and the production smoke test on 18 November 2026, and asked for Revision 7 to be squashed onto `main` without them." D33: the production pan measurement after the D merge was also not run.
- **R7 rubric R13 scored 5** in the same log that records the waived verify. The rubric is self-scored by the integrator.

Takeaway: the per-merge discipline improved from Rev 5 to Rev 7, but it is enforced by prose rules that an agent may or may not follow, and the one final check was waived. Nothing independent of the agents ran on any commit.

### 2.2 Baseline policy changed every revision

- Rev 5: once at the end, after all three merges (R5 D61), which made intermediate commits red (D63).
- Rev 6: inside each merge, `--update-snapshots=changed` (R6 D8).
- Rev 7: once at the end again (R7 I.2, D31). D31 also found stale baselines: Rev 6 D64 and D65 changes "stayed within tolerance, so this is the first baseline that records them".

### 2.3 Contract first

- **R6 P1** "Contract first, then parallel workstreams" (Rec). **R6 D2** outcome keys fixed before work started so D, F, and H "share names without waiting on each other".
- **R6 D5.** "The pure combat maths moved from E to D", so "the presentation stream (F) gets real numbers as soon as D merges". D also kept the old rules running under the new ruleset name "so the game stays playable and every commit stays green until E lands".
- **R6 D17 / D27.** H wrote its own outcome key list "because D's presentation/outcomes.ts did not exist yet"; unified later. A small cost of starting a consumer before the contract landed.
- **R6 D4** two phases: phase 1 (D, A, B, C, H, G-research), phase 2 (E, F after D; G-data after E).

### 2.4 Coupling between layer-split streams

- **R6 D42.** "Data and computer player landed together": with 35 armies the old computer player won 96.5 percent of soak games before turn 4, so the data stream and the AI change had to merge as one commit.
- **R6 D52.** After E (engine) and G merged, "Strength combat with the first computer player froze every game" (200 of 200). Found only after integration; a 40-game probe isolated the cause (the AI never massed armies); it went back to G "with a small measurement budget" (D58, D60).
- **R6 D29.** A rule gap (shared territories never fight) found only at integration; new rule M27 added for the owner's review.
- **R6 D6.** G split into a research half and a data half because D was changing the schema.

Confounder: Rev 7 integrated far more smoothly, but Rev 7 was also much smaller (69 files, about 2.5k lines, 4 streams) than Rev 6 (194 files, about 15k lines, 8 streams in two phases). Size, stream count, and slicing style all changed at once, so Rev 7 alone does not prove that per-feature slices beat per-layer streams. The direct coupling evidence above (D42, D52, D17) is the stronger argument.

### 2.5 Integration overhead and conflicts

- **R7 D20 table.** 4 merges carried 9 folded fix-ups (A: D21, D22; B: D23-D25; C: D26, D27; D: D28, D29), plus D31 in the baseline commit.
- **R7 D28.** One textual conflict, in `CampaignMap.tsx`, "next to `layoutCounters`". The tasks doc had already split ownership of that one file between C and D ("C owns the `layoutCounters` call itself, so coordinate through the hand-off").
- **R7 semantic conflicts** that merged cleanly as text but broke: D27 ("Z1 also reached B's new app test ... merged cleanly as text but failed once counters were summed"), D25 (B's always-true filter after A's O5), D24 (phones could not reach B's "i" in C/A's layout). Semantic conflicts outnumbered textual ones about 3 to 1.
- **R6 integration findings**: D21 (the "i" button on the Galicia label), D38, D43, D54 (two-digit totals overflowed), D55 (an unreachable branch removed), D59 (two flows made deterministic), plus two back-merges of the integration branch into streams E and F (`bcb88bc`, `b034d2e`).

### 2.6 Wall-clock from commit timestamps (all 18 November 2026)

| Revision | Start (plan or tasks commit) | Last branch commit | Squash on main |
|---|---|---|---|
| Rev 5 | 10:22 (`05ef91b`) | 13:54 | 14:06 |
| Rev 6 | 15:18 (`a88ca0e`) | 17:47 | 18:37 |
| Rev 7 | 19:55 (`fbb2ad5`) | 21:25 (declog) | 21:25 |

Rev 7 detail: stream commits 20:01 to 20:24, merges 20:25 to 20:37, baselines 20:40, declog 21:25. Writing the declog took longer than integrating. These are commit times, not effort: they include owner interaction and anything not committed.

### 2.7 Budgets and the soak

- **R6 P3** (Changed, owner's note): "Do not spend tokens iterating on balance: run the soak test at most twice per workstream, and read only its summary line." Restated in R6 tasks section 3 and R7 tasks ("Run the soak test once and read only its summary line").
- **R7 D32.** "A ran it once and read only the summary." That worked.
- Local measurement for this note (not committed anywhere): `vitest run src/test/soak.test.ts` takes about 3 s; the whole unit suite without coverage about 7 s (483 tests); `tsc --noEmit` about 2 s; ESLint about 5 s. So the soak budget is about tokens spent reading output and iterating, not CPU. Because the soak sits inside the unit suite, "every commit passes unit tests" already runs it on every commit; the "at most twice" rule really means "do not read or act on it more than twice". R6 D59 raised test timeouts because "full jsdom flows share the CPU with the 200-game soak".
- **R6 D62.** The integrator raised the initial-chunk budget P1 from 142 to 155 kB gzip itself, and listed it for the owner. R7 tasks I.4 then said "Report an overrun; do not raise the budget." Budgets that the owner owns should be enforced by a check, not by the agent that might miss them.

### 2.8 Follow-ups that roll over

- **Files over the 200-line target** (`coding-principles` R8):
  - Rev 5: `CampaignMap.tsx` 227, `OrderBuilder.tsx` 212, `TerrainLayer.tsx` 210.
  - Rev 6: `combat.ts` 316, `CampaignMap.tsx` 230, `TerrainLayer.tsx` 210.
  - Rev 7: `state/planning.ts` 239, `CampaignMap.tsx` 236, `useMapCamera.ts` 232, plus `combat.ts` 316 and `TerrainLayer.tsx` 210.
  - Today (`wc -l`): the same five, plus `engine/types.ts` 440 and `scenarios/loader.ts` 434 (called "cohesive by nature" in R6 R8).
  - `CampaignMap.tsx` grew 227, 230, 236 across three revisions and is the file of the one Rev 7 conflict (D28). It is the obvious hotspot for Milestone 3's map work (partitions, rail, cities).
- **Manual accessibility checks** (screen reader, 200 percent zoom, Windows high contrast): open since R5 D29, again in R6 "Open for the owner" and R6 DoD item 6, again in R7 R12 and "Open for the owner". An agent cannot do them; they need a person or an explicit deferral.
- **OD-3 historical sign-off:** open since R5 D38 and D39, again in R6 D30 and R7.
- **Initial chunk** (R6 D62, R7 D35): 150.5 kB of 155 kB, "defer the engine out of the initial chunk" carried twice.
- **R6 rules D29, D31, D32** still "need confirmation" in R7.
- **Sanitizer merge** (R6 D15) carried in R6 and R7 follow-ups.

### 2.9 Worktrees and ports

- R5 D3 (one sibling worktree), R6 D3 (`../sd-m2r6-<letter>`, ports `52<nn>`), R7 D1 (table of four worktrees and ports 5181 to 5185). Set up by hand each time; the owner's memory note asks for worktree removal after each squash.
- R5 D41: a stale `dist/` in the main checkout was left alone because "another agent is using" it. Shared checkouts are a real hazard; worktrees solved it.

### 2.10 Things that worked and should be kept

- Owner decisions captured as a table with "Rec" or "Changed" (R6 tasks section 1). It made the answers traceable and fed the tasks directly.
- Contract first (R6 P1, D2, D5).
- "Owns:" file lists per stream, with a rule to report edits outside ownership (R6 and R7 tasks).
- The fast visual loop `npm run e2e:capture` (R5 D26), about 6 s per pass.
- Soak budget with summary-only reading (R6 P3, R7 D32).
- Fix-ups folded into merge commits so the integration line stays green (R7 D20).
- "Integrator design, after advisor review" (R7 O5): a second opinion before committing to a design.

## 3. Current practice (web research)

Web access worked. About 18 fetches and searches were used.

**Anthropic, Claude Code best practices** ([docs](https://code.claude.com/docs/en/best-practices), raw text read):
- Two kinds of instruction: non-deterministic (prompt, CLAUDE.md, skills: "there's no *guarantee* that it'll follow your instructions") and deterministic (hooks, deny rules: "Claude Code applies this every time"). For "When it's done", the deterministic column lists "Tests, typecheck, a `Stop` hook, CI".
- "If you keep adding emphasis to a `CLAUDE.md` line and Claude still misses it, that's a sign the line belongs in a hook."
- "Keep CLAUDE.md short": it is loaded into every session; it should hold the exact test, typecheck, and lint commands and decisions not in the repo; the memory guide "recommends staying under 200" lines. "Describe your architecture and file layout in `CLAUDE.md`" is listed under old advice to stop following, because "Claude reads the repo itself".
- "Give Claude a check to run": a Stop hook that exits 2 sends Claude back to work until the typecheck passes.
- Independent review: "`/code-review` reviews the diff in a fresh subagent that never saw your conversation. It isn't swayed by the reasoning that produced the code." Review against a spec: "use a subagent to review the rate limiter diff against SPEC.md ... report gaps that affect correctness and skip style", with the warning "A reviewer that's asked to find problems will always find *something*."
- A read-only reviewer as a custom subagent with `tools: Read, Grep, Glob`.
- Subagent costs: "What they cost you is mostly tokens"; "Handing the same task to a subagent doesn't make the answer any better. A fresh reviewer does help".
- Unattended runs: five questions (what done looks like, can it check its own work, what it may touch, what stops it, who signs off). "Give it a cap on turns or spend, and have a person approve the result at the end."
- Parallel sessions: `claude -w <name>` starts a session in a new worktree; `.worktreeinclude` copies gitignored files; subagent worktrees disappear when unchanged.
- Interview-first specs: "Interview me until you could write the spec, then write it to SPEC.md", then "start a fresh session to build from it". This is what the ideation report plus Q&A already does.
- Test-first prompt example: "write a failing test that reproduces it, then fix it".

**Anthropic, multi-agent research system** ([engineering blog](https://www.anthropic.com/engineering/multi-agent-research-system), summarised by the fetch tool, so paraphrased): agents use about 4 times the tokens of chat and multi-agent systems about 15 times; multi-agent beat single-agent by 90.2 percent on their research eval; it fits heavily parallel work, and coding is a weaker fit because most coding tasks have fewer truly parallel parts and agents coordinate poorly in real time; each subagent needs an objective, an output format, tool guidance, and clear task boundaries; scale effort to the task; subagents should write results to files and pass back references; small evals (about 20 cases) early.

**Anthropic, effective harnesses for long-running agents** ([engineering blog](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), paraphrased): an initializer session plus incremental coding sessions; a JSON feature list where every item starts failing and agents only flip its status; one feature at a time to stop over-reach; commit and write a progress file so the next session can recover; end-to-end testing "as a human user would"; failure modes are one-shotting too much and declaring victory early.

**Claude Code agent teams** ([docs](https://code.claude.com/docs/en/agent-teams), raw text): experimental; "For sequential tasks, same-file edits, or work with many dependencies, a single session or subagents are more effective"; "Two teammates editing the same file leads to overwrites. Break the work so each teammate owns a different set of files"; "Start with 3-5 teammates"; quality gates through `TaskCompleted` and `TeammateIdle` hooks; token costs scale linearly with teammates.

**Claude Code dynamic workflows** ([docs](https://code.claude.com/docs/en/workflows), raw text): "A workflow moves the plan into code"; it can "have independent agents adversarially review each other's findings"; up to 16 concurrent agents by default; resumable; "No mid-run user input ... For sign-off between stages, run each stage as its own workflow".

**Run agents in parallel** ([docs](https://code.claude.com/docs/en/agents), raw text): "Agent teams don't isolate teammates in worktrees, so partition the work so each teammate owns a different set of files"; "Running several sessions or subagents at once multiplies token usage."

**Claude Code GitHub Actions** ([docs](https://code.claude.com/docs/en/github-actions), raw text): `anthropics/claude-code-action@v1`, `/install-github-app`; costs are GitHub Actions minutes plus API tokens; "Keep your `CLAUDE.md` concise, since Claude reads it on every run"; set `--max-turns`. Useful later; the first need is a plain CI job with no model in it.

**GitHub Actions billing** ([GitHub docs](https://docs.github.com/en/billing/concepts/product-billing/github-actions), summarised): GitHub Free includes 12 USD of compute a month, stated as money not minutes; standard hosted runners are free for public repositories. About 2,000 Linux minutes is my own division at 0.006 USD a minute, not a figure on the page. I did not check whether this repository is public.

**Spec-driven development.**
- GitHub's [spec-kit announcement](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) (2 September 2025, paraphrased): four phases, Specify, Plan, Tasks, Implement, with checkpoints; specs become the shared source of truth; tasks are small reviewable chunks implemented one by one or in parallel; most useful for feature work in existing systems.
- [Kiro specs](https://kiro.dev/docs/specs/) (paraphrased): `requirements.md`, `design.md`, `tasks.md`; when running all tasks Kiro builds a dependency graph and runs independent tasks in waves. Rev 6's two phases (D4) are the same idea done by hand.
- Birgitta Boeckeler, [Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) (martinfowler.com, October 2025, paraphrased): spec-first vs spec-anchored vs spec-as-source; heavy workflows felt like overkill for small changes; many repetitive markdown files are a review burden ("rather review code"); agents still ignored specs at times; one fixed workflow does not fit every problem size. This supports keeping a light path for small revisions, as Rev 7 did.

**Practitioners and research.**
- Simon Willison, [Embracing the parallel coding agent lifestyle](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/) (October 2025, paraphrased): parallel agents suit research, proofs of concept, small maintenance, and well-specified directed work; the natural bottleneck is how fast he can review the results; he lands one significant change at a time.
- DORA, [Working in small batches](https://dora.dev/capabilities/working-in-small-batches/) (paraphrased): small batches shorten feedback and make problems easier to triage; slice features so each can be finished in a week or less; small batches act as a safety net for AI adoption because AI can generate large changes that are hard to review.
- DORA [2025 report page](https://dora.dev/research/2025/dora-report/) (paraphrased): AI acts as an amplifier of an organisation's existing strengths and weaknesses.

**From recall, unverified:**
- Playwright screenshot baselines rendered on macOS usually differ on Linux CI runners (fonts, anti-aliasing, software WebGL), so a CI job should not run `e2e/visual.spec.ts` against macOS baselines.
- `git bisect skip` exists for exactly the commits R5 D63 lists; a green-per-commit line makes it unnecessary.

## 4. Assumptions

- **A-PROC-1.** The pipeline stays: research report, owner Q&A, tasks doc, parallel streams, integrator, declog, squash. Proposals tune it rather than replace it.
- **A-PROC-2.** The owner is one person with limited review time, often reviewing in the morning (this run itself). Review is the bottleneck (Willison), so proposals should reduce what the owner must read, not add parallelism.
- **A-PROC-3.** GitHub Actions is available to the repository (it has a GitHub remote). Whether minutes are free depends on whether the repo is public, which I did not check.
- **A-PROC-4.** CI time estimates (about 2 to 4 minutes a run including `npm ci` and runner start) are guesses scaled from local timings, not measurements.
- **A-PROC-5.** Milestone 3 will touch the hotspot files: `engine/types.ts`, `scenarios/loader.ts`, the scenario schema, `CampaignMap.tsx`, and `state/planning.ts`, for nearly every idea (recruitment, economy, cities, rail, partitions, weather). That is why a contract stream and a file-ownership table matter more in M3 than they did in Rev 7.
- **A-PROC-6.** The harness idea (11) will replace the in-suite soak with a headless runner; this note only asks that its output be a one-line machine-readable summary and that it can act as a gate.

## 5. Options and tradeoffs

| Option | What it is | Tradeoffs | Cost (rough) |
|---|---|---|---|
| A. Guardrails only | Add a CI job (lint, typecheck, unit incl. soak, spec:check, build) on pushes to integration branches and PRs to `main`; a short `CLAUDE.md`; two or three hooks. Keep everything else. | Cheapest; ends red commits and gives a check that still runs when the local verify is waived. Does not touch the coupling or rolling-debt problems. | About an hour to set up; 2 to 4 CI minutes per push (guess). |
| B. Gated slices (recommended) | A, plus: a contract stream first for every revision; streams cut per idea (vertical slices) on top of the contract; at most 3 or 4 streams; a file-ownership table with hotspots owned by the contract stream; soak and harness as a merge gate with a one-line summary; a read-only reviewer subagent per stream against the tasks decisions; stored answers feeding the tasks doc; a debt slot or explicit drop for rolling follow-ups. | Tackles every problem in the ledger. Adds a reviewer pass (tokens) and a contract phase (some serial time). | A plus about a day of process setup spread over the first M3 revision; about one extra agent run per stream for review (estimate). |
| C. Full orchestration | B, plus scripted multi-agent workflows (dynamic workflows or agent teams), cloud or background runs, spec-kit or Kiro style specs per idea. | Most automation and overnight throughput. Experimental features; multiplies tokens; heavier specs add review burden (Boeckeler); coding parallelises less well than research (Anthropic). Worth it only once A and B are stable. | High token cost; learning time. |
| D. Single agent, sequential | One agent does the revision step by step, as Rev 5's first pass did. | No integration conflicts; slowest; Rev 5 still produced red commits (D30) and one combined commit (D14), so it does not fix the gate problem by itself. | Low tokens, long wall-clock. |

## 6. How each option maps onto the repository

- **CI gate:** new `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm run typecheck`, `npx vitest run` (with coverage thresholds as today), `npm run spec:check`, `npm run build`. Optional second job: `playwright test --project=chromium --grep-invert @capture` excluding `e2e/visual.spec.ts`. Visual baselines stay with the integrator locally (R6 and R7 tasks already say only I regenerates them). Branch protection on `main` requiring the job, and squash through a pull request so the squash has a check and a record.
- **CLAUDE.md:** under about 60 lines: the commands (`npm run verify`, single test file, `e2e:capture` with `E2E_PORT`), ports convention, "gate on exit codes", baselines rule, ASCII rule, where decisions live (`project/`). The "Shared Rules For Every Agent" sections in each tasks doc then shrink to the revision-specific rules.
- **Hooks (`.claude/settings.json`):** a `Stop` hook in stream worktrees running `npm run typecheck && npm run lint` (fast, about 7 s locally); a `PreToolUse` hook that blocks edits to `e2e/baselines/**` except in the integrator's worktree. Keep the set small, as the best-practices page warns.
- **Contract stream:** for M3 it owns `engine/types.ts`, `scenarios/schema/*`, `scenarios/loader.ts`, `project/specs/scenario-package.md`, the new ruleset id (mismatch d), the outcome and resource keys, and pure functions (cost tables, yield maths, weather odds) with tests, the way R6 D5 moved combat maths into D.
- **Ownership table:** a section in the tasks doc listing every file a revision is expected to touch and its single owner; a short script (or the integrator) compares `git diff --name-only <base>...<stream>` with the table at hand-off. Split `CampaignMap.tsx` (236 lines) and `state/planning.ts` (239) before the parallel phase, since every M3 map idea will touch them.
- **Harness gate:** move the soak out of `src/test/` into the harness (idea 11), with `npm run soak` printing one JSON line (games, freezes, decided, wins by faction, early wins); CI or the integrator checks the bands. Owner-owned budgets (freeze rate, chunk size) live in one file the gate reads, so an agent cannot raise them silently (R6 D62).
- **Reviewer:** `.claude/agents/reviewer.md` with `tools: Read, Grep, Glob`, prompted to compare a stream's diff with the tasks decisions it owns and "report gaps that affect correctness and skip style". Run once per stream before hand-off.
- **Ideation to tasks:** this report already stores questions as JSON (`*.questions.json`); save the owner's answers as JSON next to it and generate the tasks doc's section 1 table ("Rec"/"Changed") from them. Keep Rev 7's light path (a few direct questions) for small revisions.

## 7. Recommendation

Option B, adopted in order of cost: the CI gate and a short `CLAUDE.md` first (an hour, removes the red-commit class of problem), then the contract stream and ownership table (they matter most for M3 because nearly every idea touches the same schema and map files), then the harness gate and a reviewer subagent. Cap parallel streams at 3 or 4. Defer agent teams, dynamic workflows, and cloud runs until the gates exist.

## 8. Draft questions (see `process.questions.json`)

1. CI gate scope.
2. Final checks when the owner waives the local verify.
3. How to slice M3 streams.
4. How many streams at once.
5. Independent reviewer per stream.
6. Rolling follow-ups.
7. Ideation flow and answer storage.
8. CLAUDE.md plus hooks.
