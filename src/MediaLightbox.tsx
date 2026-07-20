"use client";

import { Maximize2, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./MediaLightbox.css";

// Fired (via openMediaLightbox) to open the fullscreen zoom/pan viewer. Kept a
// window event so non-React node views (the raw <img> view) and React node
// views (Mermaid) can both trigger it without a shared registry — same pattern
// as OPEN_IMAGE_PICKER_EVENT in Editor.tsx.
export const OPEN_LIGHTBOX_EVENT = "rdump:open-lightbox";

export type LightboxDetail =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "svg"; svg: string; title?: string };

export function openMediaLightbox(detail: LightboxDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LightboxDetail>(OPEN_LIGHTBOX_EVENT, { detail }));
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 12;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

interface View {
  scale: number;
  tx: number;
  ty: number;
}

// Mount once (in Editor). Self-manages open state by listening for the event.
// Each open bumps `id` so the modal remounts with fresh zoom/pan state.
export function MediaLightbox() {
  const [state, setState] = useState<{ detail: LightboxDetail; id: number } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<LightboxDetail>).detail;
      if (!next) return;
      idRef.current += 1;
      setState({ detail: next, id: idRef.current });
    };
    window.addEventListener(OPEN_LIGHTBOX_EVENT, handler);
    return () => window.removeEventListener(OPEN_LIGHTBOX_EVENT, handler);
  }, []);

  if (!state) return null;
  return createPortal(
    <LightboxModal key={state.id} detail={state.detail} onClose={() => setState(null)} />,
    document.body,
  );
}

function LightboxModal({ detail, onClose }: { detail: LightboxDetail; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  const natRef = useRef({ w: 0, h: 0 });
  const [view, setViewState] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [nat, setNatState] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);

  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  // Center and scale the content to fit the stage. Scaling is applied to the
  // content's width/height (see the render below), NOT via a CSS transform —
  // that lets an SVG re-render its vectors crisply at every zoom instead of
  // being raster-stretched (which looked like a blurry image).
  const fitTo = useCallback(
    (w: number, h: number) => {
      const stage = stageRef.current;
      if (!stage || !w || !h) return;
      const availW = Math.max(stage.clientWidth - 64, 64);
      const availH = Math.max(stage.clientHeight - 64, 64);
      let scale = Math.min(availW / w, availH / h);
      // Don't upscale raster photos past 1:1; vector SVG can fill freely.
      if (detail.kind === "image") scale = Math.min(scale, 1);
      setView({ scale: clamp(scale, MIN_SCALE, MAX_SCALE), tx: 0, ty: 0 });
    },
    [detail.kind, setView],
  );

  // Record the content's natural size (the unit the scale multiplies) and fit.
  const setNatural = useCallback(
    (w: number, h: number) => {
      if (!w || !h) return;
      natRef.current = { w, h };
      setNatState({ w, h });
      fitTo(w, h);
    },
    [fitTo],
  );

  const fit = useCallback(() => {
    const { w, h } = natRef.current;
    fitTo(w, h);
  }, [fitTo]);

  // Measure an SVG's natural size from its viewBox / attributes once injected.
  useEffect(() => {
    if (detail.kind !== "svg") return;
    const svg = contentRef.current?.querySelector("svg");
    if (!svg) return;
    let w = 0;
    let h = 0;
    const box = (svg as SVGSVGElement).viewBox?.baseVal;
    if (box && box.width && box.height) {
      w = box.width;
      h = box.height;
    }
    if (!w || !h) {
      w = Number.parseFloat(svg.getAttribute("width") ?? "") || 0;
      h = Number.parseFloat(svg.getAttribute("height") ?? "") || 0;
    }
    if (!w || !h) {
      const rect = svg.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
    }
    setNatural(w, h);
  }, [detail, setNatural]);

  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fit]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Zoom by `factor` keeping the point (mx,my) (relative to the stage) fixed.
  const applyZoom = useCallback(
    (factor: number, mx: number, my: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const { scale, tx, ty } = viewRef.current;
      const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      if (next === scale) return;
      const r = next / scale;
      const scx = stage.clientWidth / 2;
      const scy = stage.clientHeight / 2;
      const ncx = mx * (1 - r) + r * (scx + tx);
      const ncy = my * (1 - r) + r * (scy + ty);
      setView({ scale: next, tx: ncx - scx, ty: ncy - scy });
    },
    [setView],
  );

  // Native (non-passive) wheel listener so we can preventDefault the page scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      applyZoom(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const zoomButton = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      applyZoom(factor, stage.clientWidth / 2, stage.clientHeight / 2);
    },
    [applyZoom],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const start = { x: event.clientX, y: event.clientY, ...viewRef.current };
      const onBackdrop = event.target === stageRef.current;
      let moved = false;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) setView({ scale: start.scale, tx: start.tx + dx, ty: start.ty + dy });
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        setDragging(false);
        // A click (no drag) on the dimmed backdrop closes the viewer.
        if (!moved && onBackdrop) onClose();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      setDragging(true);
    },
    [onClose, setView],
  );

  const title = detail.kind === "svg" ? detail.title ?? "Diagram" : detail.alt || "Image";

  return (
    <div className="rdump-lightbox" role="dialog" aria-modal="true" aria-label={title}>
      <div className="rdump-lightbox__bar">
        <span className="rdump-lightbox__title">{title}</span>
        <div className="rdump-lightbox__tools">
          <button
            type="button"
            className="rdump-lightbox__btn"
            onClick={() => zoomButton(1 / 1.25)}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
          <span className="rdump-lightbox__pct">{Math.round(view.scale * 100)}%</span>
          <button
            type="button"
            className="rdump-lightbox__btn"
            onClick={() => zoomButton(1.25)}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="rdump-lightbox__btn"
            onClick={fit}
            title="Fit to screen"
            aria-label="Fit to screen"
          >
            <Maximize2 size={15} />
          </button>
          <button
            type="button"
            className="rdump-lightbox__btn rdump-lightbox__btn--close"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`rdump-lightbox__stage${dragging ? " is-dragging" : ""}`}
        onPointerDown={onPointerDown}
        onDoubleClick={(event) => {
          const rect = stageRef.current?.getBoundingClientRect();
          if (!rect) return;
          // Toggle: zoom in toward the cursor, or fit if already enlarged.
          if (viewRef.current.scale >= 1.5) fit();
          else applyZoom(2, event.clientX - rect.left, event.clientY - rect.top);
        }}
      >
        <div
          ref={contentRef}
          className="rdump-lightbox__content"
          style={{
            width: nat.w ? nat.w * view.scale : undefined,
            height: nat.h ? nat.h * view.scale : undefined,
            transform: `translate(${view.tx}px, ${view.ty}px)`,
            opacity: nat.w && nat.h ? 1 : 0,
          }}
        >
          {detail.kind === "image" ? (
            // User image sources are arbitrary (data URLs, external hosts) and
            // shown in a zoom viewer — next/image optimization doesn't apply.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.src}
              alt={detail.alt ?? ""}
              draggable={false}
              onLoad={(event) =>
                setNatural(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
              }
              className="rdump-lightbox__img"
            />
          ) : (
            <div
              className="rdump-lightbox__svg"
              // Mermaid output is sanitized SVG produced by our own render call.
              dangerouslySetInnerHTML={{ __html: detail.svg }}
            />
          )}
        </div>
      </div>

      <p className="rdump-lightbox__hint">Scroll to zoom · drag to pan · double-click to toggle</p>
    </div>
  );
}
