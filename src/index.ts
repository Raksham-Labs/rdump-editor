// @rakshamlabs/rdump-editor — public API.
//
// The default theme tokens load first so the component CSS that follows can
// rely on them; a host's own :root definitions always win (theme.css uses
// zero-specificity :where()).
import "./styles/theme.css";
// Document skin next, chrome CSS after it — editor-side overrides of shared
// content rules (e.g. the code block node view's inner <pre>) depend on this
// order at equal specificity. Also published standalone as content.css for
// hosts that render serialized content without the editor.
import "./styles/content.css";

export { Editor as RDumpEditor } from "./Editor";
export type {
  ContentFormat,
  EditorHandle,
  EditorProps as RDumpEditorProps,
} from "./Editor";
export type { RDumpEditorConfig } from "./config";
export type { RDumpEditorTheme, RDumpThemeVars, ThemeTokenName } from "./theme";
export type {
  EditorNotify,
  MentionUser,
  NotifyLoadingHandle,
  PageRef,
} from "./runtime";
export { EDIT_MATH_EVENT, OPEN_IMAGE_PICKER_EVENT } from "./core/events";

// Tiptap primitives re-exported so hosts can author extraExtensions against
// the package's own Tiptap instance — installing @tiptap/* separately risks
// a second ProseMirror copy and subtle schema breakage.
export {
  Extension,
  InputRule,
  Mark,
  Node,
  mergeAttributes,
  markInputRule,
  nodeInputRule,
} from "@tiptap/core";
export type { AnyExtension, Editor as TiptapEditor } from "@tiptap/core";
