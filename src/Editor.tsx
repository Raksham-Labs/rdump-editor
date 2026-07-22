"use client";

import type { AnyExtension } from "@tiptap/core";
import { useEffect, useId, useMemo, useRef, useState, type Ref } from "react";
import { resolveConfig, type RDumpEditorConfig } from "./config";
import { EditorChrome, type EditorHandle } from "./ui/EditorChrome";
import { loadExtensions } from "./core/extensions";
import type { ContentFormat } from "./core/markdown";
import {
  createDefaultRuntime,
  defaultNotify,
  type EditorNotify,
  type EditorRuntime,
  type MentionUser,
  type PageRef,
} from "./runtime";
import { setWorkspacePages } from "./core/workspacePages";
import { themeVarsToStyle, type RDumpEditorTheme, type RDumpThemeVars } from "./theme";
import "./Editor.css";

export type { RDumpEditorConfig } from "./config";
export type { EditorHandle } from "./ui/EditorChrome";
export type { ContentFormat } from "./core/markdown";
export type { EditorNotify, MentionUser, PageRef } from "./runtime";
export type { RDumpEditorTheme, RDumpThemeVars, ThemeTokenName } from "./theme";
// Re-exported for host code that listens for these editor events.
export { EDIT_MATH_EVENT, OPEN_IMAGE_PICKER_EVENT } from "./core/events";

export interface EditorProps {
  // Stable identity for the open document; keys the per-doc migration guard
  // and rebuilds the editor when it changes. Falls back to a React id for
  // hosts editing a single anonymous document.
  documentId?: string;
  // Accepts markdown, stringified Tiptap JSON, or HTML — the format is
  // auto-detected, independent of contentFormat.
  initialContent: string;
  editable?: boolean;
  // The document author's name, shown in the read-only banner.
  authorName?: string;
  // What onChange/onReady emit: "markdown" (default, canonical), "json"
  // (stringified Tiptap JSON — lossless for every node attribute), or "html".
  contentFormat?: ContentFormat;
  // Emits the document serialized as contentFormat on every genuine edit.
  onChange?: (serialized: string) => void;
  // Render a bare reading/editing surface: no toolbar, no read-only lock
  // banner. For side-by-side panes (e.g. a conflict resolver) that supply
  // their own labels and chrome.
  preview?: boolean;
  // Fires once with the post-init, normalized serialization as soon as the
  // editor is constructed. Lets a caller seed itself with the exact bytes
  // the editor will round-trip to, so a later reload doesn't drift into a
  // spurious dirty state.
  onReady?: (serialized: string) => void;
  // Structural configuration: feature flags (which gate lazy extension
  // loading), UI chrome, behavior numbers. Compared by value — inline object
  // literals are fine.
  config?: RDumpEditorConfig;
  // Color scheme: "light" (default), "dark", or "auto" (follow the OS).
  theme?: RDumpEditorTheme;
  // Per-instance theme token overrides (e.g. { accent: "#7c3aed" }). For
  // app-wide theming, defining the same --tokens in host CSS works too —
  // see theme.ts for the full layering story.
  themeVars?: RDumpThemeVars;
  // Workspace page list backing [[ page links and @ page mentions.
  pages?: PageRef[];
  // Navigate to another document when a page link / page mention is clicked.
  onOpenPage?: (docId: string) => void;
  // Stores an image externally and returns its URL. Absent ⇒ images stay
  // inline as base64.
  onUploadImage?: (file: File) => Promise<{ url: string }>;
  // Supplies the people list for @-mentions. Absent ⇒ pages-only mentions.
  loadMentionUsers?: () => Promise<MentionUser[]>;
  // Toast-style notification sink; defaults to console logging.
  notify?: EditorNotify;
  // Host-authored Tiptap extensions, appended before the markdown extension.
  // Captured on mount — swap the `key` to apply a different set.
  extraExtensions?: AnyExtension[];
  // On-demand export in any format (getMarkdown/getHTML/getJSON), plus the
  // raw Tiptap instance as an escape hatch.
  ref?: Ref<EditorHandle>;
}

export function Editor({
  documentId,
  initialContent,
  editable = true,
  authorName,
  contentFormat = "markdown",
  onChange,
  preview = false,
  onReady,
  config,
  theme = "light",
  themeVars,
  pages,
  onOpenPage,
  onUploadImage,
  loadMentionUsers,
  notify,
  extraExtensions,
  ref,
}: EditorProps) {
  const fallbackId = useId();
  const resolvedDocumentId = documentId ?? fallbackId;

  // Value-stable config resolution so a host passing an inline `config={{…}}`
  // literal doesn't rebuild the editor every render.
  const configKey = JSON.stringify(config ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolved = useMemo(() => resolveConfig(config), [configKey]);

  // ONE mutable runtime object for the editor's lifetime, its fields
  // refreshed from props after every render. Extension code reads it through
  // getRuntime(), so callbacks stay current without the extension list ever
  // rebuilding. Created lazily inside the effects (never during render); the
  // refresh effect is declared first so fields are fresh before the
  // extension load below ever observes them.
  const runtimeRef = useRef<EditorRuntime | undefined>(undefined);
  useEffect(() => {
    const runtime = (runtimeRef.current ??= createDefaultRuntime());
    runtime.uploadImage = onUploadImage;
    runtime.loadMentionUsers = loadMentionUsers;
    runtime.onOpenPage = onOpenPage;
    runtime.notify = notify ?? defaultNotify;
    runtime.maxImageBytes = resolved.behavior.maxImageBytes;
    runtime.config = resolved;
  });

  // Publish the host's page list to the module store the suggestion plugins
  // read from (they can't reach React context). Fingerprint-deduped inside,
  // so per-keystroke identity churn is cheap.
  useEffect(() => {
    if (pages) setWorkspacePages(pages);
  }, [pages]);

  // Feature modules load asynchronously (and only the enabled ones — that's
  // the lazy-import contract), so the Tiptap instance is created once the
  // assembled list lands. extraExtensions is captured on mount by design.
  const extraRef = useRef(extraExtensions);
  const [extensions, setExtensions] = useState<AnyExtension[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const runtime = (runtimeRef.current ??= createDefaultRuntime());
    void loadExtensions(resolved, runtime, extraRef.current ?? []).then((list) => {
      if (!cancelled) setExtensions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [resolved]);

  if (!extensions) {
    return <div className="rdump-editor__loading">Loading editor…</div>;
  }

  return (
    <EditorChrome
      documentId={resolvedDocumentId}
      initialContent={initialContent}
      editable={editable}
      authorName={authorName}
      preview={preview}
      config={resolved}
      theme={theme}
      themeStyle={themeVarsToStyle(themeVars)}
      contentFormat={contentFormat}
      extensions={extensions}
      onChange={onChange}
      onReady={onReady}
      handleRef={ref}
    />
  );
}
