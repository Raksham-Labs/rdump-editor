"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { computeFloatingPosition } from "./floatingPosition";
import "./LinkPopover.css";

interface LinkPopoverProps {
  editor: Editor;
  /** Forced-open flag — driven by toolbar/bubble "Link" buttons. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

// Self-positioned floating popover (NOT a BubbleMenu plugin). The bundled
// BubbleMenu's `shouldShow` only re-evaluates on editor transactions, so
// flipping a React-side `editing` flag wouldn't open the popover until the
// user typed something. Rolling our own keeps open/close instantaneous.
export function LinkPopover({ editor, editing, onEditingChange }: LinkPopoverProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      linkActive: editor.isActive("link"),
      href: (editor.getAttributes("link").href as string | undefined) ?? "",
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    }),
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Manual dismissal of the passive view popover (outside click / Escape).
  // `editing` is a forced-open flag from the parent, so it overrides this.
  const [dismissed, setDismissed] = useState(false);

  const visible = !!state && (editing || (!dismissed && state.linkActive));

  // A manual dismissal only makes sense for the current link. Moving the
  // selection to a different link (or into/out of one) changes from/to/active,
  // which clears the flag so the popover reopens on the next link the caret
  // lands in.
  useEffect(() => {
    setDismissed(false);
  }, [state?.linkActive, state?.from, state?.to]);

  // Hide on outside click / Escape for BOTH modes. View mode can't rely on the
  // selection leaving the link: clicking outside the editor (or in empty space)
  // keeps the ProseMirror selection inside the link, so `linkActive` stays true
  // and the popover would otherwise linger. Dismiss it explicitly instead.
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      setDismissed(true);
      if (editing) onEditingChange(false);
    };
    function onDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        dismiss();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [visible, editing, onEditingChange]);

  // Measure the rendered popover and flip/clamp into the viewport. Reruns
  // when the editing mode toggles since the edit form is wider than the view.
  // useLayoutEffect is the right place for read-DOM-then-position; the
  // set-state-in-effect rule is overcautious for this canonical pattern.
  useLayoutEffect(() => {
    if (!visible || !state) return;
    const el = containerRef.current;
    if (!el) return;
    const anchor = posToRect(editor, state.from, state.to);
    if (!anchor) return;
    const elRect = el.getBoundingClientRect();
    setPos(
      computeFloatingPosition(anchor, {
        width: elRect.width,
        height: elRect.height,
      }),
    );
  }, [visible, editing, state, editor]);

  if (!visible || !state) return null;

  const apply = (rawHref: string) => {
    const href = rawHref.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onEditingChange(false);
      return;
    }
    const { from, to, empty } = editor.state.selection;
    if (empty && !editor.isActive("link")) {
      // No selection and no existing link — insert the URL as visible text
      // with the link mark so the user has something to anchor to.
      editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, [
          { type: "text", text: href, marks: [{ type: "link", attrs: { href } }] },
        ])
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    onEditingChange(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onEditingChange(false);
  };

  const open = () => {
    if (state.href) window.open(state.href, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      ref={containerRef}
      className="rdump-link-pop"
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 50,
      }}
    >
      {editing ? (
        <LinkEditForm
          initialHref={state.href}
          onSubmit={apply}
          onCancel={() => onEditingChange(false)}
        />
      ) : (
        <div className="rdump-link-pop__view">
          <a
            href={state.href || "#"}
            target="_blank"
            rel="noreferrer"
            className="rdump-link-pop__url"
            title={state.href}
            onClick={(event) => {
              event.preventDefault();
              open();
            }}
          >
            {state.href || "(no URL)"}
          </a>
          <button
            type="button"
            className="rdump-link-pop__btn"
            onClick={open}
            aria-label="Open link"
            title="Open"
          >
            <ExternalLink size={13} />
          </button>
          <button
            type="button"
            className="rdump-link-pop__btn"
            onClick={() => onEditingChange(true)}
            aria-label="Edit link"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="rdump-link-pop__btn rdump-link-pop__btn--danger"
            onClick={remove}
            aria-label="Remove link"
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function posToRect(editor: Editor, from: number, to: number) {
  try {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    return {
      left: Math.min(start.left, end.left),
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
    };
  } catch {
    return null;
  }
}

// Split out so each open of "edit mode" mounts a fresh form with the current
// href seeded via initialState — no useEffect/setState dance needed.
function LinkEditForm({
  initialHref,
  onSubmit,
  onCancel,
}: {
  initialHref: string;
  onSubmit: (href: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialHref);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select-all once on mount. An inline `ref={(node) => node.select()}`
  // would re-fire on every render (each keystroke) and clobber typing.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <form
      className="rdump-link-pop__edit"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        placeholder="Paste or type a URL"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        className="rdump-link-pop__input"
      />
      <button type="submit" className="rdump-link-pop__btn rdump-link-pop__btn--primary">
        Save
      </button>
    </form>
  );
}
