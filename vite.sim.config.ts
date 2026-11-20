import { defineConfig, type Plugin } from "vite";

/**
 * The headless harness never draws the map, so map art and icons are stubbed: the loader only
 * checks that their paths exist (L11), which the glob keys still prove.
 */
function stubArt(): Plugin {
  return {
    name: "sim-stub-art",
    enforce: "pre",
    load(id) {
      return /\?(raw|url)$/.test(id) ? "export default \"\";" : undefined;
    }
  };
}

/** `npm run sim`: one Node bundle that is both the CLI and its worker threads (H1). */
export default defineConfig({
  plugins: [stubArt()],
  build: {
    ssr: "src/sim/cli.ts",
    outDir: "build/sim-cli",
    emptyOutDir: true,
    target: "node24",
    sourcemap: true,
    rolldownOptions: {
      output: { entryFileNames: "sim.mjs", codeSplitting: false }
    }
  },
  ssr: { noExternal: true, target: "node" }
});
