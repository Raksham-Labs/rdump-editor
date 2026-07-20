import dts from "rollup-plugin-dts";

// Bundles the tsc-emitted per-module declarations (.types/) into one
// self-contained dist/index.d.ts. @tiptap/* types are INLINED: the tiptap
// runtime is vendored into dist (see vite.config.ts) and tiptap lives in
// devDependencies, so consumer TypeScript must never need to resolve
// @tiptap/* itself. Keep this list in sync with vite.config.ts
// EXTERNAL_RUNTIME_PACKAGES.
const EXTERNAL_RUNTIME_PACKAGES = [
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

// tsc keeps the side-effect `import "./styles/theme.css"` in the emitted
// declarations; resolve any css import to an empty virtual module so it
// vanishes from the bundled types (hosts import the real stylesheet via the
// "./styles.css" export, not through the types).
const stripCssImports = {
  name: "strip-css-imports",
  resolveId(id) {
    if (id.endsWith(".css")) return "\0empty-css";
    return null;
  },
  load(id) {
    if (id === "\0empty-css") return "";
    return null;
  },
};

export default {
  input: ".types/index.d.ts",
  output: { file: "dist/index.d.ts", format: "es" },
  external: (id) =>
    EXTERNAL_RUNTIME_PACKAGES.some((pkg) => id === pkg || id.startsWith(`${pkg}/`)),
  plugins: [stripCssImports, dts({ respectExternal: true })],
};
