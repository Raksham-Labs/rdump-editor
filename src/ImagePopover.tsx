"use client";

import type { Editor } from "@tiptap/react";
import { Image as ImageIcon, Link2, Upload, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { computeFloatingPosition } from "./floatingPosition";
import { insertImageFile } from "./imageInsert";
import "./ImagePopover.css";

interface ImagePopoverProps {
  editor: Editor;
  open: boolean;
  onClose: () => void;
}

type Tab = "upload" | "url";

// Interim: base64 inline. When a blob-upload route exists, swap the
// FileReader call in insertFromFile with a fetch to that route and use the
// returned URL — the rest of the component stays the same.
export function ImagePopover({ editor, open, onClose }: ImagePopoverProps) {
  const [tab, setTab] = useState<Tab>("upload");
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  // Measure the rendered popover and flip/clamp into the viewport. Reruns
  // when `tab` switches because the upload pane is taller than the URL pane.
  // useLayoutEffect is the right place for read-DOM-then-position; the
  // set-state-in-effect rule is overcautious for this canonical pattern.
  useLayoutEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const anchor = posToRect(editor);
    if (!anchor) return;
    const elRect = el.getBoundingClientRect();
    setPos(
      computeFloatingPosition(anchor, {
        width: elRect.width,
        height: elRect.height,
      }),
    );
  }, [open, tab, editor]);

  if (!open) return null;

  const insertFromFile = (file: File) => {
    if (insertImageFile(editor, file)) {
      onClose();
    }
  };

  const insertFromUrl = (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    editor.chain().focus().setImage({ src: url, alt: "" }).run();
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="rdump-image-pop"
      style={{
        position: "fixed",
        // While we wait for the first measurement, render off-screen so the
        // pre-flip frame isn't visible to the user.
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 50,
      }}
    >
      <div className="rdump-image-pop__tabs">
        <button
          type="button"
          className={`rdump-image-pop__tab${tab === "upload" ? " rdump-image-pop__tab--active" : ""}`}
          onClick={() => setTab("upload")}
        >
          <Upload size={13} />
          Upload
        </button>
        <button
          type="button"
          className={`rdump-image-pop__tab${tab === "url" ? " rdump-image-pop__tab--active" : ""}`}
          onClick={() => setTab("url")}
        >
          <Link2 size={13} />
          From URL
        </button>
        <button
          type="button"
          className="rdump-image-pop__close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
      <div className="rdump-image-pop__body">
        {tab === "upload" ? (
          <UploadPane onPick={insertFromFile} />
        ) : (
          <UrlPane onInsert={insertFromUrl} onCancel={onClose} />
        )}
      </div>
    </div>
  );
}

function UploadPane({ onPick }: { onPick: (file: File) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`rdump-image-pop__drop${dragOver ? " rdump-image-pop__drop--over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onPick(file);
      }}
    >
      <ImageIcon size={18} className="rdump-image-pop__drop-icon" />
      <p className="rdump-image-pop__drop-text">
        Drop an image here, or
      </p>
      <button
        type="button"
        className="rdump-image-pop__btn rdump-image-pop__btn--primary"
        onClick={() => fileInputRef.current?.click()}
      >
        Choose file
      </button>
      <p className="rdump-image-pop__hint">
        JPEG, PNG, GIF, WebP, AVIF, SVG. Stored inline (base64) for now.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml,image/bmp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function UrlPane({
  onInsert,
  onCancel,
}: {
  onInsert: (url: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="rdump-image-pop__url-form"
      onSubmit={(event) => {
        event.preventDefault();
        onInsert(draft);
      }}
    >
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        placeholder="https://example.com/image.png"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        className="rdump-image-pop__input"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="rdump-image-pop__btn rdump-image-pop__btn--primary"
      >
        Insert
      </button>
    </form>
  );
}

function posToRect(editor: Editor) {
  try {
    const { from, to } = editor.state.selection;
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
