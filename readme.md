Spanish Diplomacy (V1)
---

A browser strategy game inspired by Diplomacy: every player plans orders in secret, all orders are revealed at once, and the turn resolves deterministically. The first scenario is Spain on 31 July 1936, with three commands: the Republican Government and the Northern and Southern Insurgent Commands.

![Planning on the campaign map](./e2e/baselines/chromium/planning-operational.png)

## Playing

- **Create Game**, then assign each command to a local player or a computer player. Several people can share one device; the game hands it over privately between them.
- Select a territory (or one of your armies) on the map. Every army there without an order is selected; click an army in the list or on the map to leave it out.
- Choose **Give Selected Armies Order**, then **Move**, then click one of the territories with a shimmering gold border. **Cancel** backs out with the same armies still selected. Armies without orders hold.
- **End Turn**. When the last local player ends the turn, it resolves at once and the turn report shows what happened. **Start Next Turn** carries on.
- Win by controlling 51 percent of the territories or 75 percent of the cities.
- Map controls: drag or use W A S D to pan, scroll, pinch, or use + and - to zoom, and 0 to reset. Tab to a territory and press Enter to select it.

## Running

Tools are pinned in `mise.toml` (Node, Git LFS, AWS CLI), and images, map sources, and visual baselines live in Git LFS.

```
mise install         # once: the pinned toolchain
mise run setup       # once per clone: LFS hooks and files, npm ci for the game and infra/
npm run dev          # http://127.0.0.1:5173/assets/
npm run verify       # lint, types, unit tests with coverage, build, and Playwright (desktop Chromium)
npm run verify:linux # the same in CI's Linux container, visual baselines included (needs Docker)
```

`scripts/linux/run.sh <command>` runs any command in that container, which is built from Playwright's image for the locked version, the Node version in `mise.toml` and the locked npm packages. On a Mac, [colima](https://github.com/abiosoft/colima) provides Docker: `brew install colima docker`, then `colima start --cpu 4 --memory 8`. CI uses an arm64 runner, so on Apple silicon the architecture, image, fonts and browser are the same in both places. CPU speed is not: a local pass of the timing budgets (`e2e/performance.spec.ts`) doesn't prove a pass on CI's runner.

## Deploying

The game is live at https://spanish-diplomacy.nicholas-hubbard.com/. Every push to `main` deploys it through GitHub Actions (`.github/workflows/ci-cd.yml`):

1. **Verify game** (Ubuntu on arm64): `npm run verify:linux`, which is `npm run verify` in the checks' container, building with the commit SHA stamped into `<meta name="build-commit">`. The `build/dist` it produces is kept as an artifact.
2. **Check infrastructure**: typecheck and `cdk synth` of `infra/`.
3. **Deploy to AWS** (main only): `cdk deploy` of the stacks, then `infra/scripts/publish-site.sh` uploads that exact `build/dist` to S3 and invalidates the HTML.
4. **Verify production**:
   - Dye test: `infra/scripts/check-deployed-commit.sh` waits until the live site serves the pushed commit, and checks every asset that commit's HTML references.
   - Smoke test: `e2e/production.spec.ts` plays a turn.

Every branch push and pull request runs steps 1 and 2.

The visual baselines in `e2e/baselines/` are Chromium renders from the container, so `visual.spec.ts` runs only on Linux and skips on a Mac. To refresh the desktop ones:

1. Run `npm run e2e:baselines`, which renders them in the container. Without Docker, push a `baselines/<name>` branch; the "Update visual baselines" workflow runs the same command, and its `visual-baselines` artifact holds the images.
2. Review the images.
3. Commit them in a commit of their own.

The infrastructure is an AWS CDK (TypeScript) app in `infra/` with two stacks in account 756988898359, us-east-1:

- `SpanishDiplomacyGithubDeploy`: the `spanish-diplomacy-github-deploy` IAM role. GitHub Actions assumes it over OIDC, and only from `main` of this repository. It deploys through the CDK bootstrap roles.
- `SpanishDiplomacySite`: a private S3 bucket behind CloudFront (origin access control, HTTP/2 and 3, security headers), an ACM certificate, and A/AAAA records in the existing `nicholas-hubbard.com` hosted zone.

Content is not baked into CloudFormation. Hashed files under `/assets/` are uploaded with a one-year immutable cache and HTML with `no-cache`, so a content-only release is an `s3 sync` plus a small invalidation. Old hashed chunks are never deleted, so a player mid-game keeps working through a release.

To run any of it from a laptop, sign in with the `spanish-diplomacy` AWS profile:

```
mise run infra:check                            # no credentials needed
AWS_PROFILE=spanish-diplomacy mise run infra:diff
AWS_PROFILE=spanish-diplomacy mise run deploy   # build, cdk deploy, publish, smoke test
```

## Scenarios

Scenarios are data, not code. Each one is a folder under `src/main/scenarios/` with a `scenario.json` (rules data) and a `map.json` (presentation), validated against the specs in `project/specs/`. Adding a folder adds a scenario.

Project planning, milestone specs, and decision logs are in `project/`.
