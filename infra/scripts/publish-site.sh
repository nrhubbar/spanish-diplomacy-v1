#!/usr/bin/env bash
# Upload build/dist to the site bucket and refresh the HTML at the edge.
#
# Usage: infra/scripts/publish-site.sh [outputs-file] [dist-dir]
#   outputs-file  defaults to infra/cdk-outputs.json (written by `npm run deploy` in infra/)
#   dist-dir      defaults to build/dist
#
# Hashed files are immutable, so they go first with a one-year cache; HTML goes last with
# no-cache so a visitor never gets HTML that points at chunks not uploaded yet. Nothing is
# deleted: a player mid-session can still lazy-load the previous release's chunks.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
outputs="${1:-$repo_root/infra/cdk-outputs.json}"
dist="${2:-$repo_root/build/dist}"

[[ -f "$outputs" ]] || { echo "Missing $outputs; run the CDK deploy first." >&2; exit 1; }
[[ -f "$dist/index.html" ]] || { echo "Missing $dist/index.html; run npm run build first." >&2; exit 1; }

# Guard against shipping Git LFS pointer files instead of images (a checkout without LFS).
if grep -rlq --include='*.webp' --include='*.png' --include='*.ico' '^version https://git-lfs' "$dist"; then
  echo "build output contains Git LFS pointer files; run git lfs pull and rebuild." >&2
  exit 1
fi

read_output() { node -e 'const o=require(process.argv[1]).SpanishDiplomacySite; process.stdout.write(o[process.argv[2]])' "$outputs" "$1"; }
bucket="$(read_output BucketName)"
distribution="$(read_output DistributionId)"

echo "Publishing $dist to s3://$bucket (distribution $distribution)"
aws s3 sync "$dist" "s3://$bucket" --exclude '*.html' \
  --cache-control 'public, max-age=31536000, immutable' --no-progress
aws s3 sync "$dist" "s3://$bucket" --exclude '*' --include '*.html' \
  --cache-control 'no-cache' --content-type 'text/html; charset=utf-8' --no-progress

invalidation="$(aws cloudfront create-invalidation --distribution-id "$distribution" \
  --paths '/' '/index.html' '/assets/' '/assets/index.html' --query 'Invalidation.Id' --output text)"
echo "Waiting for invalidation $invalidation"
aws cloudfront wait invalidation-completed --distribution-id "$distribution" --id "$invalidation"
echo "Published $(read_output SiteUrl)"
