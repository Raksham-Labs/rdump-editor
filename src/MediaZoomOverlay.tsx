"use client";

import { Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { openMediaLightbox } from "./MediaLightbox";
import "./MediaZoomOverlay.css";

const BTN = 30;
const INSET = 8;

interface Active {
  el: HTMLElement;
  top: number;
  left: number;
}

// Find a zoomable editor image under the pointer. Mermaid diagrams have their
// own "open larger" button in the block header, so they're not handled here.
function locate(target: HTMLElement | null): { el: HTMLElement } | null {
  if (!target) return null;
  const img = target.closest(".rdump-editor-shell img") as HTMLElement | null;
  if (img) return { el: img };
  return null;
}

function place(el: HTMLElement): { top: number; left: number } {
  const rect = el.getBoundingClientRect();
  return { top: rect.top + INSET, left: rect.right - INSET - BTN };
}

// Floating "expand" button that follows the hovered image / diagram and opens
// the fullscreen viewer. Works in both editable and read-only modes; portals to
// body so clicking it never disturbs the ProseMirror selection.
export function MediaZoomOverlay({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState<Active | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const scheduleLeave = useCallback(() => {
    if (leaveTimer.current !== null) return;
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      elRef.current = null;
      setActive(null);
    }, 200);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // A single document-level move handler — so it also fires while the pointer
    // is over the (body-portaled) button, which a container listener can't see.
    // That self-hover keep-alive is what stops the button flickering away as
    // you reach for it.
    const onMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".rdump-media-zoom")) {
        cancelLeave();
        return;
      }
      if (!target || !container.contains(target)) {
        scheduleLeave();
        return;
      }
      const found = locate(target);
      if (!found) {
        scheduleLeave();
        return;
      }
      cancelLeave();
      elRef.current = found.el;
      const { top, left } = place(found.el);
      setActive((curr) =>
        curr && curr.el === found.el && curr.top === top && curr.left === left
          ? curr
          : { el: found.el, top, left },
      );
    };

    const reposition = () => {
      const el = elRef.current;
      if (!el) return;
      if (!document.body.contains(el)) {
        elRef.current = null;
        setActive(null);
        return;
      }
      const { top, left } = place(el);
      setActive((curr) => (curr ? { ...curr, top, left } : curr));
    };

    document.addEventListener("mousemove", onMove);
    container.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousemove", onMove);
      container.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      cancelLeave();
    };
  }, [scrollRef, cancelLeave, scheduleLeave]);

  if (!active) return null;

  const onOpen = () => {
    const el = active.el as HTMLImageElement;
    const src = el.src || el.getAttribute("src") || "";
    if (src) openMediaLightbox({ kind: "image", src, alt: el.alt || undefined });
  };

  return createPortal(
    <button
      type="button"
      className="rdump-media-zoom rdump-media-zoom__btn"
      style={{ top: active.top, left: active.left }}
      onClick={onOpen}
      title="Open larger (zoom & pan)"
      aria-label="Open larger"
    >
      <Maximize2 size={15} />
    </button>,
    document.body,
  );
}
