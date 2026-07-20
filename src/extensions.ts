import { Extension, markInputRule, type AnyExtension } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import type { ResolvedEditorConfig } from "./config";
import { RuntimeBridge, type EditorRuntime } from "./runtime";
import { SlashCommand } from "./SlashCommand";

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
  const [images, code, tasks, tables, details, math, mentions, callouts, hashtags, pageLinks, mermaid, charts, fencedSwap] =
    await Promise.all([
      f.images ? import("./featureImages").then((m) => m.create()) : none,
      f.codeBlocks ? import("./featureCode").then((m) => m.create()) : none,
      f.taskLists ? import("./featureTasks").then((m) => m.create()) : none,
      f.tables ? import("./featureTables").then((m) => m.create()) : none,
      f.details ? import("./featureDetails").then((m) => m.create()) : none,
      f.math ? import("./featureMath").then((m) => m.create()) : none,
      f.mentions ? import("./featureMentions").then((m) => m.create()) : none,
      f.callouts ? import("./Callout").then((m) => [m.Callout]) : none,
      f.hashtags ? import("./Hashtag").then((m) => [m.Hashtag]) : none,
      f.pageLinks ? import("./PageLink").then((m) => [m.PageLink]) : none,
      f.mermaid ? import("./MermaidBlock").then((m) => [m.MermaidBlock]) : none,
      f.charts ? import("./ChartBlock").then((m) => [m.ChartBlock]) : none,
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
      // With code blocks on, the lowlight-powered node (in featureCode)
      // replaces StarterKit's. With them off, StarterKit's plain codeBlock
      // stays so fenced code — including degraded mermaid/chart fences —
      // survives the markdown round-trip.
      ...(f.codeBlocks ? { codeBlock: false as const } : {}),
      heading: { levels: cfg.behavior.headingLevels },
      link: false,
      underline: false,
    }),
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
    ...details,
    ...math,
    ...mentions,
    ...callouts,
    ...hashtags,
    ...pageLinks,
    ...mermaid,
    ...charts,
    ...fencedSwap,
    ...(cfg.ui.slashMenu ? [SlashCommand] : []),
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
