#!/usr/bin/env bash
# PreToolUse (Bash): block bare `git stash`. The stash stack is shared by every worktree and
# session, so a bare stash or pop can take someone else's changes. Allowed: `git stash list`,
# `git stash show`, `git stash push ... -m <tag>`, `git stash apply <sha>`, `git stash drop <ref>`.
cmd=$(jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0
# Split on shell separators and check each git stash invocation.
while IFS= read -r part; do
  part="${part#"${part%%[![:space:]]*}"}"
  [[ "$part" =~ ^git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+stash([[:space:]]|$) ]] || continue
  rest="${part#*stash}"; rest="${rest#"${rest%%[![:space:]]*}"}"
  sub="${rest%%[[:space:]]*}"
  case "$sub" in
    list|show) continue ;;
    push) [[ "$rest" =~ (-m|--message)[[:space:]]+[^[:space:]] ]] && continue ;;
    apply|drop) args="${rest#"$sub"}"; [[ "$args" =~ [^[:space:]] ]] && continue ;;
  esac
  echo "Blocked: bare 'git stash' ($part). The stash stack is shared across worktrees and sessions. Use a WIP commit, or 'git stash push -u -m <unique-tag>', then 'git stash apply <sha>' and drop by tag." >&2
  exit 2
done < <(printf '%s\n' "$cmd" | sed -E 's/(&&|\|\||;|\|)/\n/g')
exit 0
