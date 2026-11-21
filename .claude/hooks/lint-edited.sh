#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): run eslint on the edited file, from the checkout or worktree
# that owns it, and feed any errors back. Only source files that `npm run lint` covers.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in *.ts|*.tsx|*.js|*.mjs) ;; *) exit 0 ;; esac
[ -f "$file" ] || exit 0
root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
case "${file#"$root"/}" in src/*|e2e/*|scripts/*|*.ts|*.js) ;; *) exit 0 ;; esac
[ -x "$root/node_modules/.bin/eslint" ] || exit 0
if ! out=$(cd "$root" && node_modules/.bin/eslint --no-warn-ignored "$file" 2>&1); then
  printf 'eslint found problems in %s:\n%s\n' "$file" "$out" >&2
  exit 2
fi
exit 0
