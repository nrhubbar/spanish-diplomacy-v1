# The one Linux environment the checks run in, on a laptop and in GitHub Actions alike: Playwright's
# image (the browser and fonts of the locked Playwright version), the Node version that mise.toml
# pins, and the locked npm packages. Built and run by run.sh, which passes both versions in.
ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG NODE_VERSION
RUN [ "$(node --version)" = "v${NODE_VERSION}" ] || npx --yes n@10.2.0 "${NODE_VERSION}"
WORKDIR /game
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
