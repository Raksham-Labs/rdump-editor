import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const playgroundDir = dirname(fileURLToPath(import.meta.url));

// Playground dev server. Default mode aliases @rakshamlabs/rdump-editor to the source
// entry for instant HMR against src/. `--mode dist` aliases to the built
// output instead, to smoke-test the artifact a consumer would install
// (run `pnpm build` first).
export default defineConfig(({ mode }) => ({
  root: resolve(playgroundDir),
  plugins: [react()],
  resolve: {
    alias: {
      "@rakshamlabs/rdump-editor/styles.css":
        mode === "dist"
          ? resolve(playgroundDir, "../dist/styles.css")
          : resolve(playgroundDir, "src/noop.css"),
      "@rakshamlabs/rdump-editor":
        mode === "dist"
          ? resolve(playgroundDir, "../dist/index.js")
          : resolve(playgroundDir, "../src/index.ts"),
    },
  },
  server: { port: 5199 },
}));
