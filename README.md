# @rakshamlabs/rdump-editor

Markdown-first rich text editor for React. A Tiptap-based writing surface with
a canonical markdown round-trip, plus HTML and JSON export — tables, task
lists, code blocks, KaTeX math, Mermaid diagrams, charts, callouts, toggles,
mentions and page links.

## Install

```sh
pnpm add @rakshamlabs/rdump-editor   # or: npm install / yarn add
```

- Requires `react` and `react-dom` ^19 (peer dependencies).
- Import the stylesheet once, app-wide: `import "@rakshamlabs/rdump-editor/styles.css";`
- If you enable `features.math`, also import KaTeX's stylesheet (katex ships
  with this package): `import "katex/dist/katex.min.css";`
- Ships as ESM with `"use client"` directives — works in Vite, Next.js App
  Router (no `transpilePackages` needed), and any React 19 bundler setup.

## Usage

```tsx
import { RDumpEditor } from "@rakshamlabs/rdump-editor";
import "@rakshamlabs/rdump-editor/styles.css";
import "katex/dist/katex.min.css"; // only if features.math is on

<RDumpEditor
  documentId={doc.id}                        // stable per-document id — keys undo history, edit baseline, image migration; omit for single-doc use
  initialContent={markdownOrJsonOrHtml}      // input format auto-detected
  contentFormat="markdown"                   // what onChange emits: "markdown" | "json" (lossless) | "html"
  onChange={(serialized) => save(serialized)}
  config={{
    features: { mermaid: false, charts: false },
    ui: { footer: false },
  }}
  pages={workspacePages}                     // [[ page links + @ page mentions
  onOpenPage={(id) => router.push(`/p/${id}`)}
  onUploadImage={(file) => api.upload(file)} // absent ⇒ images stay inline base64
  loadMentionUsers={() => api.listPeople()}  // absent ⇒ pages-only mentions
  notify={myToastAdapter}                    // absent ⇒ console
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialContent` | `string` | required | Document body: markdown, stringified Tiptap JSON, or HTML — auto-detected by leading character, independent of `contentFormat`. |
| `documentId` | `string` | auto | Stable unique id per document. Keys undo history, the edit baseline, and the image-migration guard when switching docs. Omit for single-document hosts. |
| `contentFormat` | `"markdown" \| "json" \| "html"` | `"markdown"` | Serialization emitted by `onChange`/`onReady`. `"json"` is lossless for every node attribute; `"html"` is render-ready. |
| `onChange` | `(serialized: string) => void` | — | Fires on every genuine edit (never on load/normalization) with the document in `contentFormat`. |
| `onReady` | `(serialized: string) => void` | — | Fires once after init with the normalized serialization — persist this to avoid spurious dirty-state on reload. |
| `editable` | `boolean` | `true` | Read-only mode when `false` (shows a lock banner unless `preview`). |
| `authorName` | `string` | — | The document author's name, shown in the read-only banner ("Read-only document by …"). |
| `preview` | `boolean` | `false` | Bare surface: no toolbar, banners, footer, or lightbox. For side-by-side panes. |
| `config` | `RDumpEditorConfig` | all on | Feature/UI/behavior flags — see [Config](#config). Compared by value; inline literals are fine. |
| `pages` | `PageRef[]` | — | `{ id, title }` list backing `[[` page links and `@` page mentions. Live titles update as this changes. |
| `onOpenPage` | `(id: string) => void` | — | Called when a page-link chip is clicked. Absent ⇒ chips render but don't navigate. |
| `onUploadImage` | `(file: File) => Promise<{ url: string }>` | — | External image storage. Absent ⇒ images stay inline as base64. Files over `behavior.maxImageBytes` always inline. |
| `loadMentionUsers` | `() => Promise<MentionUser[]>` | — | `{ id, name, email }` list for `@` people mentions, fetched once and cached. Absent ⇒ pages-only mentions. |
| `notify` | `EditorNotify` | console | Toast sink: `info/success/warning/error(msg)` + `loading(msg) → { dismiss }`. |
| `extraExtensions` | `AnyExtension[]` | — | Host-authored Tiptap extensions — see [Custom extensions](#custom-extensions). Captured on mount; change `key` to swap. |
| `ref` | `Ref<EditorHandle>` | — | Imperative export in any format: `getMarkdown()`, `getHTML()`, `getJSON()`, plus `tiptap` (the live instance) as an escape hatch. |

## Content model

- **Markdown is the canonical format** (CommonMark + GFM) and the default
  `contentFormat`. `initialContent` accepts any of the three formats
  regardless — stored content converts to the configured output on next save.
  Pick `"json"` when node-attribute fidelity matters more than portability
  (e.g. legal documents), `"html"` to persist render-ready output.
- Nodes without a markdown spelling (math, callouts, mentions, page links,
  hashtags, toggles, resized images) round-trip as inline HTML inside the
  markdown body. Mermaid/chart blocks round-trip as ` ```mermaid ` /
  ` ```chart ` fences.
- Serialization is deterministic (`-` bullets, tight lists) so content hashes
  are stable across sessions.

## Config

```ts
config = {
  features: {
    // all default true; false removes the feature AND skips its download
    images, tables, taskLists, codeBlocks,
    math,      // KaTeX (bring katex/dist/katex.min.css yourself)
    mermaid,   // diagram library loads only when a diagram renders
    charts,    // recharts loads only when a chart renders
    callouts, details, hashtags,
    mentions,  // needs loadMentionUsers for people; pages work without it
    pageLinks, // needs pages / onOpenPage
  },
  ui: { toolbar, bubbleMenu, slashMenu, dragHandle, markdownView, footer },
  behavior: {
    placeholder: { paragraph, heading },
    headingLevels,        // default [1, 2, 3]
    characterLimit,       // default 100_000
    longDocWarningChars,  // default 50_000; false disables
    maxImageBytes,        // default 4 MB; larger images inline as base64
    persistViewModeKey,   // localStorage key; false disables persistence
  },
}
```

**Feature flags and existing content:** flags are safe for new documents.
Disabling a feature a document already uses degrades that content on its next
save — mermaid/chart fences degrade losslessly to plain code blocks, but
HTML-based nodes (math, callouts, mentions, page links, toggles) lose their
node identity. Don't turn features off for content you intend to keep.

## Custom extensions

```tsx
import { Node, mergeAttributes } from "@rakshamlabs/rdump-editor"; // NOT from @tiptap/core

const PageBreak = Node.create({ /* … */ });

<RDumpEditor extraExtensions={[PageBreak]} … />
```

Import Tiptap primitives from this package, not from `@tiptap/*` directly —
two Tiptap installations means two ProseMirror instances and subtle schema
breakage.

## Theming

All colors/radii/shadows come from CSS custom properties with zero-specificity
defaults (`:where(:root)` in the bundled stylesheet). Redefine any of them on
your own `:root` to theme the editor — see `src/styles/theme.css` for the
token list (`--background`, `--foreground`, `--accent`, `--border`,
`--radius-md`, `--font-mono`, …).

## Development

```
pnpm install
pnpm dev            # playground on :5199, HMR against src/
pnpm build          # dist/ (ESM, preserved modules, styles.css, .d.ts)
pnpm preview:dist   # playground against the built artifact
```

The playground's **Round-trip** tab runs the fixture corpus through
serialize/parse twice: pass1 ≠ pass2 (non-idempotent serialization) is a hard
failure; fixture ≠ pass1 just means the fixture wasn't hand-written in
canonical form and shows the normalization diff.
