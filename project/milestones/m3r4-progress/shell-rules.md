# Shell rules for Rev 4 workers

- Give every command an explicit timeout: 60 s for a lint of a few files, 120 s for one test file, 300 s for a full unit run, 420 s for a Playwright spec. Never more than 600 s.
- If a command times out, don't run it again as it was. Narrow it (one file, one test name) or find what it waits for.
- No watch modes and nothing interactive: `npx vitest run <file>`, `npx playwright test <spec> --project=chromium --reporter=line`. Playwright starts its own server; don't start one unless you need it, and then in the background and killed when you finish.
- No `sleep`, no polling loops, no waiting on a background command with nothing else to do. Run tests in the foreground, send their output to a file, and read only the summary.
- Don't end your turn to wait on something. End it only with the hand-back.
- One full unit run at a time, at most twice in all: other workers share the machine. A single 15 s timeout that passes alone is load; say so and move on.
- Before handing back, kill any process you started.
