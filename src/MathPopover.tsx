"use client";

import type { Editor } from "@tiptap/react";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { computeFloatingPosition } from "./floatingPosition";
import "./MathPopover.css";

export interface MathEditTarget {
  type: "inline" | "block";
  pos: number;
  latex: string;
}

interface MathPopoverProps {
  editor: Editor;
  target: MathEditTarget | null;
  onClose: () => void;
}

export function MathPopover({ editor, target, onClose }: MathPopoverProps) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) return;
    function onDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [target, onClose]);

  useLayoutEffect(() => {
    if (!target) return;
    const el = containerRef.current;
    if (!el) return;
    const nodeEl = editor.view.nodeDOM(target.pos) as HTMLElement | null;
    const anchorRect = nodeEl?.getBoundingClientRect();
    if (!anchorRect) return;
    const elRect = el.getBoundingClientRect();
    setPos(
      computeFloatingPosition(
        { left: anchorRect.left, top: anchorRect.top, bottom: anchorRect.bottom },
        { width: elRect.width, height: elRect.height },
      ),
    );
  }, [target, editor]);

  if (!target) return null;

  const apply = (rawLatex: string) => {
    const latex = rawLatex.trim();
    if (!latex) {
      // Empty input acts as delete — better than leaving an empty render.
      if (target.type === "block") {
        editor.chain().focus().deleteBlockMath({ pos: target.pos }).run();
      } else {
        editor.chain().focus().deleteInlineMath({ pos: target.pos }).run();
      }
      onClose();
      return;
    }
    if (target.type === "block") {
      editor.chain().focus().updateBlockMath({ latex, pos: target.pos }).run();
    } else {
      editor.chain().focus().updateInlineMath({ latex, pos: target.pos }).run();
    }
    onClose();
  };

  const remove = () => {
    if (target.type === "block") {
      editor.chain().focus().deleteBlockMath({ pos: target.pos }).run();
    } else {
      editor.chain().focus().deleteInlineMath({ pos: target.pos }).run();
    }
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="rdump-math-pop"
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 50,
      }}
    >
      <MathEditForm
        initialLatex={target.latex}
        kind={target.type}
        onSubmit={apply}
        onCancel={onClose}
        onDelete={remove}
      />
    </div>
  );
}

function MathEditForm({
  initialLatex,
  kind,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initialLatex: string;
  kind: "inline" | "block";
  onSubmit: (latex: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(initialLatex);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      className="rdump-math-pop__form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="rdump-math-pop__label">
        {kind === "block" ? "Block math (LaTeX)" : "Inline math (LaTeX)"}
      </div>
      <textarea
        ref={inputRef}
        rows={kind === "block" ? 3 : 2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter" && !event.shiftKey) {
            // Enter saves, Shift+Enter inserts a newline (useful for multi-line
            // LaTeX in block math, e.g. \begin{cases} blocks).
            event.preventDefault();
            onSubmit(draft);
          }
        }}
        placeholder="e.g. \frac{a}{b} + \sqrt{c}"
        className="rdump-math-pop__input"
        spellCheck={false}
      />
      <div className="rdump-math-pop__actions">
        <a
          className="rdump-math-pop__hint"
          href="https://katex.org/docs/supported.html"
          target="_blank"
          rel="noreferrer"
        >
          KaTeX cheatsheet ↗
        </a>
        <button
          type="button"
          className="rdump-math-pop__btn rdump-math-pop__btn--danger"
          onClick={onDelete}
          title="Remove this math node"
        >
          <Trash2 size={13} />
          Remove
        </button>
        <button
          type="submit"
          className="rdump-math-pop__btn rdump-math-pop__btn--primary"
        >
          <Check size={13} />
          Update
        </button>
      </div>
    </form>
  );
}
