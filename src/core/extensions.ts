import { Extension, markInputRule, type AnyExtension } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { AlignedHeading, AlignedParagraph } from "./AlignedText";
import type { ResolvedEditorConfig } from "../config";
import { RuntimeBridge, type EditorRuntime } from "../runtime";
import { SlashCommand } from "../ui/SlashCommand";

// The codeBlocks-off fallback. Fenced code in existing markdown (including
// degraded mermaid/chart fences) must still parse and serialize, so the node
// stays in the schema — but the language header / highlighting UI lives in
// the gated codeBlocks feature module, so nothing should offer *creating*
// one: the
// toolbar / slash menu / turn-into gate on the flag, and this strips the
// ``` input rule and the toggle shortcut. Exit/navigation shortcuts stay so
// blocks parsed from markdown remain editable.
const PlainCodeBlock = CodeBlock.extend({
  addInputRules() {
    return [];
  },
  addKeyboardShortcuts() {
    const shortcuts = { ...this.parent?.() };
    delete shortcuts["Mod-Alt-c"];
    return shortcuts;
  },
});

// See its entry in the extension list below for the why.
const CodeMarkExit = Extension.create({
  name: "codeMarkExit",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      ArrowRight: ({ editor }) => {
        const { state } = editor;
        const { empty, $from } = state.selection;
        if (!empty) return false;
        const code = state.schema.marks.code;
        if (!code) return false;
        const marks = state.storedMarks ?? $from.marks();
        if (!code.isInSet(marks)) return false;
        // Anywhere before the end of the block, normal caret movement
        // already leads out of the mark — only the trapped case is ours.
        if ($from.parentOffset < $from.parent.content.size) return false;
        editor.view.dispatch(state.tr.removeStoredMark(code));
        return true;
      },
    };
  },
});

// Assembles the extension list for a config. Feature modules are imported
// dynamically and ONLY when their flag is on — that's what keeps heavy
// dependencies (katex via the math module, lowlight via code blocks, mermaid,
// recharts) out of the bundle for hosts that don't enable them. The imports
// all start in parallel; assembly awaits them together.
//
// ORDER IS BEHAVIOR: input-rule precedence and plugin order follow array
// order, and the Markdown extension must come last so every node's markdown
// storage is registered before it wires serialization. Keep the sequence
// aligned with the original single-list version.
export async function loadExtensions(
  cfg: ResolvedEditorConfig,
  runtime: EditorRuntime,
  extra: AnyExtension[] = [],
): Promise<AnyExtension[]> {
  const f = cfg.features;
  const none: AnyExtension[] = [];
  const [images, code, tasks, tables, collapsible, math, mentions, callouts, hashtags, pageLinks, mermaid, charts, fencedSwap] =
    await Promise.all([
      f.images ? import("../features/images/images").then((m) => m.create()) : none,
      f.codeBlocks ? import("../features/codeBlocks/codeBlocks").then((m) => m.create()) : [PlainCodeBlock],
      f.taskLists ? import("../features/taskLists/taskLists").then((m) => m.create()) : none,
      f.tables ? import("../features/tables/tables").then((m) => m.create()) : none,
      f.collapsible ? import("../features/collapsible/collapsible").then((m) => m.create()) : none,
      f.math ? import("../features/math/math").then((m) => m.create()) : none,
      f.mentions ? import("../features/mentions/mentions").then((m) => m.create()) : none,
      f.callouts ? import("../features/callouts/Callout").then((m) => [m.Callout]) : none,
      f.hashtags ? import("../features/hashtags/Hashtag").then((m) => [m.Hashtag]) : none,
      f.pageLinks ? import("../features/pageLinks/PageLink").then((m) => [m.PageLink]) : none,
      f.mermaid ? import("../features/mermaid/MermaidBlock").then((m) => [m.MermaidBlock]) : none,
      f.charts ? import("../features/charts/ChartBlock").then((m) => [m.ChartBlock]) : none,
      // Companion that swaps ```mermaid / ```chart code fences into their
      // node views as you type — only useful when either target node exists.
      f.mermaid || f.charts
        ? import("./FencedBlockSwap").then((m) => [m.FencedBlockSwap])
        : none,
    ]);

  return [
    // Inert carrier for the host integration callbacks; see runtime.ts.
    RuntimeBridge.configure({ runtime }),
    StarterKit.configure({
      // The codeBlock node never comes from StarterKit: with the flag on the
      // lowlight-powered node (features/codeBlocks) replaces it, with it off the
      // stripped-down PlainCodeBlock does (schema kept for the markdown
      // round-trip, creation affordances removed).
      codeBlock: false,
      // Replaced by AlignedParagraph/AlignedHeading below, which add the
      // markdown spelling for TextAlign's textAlign attribute.
      paragraph: false,
      heading: false,
      link: false,
      underline: false,
    }),
    AlignedParagraph,
    AlignedHeading.configure({ levels: cfg.behavior.headingLevels }),
    // Keyboard escape from inline code's trailing-edge trap: the mark is
    // inclusive (typing at its end must extend it — that's how you write
    // code), but at the end of a block that means every keystroke stays code
    // and only re-toggling gets you out. ArrowRight with nowhere left to go
    // clears the stored mark so the next character is plain. Lives in its
    // own high-priority extension: the Details extension also binds
    // ArrowRight and consumes it first at default priority, and raising the
    // Code mark's own priority would reorder mark rendering (a serialization
    // change).
    CodeMarkExit,
    Underline,
    // Sub/superscript can't stack on the same text (x can't be both an index
    // and an exponent) — the stock extensions don't exclude each other, so
    // toggling one on would otherwise silently keep the other.
    Subscript.extend({ excludes: "superscript" }),
    Superscript.extend({ excludes: "subscript" }),
    // Alignment for text blocks. Only paragraph/heading: markdown has no
    // alignment spelling, so aligned blocks serialize as raw HTML (see
    // AlignedText.ts) — keep the surface small. defaultAlignment stays null,
    // meaning untouched blocks carry no attribute and keep their stock
    // markdown spelling. The stock ⌘⇧L stores an explicit "left"; rebind it
    // to unset so "align left" means "back to normal flow", matching the
    // toolbar buttons (see alignment.ts).
    TextAlign.extend({
      addKeyboardShortcuts() {
        return {
          ...this.parent?.(),
          "Mod-Shift-l": () => this.editor.commands.unsetTextAlign(),
        };
      },
    }).configure({ types: ["heading", "paragraph"] }),
    // The bundled Highlight input rule requires the `==` to follow start-of-
    // line or whitespace, so `w==a==tt` never highlights mid-word. Override
    // with a permissive rule that matches `==…==` anywhere.
    Highlight.extend({
      addInputRules() {
        return [
          markInputRule({
            find: /(==([^=\n]+?)==)$/,
            type: this.type,
          }),
        ];
      },
    }).configure({ multicolor: true }),
    Typography,
    // The stock Link mark ties `inclusive` to `autolink` (see the extension's
    // `inclusive() { return this.options.autolink }`), so with autolink on the
    // mark is inclusive and typing right before/after a link keeps extending
    // it — the link "follows" the cursor with no easy way out. Force it
    // non-inclusive: pasted/typed URLs still autolink, but adjacent text you
    // type afterwards is never swept into the link. Standard editor behavior.
    Link.extend({
      inclusive() {
        return false;
      },
    }).configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      HTMLAttributes: {
        rel: "noreferrer",
        target: "_blank",
      },
    }),
    ...images,
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === "heading") return cfg.behavior.placeholder.heading;
        return cfg.behavior.placeholder.paragraph;
      },
    }),
    CharacterCount.configure({ limit: cfg.behavior.characterLimit }),
    ...code,
    ...tasks,
    ...tables,
    ...collapsible,
    ...math,
    ...mentions,
    ...callouts,
    ...hashtags,
    ...pageLinks,
    ...mermaid,
    ...charts,
    ...fencedSwap,
    ...(cfg.ui.slashMenu
      ? [
          SlashCommand.configure({
            features: cfg.features,
            headingLevels: cfg.behavior.headingLevels,
          }),
        ]
      : []),
    ...extra,
    // Markdown round-trip. `html: true` lets custom nodes (Callout, Mermaid,
    // Chart, Hashtag, Mention, resizable image with width attributes, etc.)
    // serialize as inline HTML inside the markdown body — lossless for now,
    // pretty per-node serializers can be layered on incrementally without
    // changing the storage contract.
    Markdown.configure({
      html: true,
      tightLists: true,
      bulletListMarker: "-",
      linkify: false,
      breaks: false,
      // Plain-text paste of raw markdown becomes rich content via
      // markdown-it. Note: when the clipboard contains both plain text and
      // HTML, HTML wins by default; the editor's handlePaste forces the
      // plain-text path when markdown markers are present.
      transformPastedText: true,
      transformCopiedText: false,
    }),
  ];
}
