---
name: merge-slice
description: Merge a finished workstream branch into the revision's integration branch, verify, then remove its worktree. Run only when the coordinator says a slice is ready.
disable-model-invocation: true
---

Arguments: the slice branch and the integration worktree (for example `m3r2-air` into `../spanish-diplomacy-v1-m3r2`).

1. In the slice worktree: `git status` must be clean (commit WIP first; never a bare `git stash`). `npm run lint && npm run typecheck` must pass.
2. In the integration worktree: `git merge --no-ff <slice-branch>`. Resolve conflicts by keeping both sides' intent; ask the coordinator when two slices changed the same rule.
3. Verify in the integration worktree: `npm run lint && npm run typecheck && npm run test:unit`. Fix or hand back failures before going on. No sims, no baseline updates.
4. Remove the slice worktree: `git worktree remove ../<slice-dir>` (it must be clean). Keep the branch. Worktrees are sibling directories of the main checkout, never under `.claude/worktrees/`.
5. Report the merge commit, test counts and coverage, and anything handed back.
