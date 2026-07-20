"use client";

import { useEffect, useRef } from "react";
import "./BlockCaption.css";

// Optional figure-style caption shared by the chart and mermaid blocks. The
// "Add caption" affordance lives in each block's header (which flips `open`);
// this renders the editable field (a multiline textarea that auto-grows) or,
// in read-only mode, the caption text. Hidden when there's nothing to show.
export function BlockCaption({
  editable,
  open,
  value,
  autoFocus = false,
  placeholder = "Add a caption…",
  onChange,
  onClose,
}: {
  editable: boolean;
  open: boolean;
  value: string;
  autoFocus?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && autoFocus) ref.current?.focus();
  }, [open, autoFocus]);

  // Grow the textarea to fit its content (handles wrapped and hard-wrapped
  // lines) so multiline captions aren't trapped behind a scrollbar.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, open]);

  if (editable && open) {
    return (
      <textarea
        ref={ref}
        className="rdump-caption__input"
        value={value}
        rows={1}
        placeholder={placeholder}
        aria-label="Caption"
        spellCheck
        onChange={(event) => onChange(event.target.value)}
        // Don't let ProseMirror treat clicks/keystrokes as node selection or
        // editor shortcuts (the block is an atom node view). Enter then inserts
        // a newline in the textarea instead of running an editor command.
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        // Empty + blurred collapses back to the header's "Add caption" button.
        onBlur={() => {
          if (!value.trim()) onClose();
        }}
      />
    );
  }

  if (!editable && value.trim()) {
    return <figcaption className="rdump-caption">{value}</figcaption>;
  }

  return null;
}
