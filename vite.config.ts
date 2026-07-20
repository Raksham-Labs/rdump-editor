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
      // tiptap-markdown is bundled (not external): it imports @tiptap/pm/*
      // without declaring @tiptap/pm as a peer, which breaks resolution in
      // strict installs (pnpm on Vercel). Bundling moves those imports into
      // our own modules, where @tiptap/pm is a properly declared dependency.
      // Its other imports (markdown-it, prosemirror-markdown, …) stay
      // external and are declared in our dependencies.
      external: (id) =>
        id !== "tiptap-markdown" &&
        !id.startsWith(".") &&
        !id.startsWith("\0") &&
        !isAbsolute(id),
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        // Bundled third-party modules (tiptap-markdown) must not emit under
        // dist/node_modules/... — npm and host bundlers special-case that
        // directory name. Flatten them into vendor/ instead.
        entryFileNames: (chunk) =>
          chunk.name.includes("node_modules")
            ? `vendor/${chunk.name.split("/").pop()}.js`
            : "[name].js",
        assetFileNames: "styles[extname]",
      },
    },
  },
});
