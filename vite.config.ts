import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      // Stamps the commit into the production HTML. CI sets BUILD_COMMIT, and after a deploy
      // it waits until the live site serves this exact commit (infra/scripts/check-deployed-commit.sh).
      name: "spanish-diplomacy-build-commit",
      apply: "build",
      transformIndexHtml: () => [
        { tag: "meta", attrs: { name: "build-commit", content: process.env["BUILD_COMMIT"] ?? "local" }, injectTo: "head" }
      ]
    },
    {
      name: "spanish-diplomacy-dev-root",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url === "/") {
            response.statusCode = 302;
            response.setHeader("Location", "/assets/");
            response.end();
            return;
          }

          next();
        });
      }
    }
  ],
  build: {
    // Three.js is isolated behind the campaign-map dynamic import (132 kB gzip).
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      input: "assets/index.html"
    },
    outDir: "build/dist",
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    open: false
  }
});
