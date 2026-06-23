import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
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
    rollupOptions: {
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
