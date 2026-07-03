import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../public",
    emptyOutDir: false,
    // Ground truth for post-build.mjs's stale-asset cleanup — without this, chunks
    // only reachable via a runtime import() (not statically referenced/preloaded in
    // index.html or CSS, e.g. code-block.tsx's lazy import) look "unreferenced" to a
    // pure HTML/CSS scan and get deleted right after being built. See post-build.mjs.
    manifest: true,
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        manualChunks(id) {
          if (id.includes("node_modules/shiki") || id.includes("@shikijs/")) {
            return "shiki";
          }
        },
      },
    },
  },
  publicDir: "public",
});
