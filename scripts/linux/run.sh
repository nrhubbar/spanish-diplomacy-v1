#!/usr/bin/env bash
# Runs a command on a copy of this checkout in the checks' Linux container (see Dockerfile here).
#
# Usage: scripts/linux/run.sh <command> [args...]      e.g. scripts/linux/run.sh npm run verify
#   COPY_BACK  paths to copy out of the container afterwards, even if the command failed (default: build)
#
# The container gets a copy of the tracked and new files rather than a mount, so it works in a
# worktree, never touches the checkout's own node_modules, and reads files at native speed.
set -euo pipefail
cd "$(dirname "$0")/../.."

playwright="$(awk '/"node_modules\/@playwright\/test"/ { getline; gsub(/[",]/, ""); print $2 }' package-lock.json)"
node="$(sed -nE 's/^node = "([^"]+)"$/\1/p' mise.toml)"
[[ -n "$playwright" && -n "$node" ]] || { echo "No Playwright version in package-lock.json or no Node version in mise.toml" >&2; exit 1; }

# Keep macOS metadata files and extended attributes out of the copy: Linux rejects the latter.
export COPYFILE_DISABLE=1

image=spanish-diplomacy-linux
context="$(mktemp -d)"
container=""
cleanup() {
  rm -rf "$context"
  if [[ -n "$container" ]]; then docker rm --force "$container" >/dev/null || true; fi
}
trap cleanup EXIT
cp package.json package-lock.json scripts/linux/Dockerfile "$context"
docker build --tag "$image" --build-arg "PLAYWRIGHT_VERSION=$playwright" --build-arg "NODE_VERSION=$node" "$context"

# What to copy in: everything tracked or new and not ignored, less deleted files and node_modules
# (which a worktree symlinks).
files() {
  git ls-files --cached --others --exclude-standard -z | while IFS= read -r -d '' file; do
    if [[ "$file" != node_modules && -e "$file" ]]; then printf '%s\0' "$file"; fi
  done
}

container="$(docker create --init --ipc=host --env CI=true --env BUILD_COMMIT "$image" "$@")"
files | tar -c --no-xattrs --null -T - | docker cp --quiet - "$container:/game"

status=0
docker start --attach "$container" || status=$?

# Test results of earlier runs would mix with this run's.
rm -rf build/e2e
for path in ${COPY_BACK:-build}; do
  # A path the command never wrote is not an error of its own.
  rm -rf "$context/out"
  if ! docker cp --quiet "$container:/game/$path" "$context/out" 2>/dev/null; then
    echo "Nothing to copy back from $path" >&2
    continue
  fi
  # Each entry replaces the last run's (build/dist must not keep old chunks); others stay.
  mkdir -p "$path"
  for entry in "$context"/out/*; do
    [[ -e "$entry" ]] || continue
    rm -rf "${path:?}/$(basename "$entry")"
    mv "$entry" "$path/"
  done
done
exit "$status"
