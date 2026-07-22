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
- Tiptap and ProseMirror are **vendored into the package** (types included) —
  never add `@tiptap/*` or `prosemirror-*` to your own dependencies; a second
  install would mean a second ProseMirror instance. Import any Tiptap
  primitives you need from this package (see
  [Custom extensions](#custom-extensions)).
- Import the stylesheet once, app-wide: `import "@rakshamlabs/rdump-editor/styles.css";`
- Pages that only **render** exported HTML — no editor mounted — can import
  the much smaller `@rakshamlabs/rdump-editor/content.css` instead and wrap
  the HTML in `class="rdump-content"` — see
  [Rendering serialized content](#rendering-serialized-content).
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

| Prop | Type | Default | Example | Description |
| --- | --- | --- | --- | --- |
| `initialContent` | `string` | required | `"# Hello **world**"` | Document body: markdown, stringified Tiptap JSON, or HTML — auto-detected by leading character, independent of `contentFormat`. |
| `documentId` | `string` | auto | `"doc-42"` | Stable unique id per document. Keys undo history, the edit baseline, and the image-migration guard when switching docs. Omit for single-document hosts. |
| `contentFormat` | `"markdown" \| "json" \| "html"` | `"markdown"` | `contentFormat="json"` | Serialization emitted by `onChange`/`onReady`. `"json"` is lossless for every node attribute; `"html"` is render-ready. |
| `onChange` | `(serialized: string) => void` | — | `(md) => save(md)` | Fires on every genuine edit (never on load/normalization) with the document in `contentFormat`. |
| `onReady` | `(serialized: string) => void` | — | `(md) => setBaseline(md)` | Fires once after init with the normalized serialization — persist this to avoid spurious dirty-state on reload. |
| `editable` | `boolean` | `true` | `editable={false}` | Read-only mode when `false` (shows a lock banner unless `preview`). |
| `authorName` | `string` | — | `"Priya Sharma"` | The document author's name, shown in the read-only banner ("Read-only document by …"). |
| `preview` | `boolean` | `false` | `preview` | Bare surface: no toolbar, banners, footer, or lightbox. For side-by-side panes. |
| `config` | `RDumpEditorConfig` | all on | `{{ features: { mermaid: false } }}` | Feature/UI/behavior flags — see [Config](#config). Compared by value; inline literals are fine. |
| `theme` | `"light" \| "dark" \| "auto"` | `"light"` | `theme="dark"` | Color scheme for this editor (chrome, content, and its popovers). `"auto"` follows the OS preference live — see [Theming](#theming). |
| `themeVars` | `RDumpThemeVars` | — | `{{ accent: "#7c3aed" }}` | Per-instance theme token overrides, applied as inline CSS variables on the wrapper. Beats all stylesheet layers. Full token list in [Theming](#theming). |
| `pages` | `PageRef[]` | — | `{[{ id: "p1", title: "Roadmap" }]}` | `{ id, title }` list backing `[[` page links and `@` page mentions. Live titles update as this changes. |
| `onOpenPage` | `(id: string) => void` | — | `(id) => router.push(\`/p/${id}\`)` | Called when a page-link chip is clicked. Absent ⇒ chips render but don't navigate. |
| `onUploadImage` | `(file: File) => Promise<{ url: string }>` | — | `(file) => api.upload(file)` | External image storage. Absent ⇒ images stay inline as base64. Files over `behavior.maxImageBytes` always inline. |
| `loadMentionUsers` | `() => Promise<MentionUser[]>` | — | `() => api.listPeople()` | `{ id, name, email }` list for `@` people mentions, fetched once and cached. Absent ⇒ pages-only mentions. |
| `notify` | `EditorNotify` | console | `myToastAdapter` | Toast sink: `info/success/warning/error(msg)` + `loading(msg) → { dismiss }`. |
| `extraExtensions` | `AnyExtension[]` | — | `{[PageBreak]}` | Host-authored Tiptap extensions — see [Custom extensions](#custom-extensions). Captured on mount; change `key` to swap. |
| `ref` | `Ref<EditorHandle>` | — | `ref={editorRef}` | Imperative export in any format: `getMarkdown()`, `getHTML()`, `getJSON()`, plus `tiptap` (the live instance) as an escape hatch. |

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

## Rendering serialized content

`getHTML()` output (or `contentFormat="html"` saves) can be rendered on pages
that never load the editor — and look exactly like it did in the editor —
with the standalone document skin:

```tsx
import "@rakshamlabs/rdump-editor/content.css"; // theme tokens + document skin, no chrome

<div className="rdump-content" data-rdump-color-scheme="light"
     dangerouslySetInnerHTML={{ __html: savedHtml }} />
```

- `content.css` is the same stylesheet the editor's writing surface uses (its
  ProseMirror root carries `rdump-content` too), so editor and rendered page
  can't drift apart. It contains zero chrome — no toolbar, menus, or popover
  CSS — and weighs a fraction of `styles.css`.
- `data-rdump-color-scheme` (`"light" | "dark" | "auto"`) picks the palette,
  same as the editor's `theme` prop. Tokens overridden on your `:root` apply
  here exactly as they do in the editor — see [Theming](#theming).
- Don't import `content.css` on pages that already import `styles.css` —
  `styles.css` includes all of it.
- Sanitizing hosts: the skin keys off stable hooks in the serialized HTML —
  `class` values starting with `rdump-` plus `data-type`, `data-variant`,
  `data-checked`, `data-align`, and `data-latex` — keep those (and `<details
  open>`, image `width`/`height`) through your sanitizer.
- If the content can contain math, also import `katex/dist/katex.min.css`.

## Config

```ts
config = {
  features: {
    // all default true; false removes the feature AND skips its download
    images, tables, taskLists, codeBlocks,
    math,      // KaTeX (bring katex/dist/katex.min.css yourself)
    mermaid,   // diagram library loads only when a diagram renders
    charts,    // recharts loads only when a chart renders
    callouts, hashtags,
    collapsible, // "Toggle" expand/collapse blocks
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

## Theming

```tsx
<RDumpEditor theme="dark" … />                          // "light" (default) | "dark" | "auto"
<RDumpEditor themeVars={{ accent: "#7c3aed" }} … />     // per-instance token overrides
```

`theme="auto"` follows the OS preference. Both palettes ship in one
stylesheet: the light tokens sit on `:root`, and the dark palette is
re-declared under the wrapper's `data-rdump-color-scheme` attribute (which
the `theme` prop controls), so the editor — including its popovers — flips
with the prop. Native controls like task checkboxes follow via
`color-scheme`. (Deliberately not `light-dark()` pairs at `:root`: CSS
processors that polyfill `light-dark()`, like Lightning CSS under
Next.js/Turbopack, break custom properties declared outside a
`color-scheme` scope — see the header of `theme.css`.)

Customization layers:

1. **Built-in palettes** — nothing to do.
2. **App-wide CSS** — the tokens are declared at zero specificity
   (`:where(:root)`), so defining any of them in your own CSS wins for the
   light palette; retheme the dark palette on the attribute selector:

   ```css
   :root {
     --accent: #7c3aed;                       /* light palette (and dark, if you don't override below) */
   }
   [data-rdump-color-scheme="dark"] {
     --accent: #a78bfa;                       /* dark palette */
   }
   ```

3. **`themeVars` prop** — inline overrides on that one editor instance,
   beating both stylesheets. Keys are the token names without `--`
   (typed as `RDumpThemeVars`); values are raw CSS — a color, a
   `light-dark()` pair, a shadow list, a font stack.

### Theme tokens

Every token accepted by `themeVars` (and overridable as `--<token>` in CSS),
with the built-in defaults per scheme:

| Token | Light default | Dark default | Controls |
| --- | --- | --- | --- |
| `background` | `#ffffff` | `#0e0e11` | Editor surface behind the content. |
| `panel` | `#ffffff` | `#16161a` | Toolbar, popovers, menus, dropdowns. |
| `panel-subtle` | `#fafafa` | `#1b1b20` | Slightly recessed panels (default callout, table headers). |
| `foreground` | `#171717` | `#ededef` | Primary text; fill of active/inverted chips. |
| `foreground-soft` | `#2c2c2c` | `#d4d4d9` | Secondary long-form text (context menu items). |
| `muted` | `#737373` | `#8f8f98` | Hint/placeholder text, inactive icons, blockquote bar. |
| `muted-strong` | `#525252` | `#b9b9c1` | Stronger secondary text, default icon color. |
| `muted-bg` | `#f5f5f5` | `#232329` | Hover fills and subtle tints. |
| `border` | `#e5e5e5` | `#2b2b32` | Default hairlines and outlines. |
| `border-strong` | `#d4d4d4` | `#3a3a43` | Emphasized hairlines (dividers, `hr`, resize handles). |
| `accent` | `#3b82f6` | `#60a5fa` | Links, active states, primary buttons, focus rings. |
| `accent-hover` | `#2563eb` | `#93c5fd` | Hover shade of accent elements. |
| `accent-soft` | `#eff6ff` | `rgba(96, 165, 250, 0.14)` | Tinted accent fills (active menu items, selected rows). |
| `accent-soft-strong` | `#dbeafe` | `rgba(96, 165, 250, 0.28)` | Stronger accent tint (info callout border). |
| `accent-fg` | `#ffffff` | `#0a0a0a` | Text/icon on accent-filled elements. |
| `accent-text` | `#1e40af` | `#93c5fd` | Accent-tinted text (link chips, mentions). |
| `danger` | `#dc2626` | `#f87171` | Destructive text/icons (delete actions, danger callout). |
| `danger-soft` | `#fef2f2` | `rgba(248, 113, 113, 0.14)` | Danger tint fill. |
| `danger-soft-strong` | `#fecaca` | `rgba(248, 113, 113, 0.3)` | Danger border tint. |
| `warning` | `#b45309` | `#fbbf24` | Warning text (warning callout, long-doc banner). |
| `warning-soft` | `#fef3c7` | `rgba(251, 191, 36, 0.14)` | Warning tint fill. |
| `warning-soft-strong` | `#fde68a` | `rgba(251, 191, 36, 0.3)` | Warning border tint. |
| `success` | `#047857` | `#34d399` | Success text (success callout). |
| `success-soft` | `#ecfdf5` | `rgba(52, 211, 153, 0.14)` | Success tint fill. |
| `success-soft-strong` | `#bbf7d0` | `rgba(52, 211, 153, 0.3)` | Success border tint. |
| `radius-sm` | `4px` | same | Corner radius of small controls (buttons, chips). |
| `radius-md` | `6px` | same | Corner radius of inputs and menu items. |
| `radius-lg` | `8px` | same | Corner radius of popovers, cards, code blocks. |
| `shadow-popover` | layered, `rgba(15, 23, 42, …)` | layered, `rgba(0, 0, 0, …)` | Dropdown & popover shadow (full value in `theme.css`). |
| `shadow-float` | `0 8px 32px rgba(15, 23, 42, 0.18)` | `0 8px 32px rgba(0, 0, 0, 0.65)` | Larger floating-overlay shadow (lightbox, drag previews). |
| `duration-fast` | `120ms` | same | Micro-transition duration for hovers/toggles. |
| `font-sans` | system UI stack | same | UI and content type stack. |
| `font-mono` | system mono stack | same | Code type stack (inline code, code blocks, markdown pane). |

Example — a violet brand accent with a warmer dark surface, app-wide:

```css
:root {
  --accent: #7c3aed;
  --accent-hover: #6d28d9;
  --accent-soft: #f5f3ff;
}
[data-rdump-color-scheme="dark"] {
  --accent: #a78bfa;
  --accent-hover: #c4b5fd;
  --accent-soft: rgba(167, 139, 250, 0.14);
  --background: #131017;
}
```

Or the same for one instance via the prop:

```tsx
<RDumpEditor
  themeVars={{
    accent: "light-dark(#7c3aed, #a78bfa)",
    "radius-lg": "12px",
    "font-mono": "'Fira Code', ui-monospace, monospace",
  }}
  …
/>
```

## Custom extensions

```tsx
import { Node, mergeAttributes } from "@rakshamlabs/rdump-editor"; // NOT from @tiptap/core

const PageBreak = Node.create({ /* … */ });

<RDumpEditor extraExtensions={[PageBreak]} … />
```

Import Tiptap primitives from this package, not from `@tiptap/*` directly —
the package vendors its entire Tiptap/ProseMirror graph, so a separately
installed `@tiptap/*` would be a second ProseMirror instance with subtle
schema breakage.

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
