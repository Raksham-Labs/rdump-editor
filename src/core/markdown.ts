import type { Content, Editor as CoreEditor } from "@tiptap/core";

// The serialization the editor emits through onChange/onReady. Markdown is
// the default and the most portable; json (stringified Tiptap JSON) is
// lossless for every node attribute; html is render-ready output.
export type ContentFormat = "markdown" | "json" | "html";

export function serializeDoc(editor: CoreEditor, format: ContentFormat): string {
  if (format === "json") return JSON.stringify(editor.getJSON());
  if (format === "html") return editor.getHTML();
  return getEditorMarkdown(editor);
}

// Reads serialized markdown from the editor's tiptap-markdown storage.
// Falls back to the HTML representation if the extension hasn't installed
// its storage yet — shouldn't happen in practice (it's available from
// onBeforeCreate onward) but the typed access is defensive against
// initialization races.
export function getEditorMarkdown(editor: CoreEditor): string {
  const md = (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown;
  return md?.getMarkdown?.() ?? editor.getHTML();
}

// Routes a stored content string to the right Tiptap input shape based on
// the leading character:
//   `{` / `[` → legacy Tiptap JSON (parse and hand the object to setContent,
//               which bypasses the markdown parser).
//   `<`       → legacy HTML (passes through markdown-it as a block-HTML
//               literal because the Markdown extension runs with html:true).
//   anything  → markdown (Markdown extension's setContent override parses).
// Input format is detected independently of contentFormat, so any stored
// format transparently converts to the configured output format on next save.
export function parseStoredContent(content: string): Content {
  if (!content) return "";
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(content) as Content;
    } catch {
      // Fall through — leading `{` in a markdown body is unusual but valid.
    }
  }
  return content;
}
