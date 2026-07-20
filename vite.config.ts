import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import preserveDirectives from "rollup-preserve-directives";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(fileURLToPath(import.meta.url));

// Library build. Key choices:
// - ESM only, preserveModules: every source module stays its own output file,
//   so the feature modules' dynamic import() boundaries survive verbatim and
//   the CONSUMER's bundler does the code-splitting (that's what keeps katex /
//   lowlight / mermaid / recharts out of a host bundle when the flags are off).
// - Every bare specifier is external — the package ships no vendored deps.
// - cssCodeSplit off: all component CSS aggregates, in import order, into a
//   single dist/styles.css that hosts import once.
// - rollup-preserve-directives keeps the "use client" directives on each
//   output module for RSC consumers.
export default defineConfig({
  plugins: [react(), preserveDirectives()],
  build: {
    lib: {
      entry: resolve(projectDir, "src/index.ts"),
      formats: ["es"],
    },
    outDir: "dist",
    cssCodeSplit: false,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !id.startsWith("\0") && !isAbsolute(id),
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        assetFileNames: "styles[extname]",
      },
    },
  },
});
