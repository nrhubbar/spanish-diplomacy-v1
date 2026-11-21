# Spanish Diplomacy: project rules

A turn-based strategy game of the Spanish Civil War (TypeScript, React, Redux Toolkit, Vite, Vitest, Playwright). Design docs live in `project/milestones/`; they are internal and never imported by the app.

## Commands
- `npm run verify` runs what CI runs: lint, typecheck, unit tests with coverage, build, Playwright.
- Fast loop: `npm run lint`, `npm run typecheck`, `npx vitest run <file>`.
- Coverage gate (`vitest.config.ts`): branches 93%, functions/lines/statements 92%. Every new rule or branch needs a unit test.
- `npm run sim` is the headless balance harness. **Run sims only when the owner asks** (skill: `run-sim`).
- Screenshots: follow `project/testing-screenshots.md` (skill: `regen-screenshots`). Always set your own `E2E_PORT`.
- **Don't touch the Linux visual baselines (`npm run e2e:baselines`) or the production smoke test;** the owner maintains them.

## Git and worktrees
- **Never use bare `git stash` or `git stash pop`;** a hook blocks it. The stash stack is shared by every worktree and session. Use a WIP commit, or `git stash push -u -m <unique-tag>` and `git stash apply <sha>`.
- Worktrees are sibling directories (`../spanish-diplomacy-v1-<name>`), never under `.claude/worktrees/`. Remove a workstream's worktree once it's merged, keeping the branch (skill: `merge-slice`).
- Worktrees symlink `node_modules`, and that link shows as untracked. Stage files by path, never with `git add -A` at the root.
- Commit only when asked. Never push: the owner decides when `main` goes out (pushing deploys to production).
- Images (`*.png`, `*.webp`, ...) and the map source geojson are in Git LFS (`.gitattributes`).

## Code
- The engine (`src/main/engine/`) is pure and deterministic. All randomness comes from the seeded roll streams; there are no clocks and no `Math.random`.
- Rules and numbers live in the scenario data (`src/scenarios/<id>/`), not hard-coded, so other eras can reuse the engine. The Zod schemas (`src/main/scenarios/schema/`) are the source of truth; regenerate the published JSON Schemas with `npm run spec:build` (`spec:check` fails on drift).
- The computer player (`src/main/ai/`) must be *able* to use every action a human can. A new order kind ships with its AI path and a test.
- Player-facing text is plain English, with no internal ids, rule codes (D17, Q-MR-21) or design-note jargon.

## How a revision runs
- A revision is a playtest-driven attempt at the whole milestone. The bar is production-ready.
- The team is one coordinator, one supervisor and N workers in sibling worktrees. Names are lower-kebab-case, with an optional number (`rail-engine-2`).
- Each workstream gets one read-only correctness review before hand-off (agent: `diff-reviewer`), scoped to its diff.
- Keep token use modest and report it: the owner tracks it.

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance

- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.
- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- For any AWS task or question — building, configuring, migrating, debugging,
  or operating a service, writing SDK code, authoring CDK/CloudFormation, or
  answering how a service works — first call `aws___search_documentation` with
  topic `agent_skills` and load the matching skill with `aws___retrieve_skill`.
  Do this even when you believe you know the answer: skills carry current
  service behavior that your training may not. Prefer the skill's guidance over
  general knowledge. Skip it only for work that does not involve AWS.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- Before reporting a count, a total, or that something does not exist, read
  every page of the results and search every Region and scope where it could
  be. If you could not, say the result is partial and name what you checked.
- To say what a system currently does, read what the runtime uses: the
  completed deployment, the alias or version that is invoked, the template the
  stack is running. A newer stored version, a draft, or a description field is
  not evidence of live behavior.
- Present a cause as confirmed only if data, configuration, or logs you read
  show it. Label anything else as unverified, and say what you would check
  next.
- Before you interpret the records that show a failure, such as error log
  lines, failed executions, or table items, read one of them whole, with
  every field. Don't truncate messages or select fields in your own code
  until you have.
- When an error says a value was undefined, null, empty, or missing, find
  the input, query result, or item that supplied that value. If the account
  shows why it was empty, such as no item matching the key, read that
  before you call the cause unverified.
- When a field in a record you read explains the result, such as an error
  counter, an empty array, a null, or a state value, name the field and its
  exact value in the answer, and say which record it came from.
- When the user asks a specific question or names a suspected cause, confirm
  or rule out each cause they raised, and do not offer alternatives your evidence
  does not support.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Before you conclude

- Before deciding the AWS account can't hold what the request asks for,
  look. List the places it could live, such as S3 buckets, databases, and
  log groups, and read what is there.
- Don't conclude that records are missing from metadata, such as a
  creation date or a stored-bytes count, or from one query that failed or
  came back empty. Read the records another way, across the full time
  range, before reporting them absent.
- A tool's own error is evidence. If a call the answer depends on fails
  with expired or missing credentials or AccessDenied, report that error
  and what it blocks, and don't overrule it with another check. Searching
  other Regions is for finding resources, not for retrying an auth error.
  Retry throttling with backoff before you report it.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
<!-- END AWS Agent Toolkit rules -->
