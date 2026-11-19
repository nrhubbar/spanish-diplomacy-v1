<!-- idea:10 -->
## Idea 10: How we build with agents

### Summary
Review how Milestone 2 was built by AI agents (research report, Q&A, tasks doc, parallel worktree streams, integrator, decision log) and find ways to use agents more efficiently in Milestone 3.

### Findings
What the decision logs show (ids are revision plus entry, for example R5 D30):

- **Red commits, and no independent check.** R5 D30: two commits landed with failing checks, one because "a too-narrow output filter hid" a lint error. R5 D63: two of three feedback merges failed tests until a follow-up commit, and the log says to skip those commits when bisecting. R5 D14 and the Phase 4 handoff each ended in one combined commit. Rev 6 and 7 kept the integration line green by folding fix-ups into merges (R6 D8, R7 D20). But in R7 D34 the owner waived the final verify and production smoke, and the repository has no `.github/` CI, so nothing outside the agents ever checked a commit.
- **Contract first worked.** R6 D5 moved the pure combat maths into the contract stream, "so the presentation stream (F) gets real numbers as soon as D merges". Where the contract was late, R6 D17 shows a duplicate key list.
- **Layer-split streams were coupled.** In R6 D42, data and the computer player had to land together. In R6 D52, the freeze of 200 of 200 games appeared only after the merge. Rev 7's four per-feature streams merged in about 15 minutes, with one textual conflict (R7 D28, `CampaignMap.tsx`) and about three semantic ones (D24, D25, D27). Rev 7 was also six times smaller, so this comparison is confounded.
- **Budgets and debt drift.** Raising budgets: the soak budget (R6 P3, "read only its summary line") held in R7 D32, but the integrator raised its own chunk budget in R6 D62. Rolling follow-ups: files over 200 lines grew from 3 to 5 across three revisions (`CampaignMap.tsx` went 227, 230, 236), and manual accessibility checks and OD-3 sign-off have rolled over since Rev 5.

Current practice:
- Anthropic separates instructions that an agent may skip (CLAUDE.md, prompts) from enforced ones ("Tests, typecheck, a `Stop` hook, CI"). It advises a short CLAUDE.md (under 200 lines) and a fresh reviewer subagent that "isn't swayed by the reasoning that produced the code" ([Claude Code best practices](https://code.claude.com/docs/en/best-practices)).
- Anthropic's own multi-agent system used about 15 times the tokens of chat, and the post notes that coding has fewer truly parallel tasks than research ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)). Agent teams docs say same-file edits overwrite each other, so give each worker its own files, and start with 3 to 5 teammates ([agent teams](https://code.claude.com/docs/en/agent-teams)).
- Spec tools (spec-kit, Kiro) formalise our report, tasks, and waves ([GitHub](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/), [Kiro](https://kiro.dev/docs/specs/)). Critics find them heavy for small changes ([Boeckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).
- Review is the bottleneck ([Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)), and small batches are a safety net for AI-written changes ([DORA](https://dora.dev/capabilities/working-in-small-batches/)).

### Fit with today's engine
- **New files, no game code.**
  - `.github/workflows/ci.yml`: lint, typecheck, unit tests (the soak already runs inside them), `spec:check`, and build. Optional Chromium e2e, without `e2e/visual.spec.ts`, because macOS baselines likely differ on Linux runners (from recall, unverified).
  - A short `CLAUDE.md`.
  - `.claude/settings.json` with a `Stop` hook running typecheck and lint, and a hook that blocks edits to `e2e/baselines/**` outside the integrator.
  - `.claude/agents/reviewer.md`, a read-only reviewer.
- **Cost.** Locally, lint takes about 5 s, typecheck about 2 s, and the unit suite about 7 s (483 tests), so a CI run is probably 2 to 4 minutes including `npm ci` (a guess). GitHub Free includes 12 USD of compute a month, and public repositories run free ([GitHub](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
- **Contract stream for M3.** It owns:
  - `engine/types.ts` (440 lines) and `scenarios/loader.ts` (434);
  - the schema files and `project/specs/scenario-package.md`;
  - the new ruleset id (mismatch d);
  - the pure maths for costs, yields, and weather odds.
- **Split hotspots first.** Split `CampaignMap.tsx` (236 lines) and `state/planning.ts` (239) before the parallel phase, because cities, rail, partitions, and units all touch them.
- **Soak.** Move it out of `src/test/soak.test.ts` into the harness (idea 11), printing a one-line JSON summary checked against bands that the owner owns.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Guardrails only | CI gate, a short CLAUDE.md, two or three hooks; process otherwise unchanged | About an hour to set up. Stops red commits and gives a check that still runs when the local verify is waived. Leaves stream coupling, rolling debt, and integrator-owned budgets alone | Low | Applies to any revision or scenario |
| B. Gated slices | A, plus: a contract stream first; per-idea vertical slices; 3 or 4 streams at most; a file-ownership table; a harness gate with owner-owned budgets; a read-only reviewer per stream; stored answers feeding the tasks doc; a debt slot | Covers every problem in the evidence. Costs a serial contract phase and about one extra agent run per stream for review (estimate) | Med | The contract, slice, and gate pattern suits later scenarios (WW1, WW2) as well |
| C. Full orchestration | B, plus scripted multi-agent workflows or agent teams, cloud runs, spec-kit or Kiro specs per idea | Most automation, but experimental features, many times the tokens, a heavy spec review burden, and coding parallelises poorly | High | Generic, but locks the process into tooling |
| D. One agent, in sequence | One agent works through the steps in order, like Rev 5's first pass | No merge conflicts, but slow. Rev 5 still had red commits (D30) and a combined commit (D14) | Low | Neutral |

**Recommendation:** Option B, starting with its cheapest parts: the CI gate and a short CLAUDE.md first, then a contract stream and file-ownership table (most M3 ideas share the schema and map files), then the harness gate and a reviewer subagent. Keep 3 or 4 streams at most, and defer agent teams, scripted workflows, and cloud runs until the gates are working.

### Widget
<!-- widget:process-planner -->
Pick one of the three observed setups (Rev 5, 6, or 7) to see what actually happened: streams, gate, slicing, diff size, red commits, conflicts, fix-ups, and time. Numbers come from the declogs and commit timestamps, with no extrapolation.

### Questions
<!-- questions:10 -->

<!-- sources -->
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [How we built our multi-agent research system (Anthropic)](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Effective harnesses for long-running agents (Anthropic)](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Run agents in parallel](https://code.claude.com/docs/en/agents)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Spec-driven development with AI: Get started with a new open source toolkit (GitHub Blog)](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Kiro: Specs](https://kiro.dev/docs/specs/)
- [Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl (Boeckeler, martinfowler.com)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [Embracing the parallel coding agent lifestyle (Simon Willison)](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- [Working in small batches (DORA)](https://dora.dev/capabilities/working-in-small-batches/)
- [DORA 2025 report](https://dora.dev/research/2025/dora-report/)
