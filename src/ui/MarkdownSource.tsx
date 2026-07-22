"use client";

import type { Editor as CoreEditor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getEditorMarkdown } from "../core/markdown";

// Raw-markdown pane. Mirrors the editor's serialized markdown into a textarea
// and, while it's edited, re-parses the text back into the shared editor —
// which means the rich pane (in split view) and the persisted document update
// from markdown edits exactly as they would from rich-editor edits.
export function MarkdownSource({
  editor,
  editable,
  onFocusChange,
}: {
  editor: CoreEditor;
  editable: boolean;
  onFocusChange: (focused: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => getEditorMarkdown(editor));
  const draftRef = useRef(draft);
  const focusedRef = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest draft reachable from blur/unmount flush handlers without
  // re-binding them on every keystroke.
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // tiptap-markdown's setContent override parses the string as markdown.
  // emitUpdate routes it through the editor's onUpdate → onChange so a
  // markdown edit is saved exactly like a rich-editor change.
  const push = useCallback(
    (markdown: string) => {
      if (pushTimer.current) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      if (!editable) return;
      editor.commands.setContent(markdown, { emitUpdate: true });
    },
    [editable, editor],
  );

  // Mirror editor → textarea on every editor update, but never while the user
  // is typing here (that would clobber the in-flight edit). This is what makes
  // the source pane track rich-editor edits live in split view.
  useEffect(() => {
    const sync = () => {
      if (focusedRef.current) return;
      setDraft(getEditorMarkdown(editor));
    };
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor]);

  // Flush a pending debounced edit if the pane unmounts before it lands (e.g.
  // switching straight back to the rich editor without blurring first).
  useEffect(() => {
    return () => {
      if (pushTimer.current) push(draftRef.current);
    };
  }, [push]);

  // Unmounting while focused (switching out of split view mid-edit) skips the
  // blur handler, so clear the reported focus here — otherwise the toolbar would
  // stay disabled the next time this pane remounts.
  useEffect(() => {
    return () => onFocusChange(false);
  }, [onFocusChange]);

  return (
    <div className="rdump-md-pane">
      <textarea
        className="rdump-md-source"
        value={draft}
        readOnly={!editable}
        spellCheck={false}
        placeholder="Markdown source…"
        aria-label="Markdown source"
        onFocus={() => {
          focusedRef.current = true;
          onFocusChange(true);
        }}
        onBlur={() => {
          focusedRef.current = false;
          onFocusChange(false);
          push(draftRef.current);
          // Re-show the editor's normalized serialization once edits settle.
          setDraft(getEditorMarkdown(editor));
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (!editable) return;
          if (pushTimer.current) clearTimeout(pushTimer.current);
          pushTimer.current = setTimeout(() => {
            pushTimer.current = null;
            editor.commands.setContent(next, { emitUpdate: true });
          }, 400);
        }}
      />
    </div>
  );
}
