# Note 17: tooling recommendations (claude-code-guide, 20 Nov 2026)

Tags: [docs] Claude Code docs; [list] bundled command list, no docs page found; [mine] the agent's judgement.

1. Diff-scoped reviewer subagent, `.claude/agents/diff-reviewer.md`: tools Read/Grep/Glob/Bash, model sonnet, effort medium, maxTurns 30. Hand it the diff and file list. [docs: sub-agents.md]; savings unmeasured [mine].
2. TypeScript LSP plugin: `npm install -g typescript-language-server typescript`, then `/plugin install typescript-lsp@claude-plugins-official`. Symbol navigation and type errors after edits; fewer whole-file reads. [docs: plugins/code-intelligence.md]
3. Minimal CLAUDE.md now (~40 lines). Auto memory does not reach subagents, but CLAUDE.md does [docs: memory.md]. Today the worktree, stash and screenshot SOPs never reach workers. Conflicts with the M5 deferral; owner's call.
4. Partition file ownership per slice; `worktree.baseRef: "head"` if slices must branch from the integration tip [docs: worktrees.md]; workflows for review fan-out [docs: workflows.md].
5. `/batch` for make-it-work fan-out [list; unverified].
6. Usage limits: `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`, `workflowSizeGuideline`, `autoContinueAtUsageLimit` [docs: workflows.md]; sonnet for workers [mine].
7. Hooks in `.claude/settings.json`: PreToolUse block of bare `git stash`; PostToolUse eslint on Edit|Write; tsc on Stop/SubagentStop [docs: hooks.md].
8. Project skills: run-sim (context: fork), regen-screenshots, merge-slice (disable-model-invocation) [docs: skills.md].
9. `/fewer-permission-prompts`, then review the allow list [list].
10. Playwright MCP: `claude mcp add playwright npx @playwright/mcp@latest` (playwright.dev); optional, since the e2e capture already exists. Skip GitHub MCP; `gh` suffices.

Docs: https://code.claude.com/docs/en/sub-agents.md, hooks.md, skills.md, workflows.md, worktrees.md, memory.md, plugins/code-intelligence.md, mcp.md
