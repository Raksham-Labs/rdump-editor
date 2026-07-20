"use client";

import { useEditorState, type Editor as CoreEditor } from "@tiptap/react";

export function EditorFooter({
  editor,
  longDocWarningChars,
}: {
  editor: CoreEditor | null;
  // Character count past which the "split into subpages" nudge shows;
  // `false` disables the nudge.
  longDocWarningChars: number | false;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      words: editor?.storage.characterCount?.words() ?? 0,
      chars: editor?.storage.characterCount?.characters() ?? 0,
    }),
  });
  if (!editor || !state) return null;
  const overLimit = longDocWarningChars !== false && state.chars > longDocWarningChars;
  return (
    <footer className="rdump-editor-footer">
      {overLimit ? (
        <span className="rdump-editor-footer__warning">
          This page is long — consider splitting into subpages to keep editing
          snappy.
        </span>
      ) : (
        <span />
      )}
      <span className="rdump-editor-footer__counts">
        <span>{state.words.toLocaleString()} words</span>
        <span>{state.chars.toLocaleString()} chars</span>
      </span>
    </footer>
  );
}
