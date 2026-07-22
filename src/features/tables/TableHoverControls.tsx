"use client";

import type { Editor } from "@tiptap/react";
import { Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import "./TableHoverControls.css";

interface ActiveTable {
  el: HTMLTableElement;
  wrapper: HTMLElement;
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
}

function readOffsets(el: HTMLTableElement, wrapper: HTMLElement): ActiveTable {
  return {
    el,
    wrapper,
    offsetLeft: el.offsetLeft,
    offsetTop: el.offsetTop,
    offsetWidth: el.offsetWidth,
    offsetHeight: el.offsetHeight,
  };
}

export function TableHoverControls({
  editor,
  scrollRef,
}: {
  editor: Editor;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [active, setActive] = useState<ActiveTable | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const recompute = useCallback((el: HTMLTableElement) => {
    const wrapper = el.closest(".tableWrapper") as HTMLElement | null;
    if (!wrapper) return;
    setActive(readOffsets(el, wrapper));
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".rdump-table-add")) return;
      const tableEl = target?.closest("table") as HTMLTableElement | null;
      if (tableEl) {
        if (leaveTimer.current !== null) {
          window.clearTimeout(leaveTimer.current);
          leaveTimer.current = null;
        }
        setActive((current) => {
          if (current?.el === tableEl) return current;
          const wrapper = tableEl.closest(".tableWrapper") as HTMLElement | null;
          if (!wrapper) return current;
          return readOffsets(tableEl, wrapper);
        });
        return;
      }
      if (leaveTimer.current === null) {
        leaveTimer.current = window.setTimeout(() => {
          setActive(null);
          leaveTimer.current = null;
        }, 320);
      }
    };

    const onLeave = () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(() => {
        setActive(null);
        leaveTimer.current = null;
      }, 320);
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      if (leaveTimer.current !== null) {
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
    };
  }, [scrollRef]);

  useEffect(() => {
    if (!active) return;
    const onUpdate = () => {
      if (!document.body.contains(active.el)) {
        setActive(null);
        return;
      }
      recompute(active.el);
    };
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onUpdate);
    window.addEventListener("resize", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onUpdate);
      window.removeEventListener("resize", onUpdate);
    };
  }, [active, editor, recompute]);

  const addColumn = useCallback(() => {
    if (!active) return;
    const firstRow = active.el.querySelector("tr");
    if (!firstRow) return;
    const cells = firstRow.querySelectorAll("td, th");
    const lastCell = cells[cells.length - 1] as HTMLElement | undefined;
    if (!lastCell) return;
    const pos = editor.view.posAtDOM(lastCell, 0);
    if (pos < 0) return;
    editor.chain().focus().setTextSelection(pos + 1).addColumnAfter().run();
    requestAnimationFrame(() => {
      if (active.wrapper) {
        active.wrapper.scrollLeft = active.wrapper.scrollWidth;
      }
    });
  }, [active, editor]);

  const addRow = useCallback(() => {
    if (!active) return;
    const rows = active.el.querySelectorAll("tr");
    const lastRow = rows[rows.length - 1] as HTMLElement | undefined;
    if (!lastRow) return;
    const firstCell = lastRow.querySelector("td, th") as HTMLElement | null;
    if (!firstCell) return;
    const pos = editor.view.posAtDOM(firstCell, 0);
    if (pos < 0) return;
    editor.chain().focus().setTextSelection(pos + 1).addRowAfter().run();
  }, [active, editor]);

  if (!active || !editor.isEditable) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="rdump-table-add rdump-table-add--col"
        style={{
          left: active.offsetLeft + active.offsetWidth,
          top: active.offsetTop,
          height: active.offsetHeight,
        }}
        onClick={addColumn}
        title="Add column"
        aria-label="Add column"
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        className="rdump-table-add rdump-table-add--row"
        style={{
          left: active.offsetLeft,
          top: active.offsetTop + active.offsetHeight,
          width: active.offsetWidth,
        }}
        onClick={addRow}
        title="Add row"
        aria-label="Add row"
      >
        <Plus size={14} />
      </button>
    </>,
    active.wrapper,
  );
}
