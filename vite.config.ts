import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import preserveDirectives from "rollup-preserve-directives";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(fileURLToPath(import.meta.url));

// The package's entire runtime dependency surface. Everything NOT listed
// here — notably the whole @tiptap/* + prosemirror-* graph and
// tiptap-markdown — is vendored into dist. Rationale: tiptap packages
// depend on each other through caret ranges, so a consumer install can
// resolve sibling extensions to a NEWER tiptap than the pinned core (pnpm
// auto-installed peers can't even be overridden consumer-side). That mixed
// tree risks a second ProseMirror instance — the exact breakage the README
// warns hosts about. Vendoring freezes one consistent tiptap graph inside
// the package. Keep this list in sync with package.json
// dependencies/peerDependencies and with rollup.dts.config.mjs.
export const EXTERNAL_RUNTIME_PACKAGES = [
  "react",
  "react-dom",
  "katex",
  "lowlight",
  "lucide-react",
  "markdown-it",
  "markdown-it-task-lists",
  "mermaid",
  "recharts",
];

const isExternalPackage = (id: string) =>
  EXTERNAL_RUNTIME_PACKAGES.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));

// Library build. Key choices:
// - ESM only, preserveModules: every source module stays its own output file,
//   so the feature modules' dynamic import() boundaries survive verbatim and
//   the CONSUMER's bundler does the code-splitting (that's what keeps katex /
//   lowlight / mermaid / recharts out of a host bundle when the flags are off).
// - Only EXTERNAL_RUNTIME_PACKAGES stay external; the tiptap graph is
//   vendored (see above).
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
      external: (id) =>
        !id.startsWith(".") &&
        !id.startsWith("\0") &&
        !isAbsolute(id) &&
        isExternalPackage(id),
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        // Vendored third-party modules must not emit under
        // dist/node_modules/... — npm and host bundlers special-case that
        // directory name. Re-root each module at vendor/<pkg>/… keeping its
        // package-relative path (many vendored packages have an index.js, so
        // flattening by basename would collide).
        entryFileNames: (chunk) => {
          const marker = "node_modules/";
          const idx = chunk.name.lastIndexOf(marker);
          if (idx === -1) return "[name].js";
          return `vendor/${chunk.name.slice(idx + marker.length)}.js`;
        },
        assetFileNames: "styles[extname]",
      },
    },
  },
});
