"use client";

import type { AnyExtension, Editor as CoreEditor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Lock } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { BlockGutter } from "./BlockGutter";
import { BubbleBar } from "./BubbleBar";
import type { ResolvedEditorConfig } from "../config";
import type { RDumpEditorTheme } from "../theme";
import { EditorFooter } from "./EditorFooter";
import { EDIT_MATH_EVENT, OPEN_IMAGE_PICKER_EVENT } from "../core/events";
import { ImagePopover } from "../features/images/ImagePopover";
import { insertImageFile, looksLikeImageFile } from "../features/images/imageInsert";
import {
  getEditorMarkdown,
  parseStoredContent,
  serializeDoc,
  type ContentFormat,
} from "../core/markdown";
import { MarkdownSource } from "./MarkdownSource";
import { migrateInlineImages } from "../features/images/migrateInlineImages";
import { containsMarkdownExtras, rewriteTaskListHTML } from "../core/pasteTransforms";
import { LinkPopover } from "./LinkPopover";
import { MathPopover, type MathEditTarget } from "../features/math/MathPopover";
import { MediaLightbox, openMediaLightbox } from "./MediaLightbox";
import { MentionHoverCard } from "../features/mentions/MentionHoverCard";
import { MediaZoomOverlay } from "./MediaZoomOverlay";
import { TableContextMenu } from "../features/tables/TableContextMenu";
import { TableHoverControls } from "../features/tables/TableHoverControls";
import { EditorToolbar } from "./Toolbar";
import { ViewModeSwitch, isViewMode, type ViewMode } from "./ViewModeSwitch";

// Imperative access to the live document, independent of the contentFormat
// chosen for onChange. Obtained via the `ref` prop on the editor component.
export interface EditorHandle {
  getMarkdown: () => string;
  getHTML: () => string;
  getJSON: () => ReturnType<CoreEditor["getJSON"]>;
  // Escape hatch: the live Tiptap instance (null until initialized).
  tiptap: CoreEditor | null;
}

export interface EditorChromeProps {
  documentId: string;
  initialContent: string;
  editable: boolean;
  authorName?: string;
  preview: boolean;
  config: ResolvedEditorConfig;
  // Color scheme carried as data-rdump-color-scheme on the wrapper; the
  // token layer (styles/theme.css) resolves light-dark() pairs against it.
  theme: RDumpEditorTheme;
  // Inline --token overrides from the themeVars prop, already converted.
  themeStyle?: CSSProperties;
  contentFormat: ContentFormat;
  // Fully-assembled extension list from loadExtensions(); identity changes
  // rebuild the Tiptap instance.
  extensions: AnyExtension[];
  onChange?: (serialized: string) => void;
  onReady?: (serialized: string) => void;
  handleRef?: Ref<EditorHandle>;
}

export function EditorChrome({
  documentId,
  initialContent,
  editable,
  authorName,
  preview,
  config,
  theme,
  themeStyle,
  contentFormat,
  extensions,
  onChange,
  onReady,
  handleRef,
}: EditorChromeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [linkEditing, setLinkEditing] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [mathTarget, setMathTarget] = useState<MathEditTarget | null>(null);
  // True while the cursor is in the raw-markdown pane (split view). The toolbar
  // formats the rich-editor selection, which the user isn't editing right now —
  // so we disable it to avoid silently mutating the doc behind the markdown they
  // have focused.
  const [markdownFocused, setMarkdownFocused] = useState(false);
  const { features, ui, behavior } = config;
  // Restore the persisted view. Safe to read storage in the initializer: the
  // editor mounts with immediatelyRender:false, so the toolbar/switch only
  // ever render on the client (after the editor exists) — there's no
  // server-rendered switch markup to mismatch against on hydration.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "editor";
    if (!behavior.persistViewModeKey) return "editor";
    const saved = window.localStorage.getItem(behavior.persistViewModeKey);
    return isViewMode(saved) ? saved : "editor";
  });
  const persistViewModeKey = behavior.persistViewModeKey;
  const changeView = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (!persistViewModeKey) return;
      try {
        window.localStorage.setItem(persistViewModeKey, mode);
      } catch {
        // Private-mode / disabled storage — mode still applies for this session.
      }
    },
    [persistViewModeKey],
  );
  const openLinkEditor = useCallback(() => setLinkEditing(true), []);
  const openImagePicker = useCallback(() => setImagePickerOpen(true), []);
  const closeImagePicker = useCallback(() => setImagePickerOpen(false), []);
  const closeMathEditor = useCallback(() => setMathTarget(null), []);

  useEffect(() => {
    if (!features.images) return;
    const handler = () => setImagePickerOpen(true);
    window.addEventListener(OPEN_IMAGE_PICKER_EVENT, handler);
    return () => window.removeEventListener(OPEN_IMAGE_PICKER_EVENT, handler);
  }, [features.images]);

  useEffect(() => {
    if (!features.math) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<MathEditTarget>).detail;
      if (detail) setMathTarget(detail);
    };
    window.addEventListener(EDIT_MATH_EVENT, handler);
    return () => window.removeEventListener(EDIT_MATH_EVENT, handler);
  }, [features.math]);

  // Tracks the markdown we last reported via onChange so we can distinguish
  // "echo of our own keystroke flowing back through host state" from
  // "external content arrived from a pull / cache hydrate". Without this
  // every onUpdate would loop back as an external setContent.
  const lastEmittedRef = useRef<string>(initialContent);

  // True from editor construction until the first animation frame after it.
  // Some extensions (images with measured dimensions, Mermaid, Callout, …)
  // dispatch a transaction shortly *after* onCreate, so Tiptap fires onUpdate
  // with a re-serialized (normalized) body before the user has touched
  // anything. That normalization is not an edit — swallowing it keeps a doc
  // from flipping to "draft" the instant it loads (notably after a conflict
  // resolve, where the body we just saved gets re-normalized on reload).
  const initializingRef = useRef(true);

  // Paste/drop handlers run after the editor is constructed, but they're
  // installed inside editorProps at construction time — chicken-and-egg.
  // Use a ref that the useEffect below populates once `editor` exists.
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // One-shot per doc instance (the editor remounts per doc via key={doc.id}):
  // the first genuine user edit triggers legacy inline-image migration, so
  // the rewrites ride the same dirty state and save with the user's change.
  // Docs that are only read are never touched.
  const migrationTriggeredRef = useRef(false);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions,
      content: parseStoredContent(initialContent),
      editorProps: {
        attributes: {
          // rdump-editor = column layout + editing affordances (Editor.css);
          // rdump-content = the shared document skin (styles/content.css)
          // that hosts also put on wrappers around serialized HTML.
          class: "rdump-editor rdump-content",
          spellcheck: "true",
        },
        // Double-click an image to open it in the fullscreen zoom/pan viewer.
        // Single click is left to ProseMirror for node selection / resizing.
        handleDoubleClickOn: (_view, _pos, node) => {
          if (node.type.name === "image" && node.attrs?.src) {
            openMediaLightbox({
              kind: "image",
              src: node.attrs.src as string,
              alt: (node.attrs.alt as string | null) ?? undefined,
            });
            return true;
          }
          return false;
        },
        transformPastedHTML: (html) => rewriteTaskListHTML(html),
        handlePaste: (_view, event) => {
          const ed = editorRef.current;
          if (!ed) return false;
          const clipboard = (event as ClipboardEvent).clipboardData;
          if (features.images) {
            const files = Array.from(clipboard?.files ?? []);
            const images = files.filter(looksLikeImageFile);
            if (images.length > 0) {
              event.preventDefault();
              images.forEach((file) => insertImageFile(ed, file));
              return true;
            }
          }
          // When the clipboard has both plain-text markdown and an HTML
          // wrapper (VS Code, IDEs, even Tiptap-rendered MD viewers), HTML
          // wins by default but the HTML typically loses markdown features
          // like task list checkboxes (which appear as literal `[ ]` text).
          // If the plain text has markdown markers, force the plain-text
          // path through the Markdown extension's parser so we get rich
          // content for the full markdown surface, not just tasks + tables.
          const text = clipboard?.getData("text/plain") ?? "";
          if (containsMarkdownExtras(text)) {
            const mdParser = (
              ed.storage as {
                markdown?: { parser?: { parse: (input: string) => string } };
              }
            ).markdown?.parser;
            if (mdParser) {
              event.preventDefault();
              ed.commands.insertContent(mdParser.parse(text));
              return true;
            }
          }
          return false;
        },
        handleDrop: (view, event) => {
          const ed = editorRef.current;
          if (!ed || !features.images) return false;
          const dragEvent = event as DragEvent;
          const files = Array.from(dragEvent.dataTransfer?.files ?? []);
          const images = files.filter(looksLikeImageFile);
          if (images.length === 0) return false;
          const coords = view.posAtCoords({
            left: dragEvent.clientX,
            top: dragEvent.clientY,
          });
          event.preventDefault();
          images.forEach((file) => insertImageFile(ed, file, { at: coords?.pos }));
          return true;
        },
      },
      onCreate: ({ editor }) => {
        // Snapshot the editor's serialization once it's fully constructed.
        // Some extensions (Mathematics, Mermaid, Callout, etc.) run a
        // transaction in their onCreate which causes Tiptap to fire onUpdate
        // before the user has touched anything. By baselining against the
        // post-init serialization, those re-emits compare equal and are
        // filtered out.
        const md = serializeDoc(editor, contentFormat);
        lastEmittedRef.current = md;
        initializingRef.current = true;
        // Close the init window after the first frame: any later onUpdate is a
        // genuine edit (a human can't type within a frame, and programmatic
        // content swaps below use emitUpdate:false). The external-content sync
        // effect re-baselines without emitting, so nothing legitimate needs an
        // onChange in this window.
        requestAnimationFrame(() => {
          initializingRef.current = false;
        });
        onReady?.(md);
      },
      onUpdate: ({ editor }) => {
        const md = serializeDoc(editor, contentFormat);
        if (md === lastEmittedRef.current) return;
        lastEmittedRef.current = md;
        // Swallow the editor's own post-load normalization so it doesn't read
        // as a user edit and dirty the doc on mount.
        if (initializingRef.current) return;
        onChange?.(md);
        // First real edit of this session: migrate any legacy base64 images
        // so they save together with the user's change. Preview panes
        // (conflict resolver panes) must render content exactly as given, and
        // editor.isEditable is checked live rather than via the prop closure.
        if (
          features.images &&
          !preview &&
          editor.isEditable &&
          !migrationTriggeredRef.current
        ) {
          migrationTriggeredRef.current = true;
          void migrateInlineImages(editor, documentId);
        }
      },
    },
    [documentId, extensions, contentFormat],
  );

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useImperativeHandle(
    handleRef,
    () => ({
      getMarkdown: () => (editor ? getEditorMarkdown(editor) : ""),
      getHTML: () => editor?.getHTML() ?? "",
      getJSON: () =>
        editor?.getJSON() ??
        // Pre-init placeholder; real callers read this after mount.
        ({ type: "doc", content: [] } as unknown as ReturnType<CoreEditor["getJSON"]>),
      tiptap: editor ?? null,
    }),
    [editor],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  // Reset the echo baseline when the open doc changes — the new editor
  // instance starts at the new initialContent, so any later prop change is
  // a true external update.
  useEffect(() => {
    lastEmittedRef.current = initialContent;
    // Intentionally only depend on documentId: this is a per-doc baseline
    // reset, not a content sync (that effect lives below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // External content sync: when the host hands us a new `initialContent`
  // that didn't come from our own onUpdate, push it into the editor without
  // emitting an update (we'd loop back into onChange and mark the doc dirty).
  // Hosts are expected to filter out updates while local edits are unsaved,
  // so by the time a new content prop lands here it's safe to apply.
  useEffect(() => {
    if (!editor) return;
    if (initialContent === lastEmittedRef.current) return;
    editor.commands.setContent(parseStoredContent(initialContent), { emitUpdate: false });
    // Re-baseline from the editor's own serialization. setContent on a
    // legacy-format body comes back out re-serialized in contentFormat, so a
    // direct string compare against `initialContent` would mis-fire on the
    // next onUpdate.
    lastEmittedRef.current = serializeDoc(editor, contentFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, editor]);

  if (!editor) {
    return <div className="rdump-editor__loading">Loading editor…</div>;
  }

  // Preview surfaces (conflict-resolver-style panes) always show the rich
  // editor only — they supply their own chrome and never the view switch.
  // With markdownView off there's no switch either, so the rich editor is
  // the only pane.
  const effectiveView: ViewMode = preview || !ui.markdownView ? "editor" : viewMode;
  const showEditorPane = effectiveView !== "markdown";
  const showMarkdownPane = effectiveView !== "editor";
  const showTopbar = !preview && (ui.toolbar || ui.markdownView);

  return (
    <div className="rdump-editor-wrap" data-rdump-color-scheme={theme} style={themeStyle}>
      {showTopbar ? (
        <div className="rdump-editor-topbar">
          {effectiveView === "markdown" ? (
            <span className="rdump-editor-topbar__title">Markdown source</span>
          ) : ui.toolbar ? (
            <EditorToolbar
              editor={editor}
              config={config}
              disabled={!editable || (effectiveView === "split" && markdownFocused)}
              onRequestLink={openLinkEditor}
              onRequestImage={openImagePicker}
            />
          ) : (
            <span />
          )}
          {ui.markdownView ? <ViewModeSwitch value={viewMode} onChange={changeView} /> : null}
        </div>
      ) : null}

      <div className="rdump-editor-panes" data-view={effectiveView}>
        {showEditorPane ? (
          <div className="rdump-editor-scroll" ref={scrollRef}>
            {!editable && !preview ? (
              <div className="rdump-editor__readonly-banner">
                <Lock size={14} />
                <span>
                  Read-only document{authorName ? ` by ${authorName}.` : "."}
                </span>
              </div>
            ) : null}

            {editable && ui.dragHandle ? <BlockGutter editor={editor} /> : null}

            {ui.bubbleMenu ? (
              <BubbleMenu editor={editor} className="rdump-bubble">
                <BubbleBar editor={editor} config={config} onRequestLink={openLinkEditor} />
              </BubbleMenu>
            ) : null}

            {editable ? (
              <LinkPopover
                editor={editor}
                editing={linkEditing}
                onEditingChange={setLinkEditing}
              />
            ) : null}

            {editable && features.images ? (
              <ImagePopover
                editor={editor}
                open={imagePickerOpen}
                onClose={closeImagePicker}
              />
            ) : null}

            {editable && features.math ? (
              <MathPopover editor={editor} target={mathTarget} onClose={closeMathEditor} />
            ) : null}

            {/* Informational only — shown for readers too, so not gated on editable. */}
            {features.mentions ? <MentionHoverCard editor={editor} /> : null}

            <EditorContent
              editor={editor}
              className="rdump-editor-shell"
              onMouseDown={(event) => {
                if (!editable) return;
                // Click landed on the shell padding, not the content itself.
                if (event.target !== event.currentTarget) return;
                // Only treat clicks in the empty band *below* the last block as
                // "append at the end" (Notion-style). Clicks in the top padding
                // or the side margins beside existing content sit above the
                // content's bottom edge and should do nothing.
                const contentBottom = editor.view.dom.getBoundingClientRect().bottom;
                if (event.clientY < contentBottom) return;
                event.preventDefault();
                editor.chain().focus("end").run();
              }}
            />

            {features.tables ? (
              <TableHoverControls editor={editor} scrollRef={scrollRef} />
            ) : null}
            {features.tables ? (
              <TableContextMenu editor={editor} scrollRef={scrollRef} />
            ) : null}
            {preview ? null : <MediaZoomOverlay scrollRef={scrollRef} />}
          </div>
        ) : null}

        {showMarkdownPane ? (
          <MarkdownSource
            editor={editor}
            editable={editable}
            onFocusChange={setMarkdownFocused}
          />
        ) : null}
      </div>

      {!preview && ui.footer ? (
        <EditorFooter editor={editor} longDocWarningChars={behavior.longDocWarningChars} />
      ) : null}
      {/* Single instance: gated to non-preview editors so side-by-side panes
          (e.g. a conflict resolver) don't all answer the same open event. */}
      {preview ? null : <MediaLightbox />}
    </div>
  );
}
