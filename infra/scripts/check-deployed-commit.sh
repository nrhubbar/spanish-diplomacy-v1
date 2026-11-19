#!/usr/bin/env bash
# Dye test: proves a commit reached production. It waits until the live index.html carries
# <meta name="build-commit" content="SHA">, then checks that every script and stylesheet it
# references is served.
#
# Usage: infra/scripts/check-deployed-commit.sh [sha] [site-url]
#   sha       defaults to $GITHUB_SHA, else git HEAD
#   site-url  defaults to https://spanish-diplomacy.nicholas-hubbard.com/
set -euo pipefail

expected="${1:-${GITHUB_SHA:-$(git rev-parse HEAD)}}"
site="${2:-https://spanish-diplomacy.nicholas-hubbard.com/}"
site="${site%/}"
attempts=30 # 30 x 10 s = 5 minutes

for ((i = 1; i <= attempts; i++)); do
  html="$(curl -fsS "$site/" || true)"
  served="$(sed -nE 's/.*<meta name="build-commit" content="([^"]*)".*/\1/p' <<<"$html" | head -1)"
  if [[ "$served" == "$expected" ]]; then
    echo "Live site serves commit $served"
    break
  fi
  echo "Attempt $i/$attempts: live site serves '${served:-nothing}', waiting for $expected"
  if ((i == attempts)); then
    echo "Live site never served commit $expected" >&2
    exit 1
  fi
  sleep 10
done

# Every asset the new HTML points at must exist; a partial upload would fail here.
assets="$(grep -oE '(src|href)="/assets/[^"]+"' <<<"$html" | sed -E 's/^(src|href)="([^"]+)"$/\2/' | sort -u)"
[[ -n "$assets" ]] || { echo "No /assets/ references found in index.html" >&2; exit 1; }
count=0
while read -r path; do
  status="$(curl -s -o /dev/null -w '%{http_code}' "$site$path")"
  echo "$status $path"
  [[ "$status" == "200" ]] || { echo "Asset $path returned $status" >&2; exit 1; }
  count=$((count + 1))
done <<<"$assets"
echo "Dye test passed: commit $expected is live with all $count referenced assets."
