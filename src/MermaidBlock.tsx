"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Maximize2, Minus, Plus, Scan } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BlockCaption } from "./BlockCaption";
import { openMediaLightbox } from "./MediaLightbox";
import "./MermaidBlock.css";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mermaid: {
      insertMermaid: (code?: string) => ReturnType;
    };
  }
}

const DEFAULT_DIAGRAM = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Continue]
  B -->|No| D[Stop]`;

// The title/caption are UI labels, but documents persist as Markdown (see
// getEditorMarkdown in Editor.tsx) — so they must ride inside the fenced
// ```mermaid block to survive a save/reload round-trip. We stash them as
// Mermaid comments (`%% title:` / `%% caption:`) at the top of the block:
// Mermaid ignores `%%` comment lines, and `code` stays clean (markers added on
// serialize, stripped on parse) so the diagram never renders them. The parser
// also tolerates an older `rdump-` prefix.
const MERMAID_META_RE = /^[^\S\n]*%%\s*(?:rdump-)?(title|caption):[^\S\n]?(.*)$/;

// A marker is a single comment line, but captions may be multiline — so encode
// newlines (and backslashes) so the value stays on one line, and decode on the
// way back.
function escapeMarker(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function unescapeMarker(value: string): string {
  return value.replace(/\\([\\n])/g, (_, ch) => (ch === "n" ? "\n" : "\\"));
}

function splitMermaidMeta(raw: string): { title: string; caption: string; code: string } {
  const lines = raw.split("\n");
  const meta: { title: string; caption: string } = { title: "", caption: "" };
  // Markers are written contiguously at the very top of the block.
  while (lines.length) {
    const match = lines[0].match(MERMAID_META_RE);
    if (!match) break;
    meta[match[1] as "title" | "caption"] = unescapeMarker(match[2]);
    lines.shift();
  }
  return { ...meta, code: lines.join("\n").replace(/^\n+/, "") };
}

export const MermaidBlock = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      code: {
        default: DEFAULT_DIAGRAM,
        parseHTML: (el) => el.getAttribute("data-code") ?? DEFAULT_DIAGRAM,
        renderHTML: (attrs) => ({ "data-code": attrs.code }),
      },
      // Optional human-readable label shown in the block header and used as the
      // fullscreen viewer title. Empty falls back to "Mermaid".
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? "",
        renderHTML: (attrs) => (attrs.title ? { "data-title": attrs.title } : {}),
      },
      // Optional figure caption shown beneath the diagram.
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") ?? "",
        renderHTML: (attrs) => (attrs.caption ? { "data-caption": attrs.caption } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type=\"mermaid\"]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "mermaid", class: "rdump-mermaid" }),
    ];
  },

  addCommands() {
    return {
      insertMermaid:
        (code) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { code: code ?? DEFAULT_DIAGRAM },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },

  // tiptap-markdown integration: serialize as a ```mermaid fenced block,
  // and on parse rewrite markdown-it's `<pre><code class="language-mermaid">`
  // output into our `<div data-type="mermaid">` shape so the regular
  // CodeBlockLowlight parser doesn't grab the node first.
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; text: (s: string, esc?: boolean) => void; ensureNewLine: () => void; closeBlock: (n: unknown) => void },
          node: { attrs: { code?: string; title?: string; caption?: string } },
        ) {
          const title = (node.attrs.title ?? "").trim();
          const caption = (node.attrs.caption ?? "").trim();
          state.write("```mermaid\n");
          if (title) state.write(`%% title: ${escapeMarker(title)}\n`);
          if (caption) state.write(`%% caption: ${escapeMarker(caption)}\n`);
          state.text(node.attrs.code ?? "", false);
          state.ensureNewLine();
          state.write("```");
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            element.querySelectorAll("pre > code").forEach((codeEl) => {
              if (!/(?:^|\s)language-mermaid(?:\s|$)/.test(codeEl.className)) {
                return;
              }
              const pre = codeEl.parentElement;
              if (!pre) return;
              const { title, caption, code } = splitMermaidMeta(codeEl.textContent ?? "");
              const div = document.createElement("div");
              div.setAttribute("data-type", "mermaid");
              div.setAttribute("data-code", code);
              if (title) div.setAttribute("data-title", title);
              if (caption) div.setAttribute("data-caption", caption);
              pre.replaceWith(div);
            });
          },
        },
      },
    };
  },
});

const MIN_SCALE = 0.1;
const MAX_SCALE = 12;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

interface View {
  scale: number;
  tx: number;
  ty: number;
}

// Natural (unscaled) size of a rendered Mermaid SVG — the unit the inline zoom
// scale multiplies. The viewBox is the diagram's own coordinate box; getBBox is
// the rendered geometry's bounds (independent of CSS sizing, so it works even
// before the canvas has been given a width); attrs/layout are last resorts.
function measureSvg(svg: SVGSVGElement) {
  const box = svg.viewBox?.baseVal;
  if (box && box.width && box.height) return { w: box.width, h: box.height };
  try {
    const bb = svg.getBBox();
    if (bb.width && bb.height) return { w: bb.width, h: bb.height };
  } catch {
    // getBBox throws if the SVG isn't in a rendered tree yet — fall through.
  }
  const wa = Number.parseFloat(svg.getAttribute("width") ?? "") || 0;
  const ha = Number.parseFloat(svg.getAttribute("height") ?? "") || 0;
  if (wa && ha) return { w: wa, h: ha };
  const rect = svg.getBoundingClientRect();
  return { w: rect.width, h: rect.height };
}

function MermaidView({ node, updateAttributes, editor }: NodeViewProps) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const code: string = node.attrs.code;
  const title: string = node.attrs.title ?? "";
  const caption: string = node.attrs.caption ?? "";
  const displayTitle = title.trim() || "Mermaid";
  const [captionOpen, setCaptionOpen] = useState(() => caption.trim().length > 0);
  const [captionAutoFocus, setCaptionAutoFocus] = useState(false);
  const openCaption = () => {
    setCaptionAutoFocus(true);
    setCaptionOpen(true);
  };

  // Inline pan/zoom. The canvas is transformed (translate + scale) about its
  // top-left; the SVG re-renders crisply at any scale since it stays vector.
  // We keep the live view in a ref and drive the transform imperatively for
  // smooth dragging, mirroring scale into state only for the % readout.
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  const natRef = useRef({ w: 0, h: 0 });
  const fitScaleRef = useRef(1);
  const [scalePct, setScalePct] = useState(100);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const renderId = `mmd_${reactId}_${Date.now()}`;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        if (!cancelled) {
          mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
          const { svg } = await mermaid.render(renderId, code);
          if (!cancelled) {
            setSvg(svg);
            setError(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Mermaid render failed");
          setSvg("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  const interactive = Boolean(svg) && !error;

  const applyView = useCallback((next: View) => {
    viewRef.current = next;
    const canvas = canvasRef.current;
    const { w, h } = natRef.current;
    if (canvas && w && h) {
      // Scale by resizing the canvas (the SVG fills it) so the vectors
      // re-render crisply at every zoom. A CSS `transform: scale()` would
      // rasterize the layer once and stretch that bitmap → blurry. `translate`
      // is fine for panning since it only moves the bitmap, never stretches it.
      canvas.style.width = `${w * next.scale}px`;
      canvas.style.height = `${h * next.scale}px`;
      canvas.style.transform = `translate(${next.tx}px, ${next.ty}px)`;
    }
    setScalePct(Math.round(next.scale * 100));
  }, []);

  // Scale to fit the stage and center. Recorded as the "reset" scale so a
  // double-click can toggle back to it.
  const fit = useCallback(() => {
    const stage = stageRef.current;
    const { w, h } = natRef.current;
    if (!stage || !w || !h) return;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const scale = clamp(Math.min((W - 32) / w, (H - 32) / h), MIN_SCALE, MAX_SCALE);
    fitScaleRef.current = scale;
    applyView({ scale, tx: (W - w * scale) / 2, ty: (H - h * scale) / 2 });
  }, [applyView]);

  // Zoom by `factor` keeping the point (mx,my) (relative to the stage) fixed.
  const applyZoom = useCallback(
    (factor: number, mx: number, my: number) => {
      const { scale, tx, ty } = viewRef.current;
      const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      if (next === scale) return;
      const r = next / scale;
      applyView({ scale: next, tx: mx * (1 - r) + r * tx, ty: my * (1 - r) + r * ty });
    },
    [applyView],
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      applyZoom(factor, stage.clientWidth / 2, stage.clientHeight / 2);
    },
    [applyZoom],
  );

  // Measure + fit each time a new diagram renders. Layout effect so the fit
  // transform is applied before paint (no flash of the unscaled diagram).
  useLayoutEffect(() => {
    if (!interactive) return;
    let raf = 0;
    const measure = () => {
      const svgEl = canvasRef.current?.querySelector("svg") as SVGSVGElement | null;
      if (!svgEl) return;
      // (Mermaid's inline max-width that would otherwise cap the SVG is
      // overridden in CSS — see .rdump-mermaid__canvas svg.)
      const nat = measureSvg(svgEl);
      if (!nat.w || !nat.h) {
        // Not laid out yet — try again next frame so we never end up with a
        // zero natural size (which would make every zoom a no-op).
        raf = requestAnimationFrame(measure);
        return;
      }
      natRef.current = nat;
      fit();
    };
    measure();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [svg, interactive, fit]);

  // Native (non-passive) wheel listener so we can preventDefault the page scroll
  // while zooming the diagram.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !interactive) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      applyZoom(
        Math.exp(-event.deltaY * 0.0015),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [interactive, applyZoom]);

  useEffect(() => {
    if (!interactive) return;
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [interactive, fit]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest(".rdump-mermaid__controls")) return;
      // Keep ProseMirror from selecting/dragging the node while we pan.
      event.preventDefault();
      event.stopPropagation();
      const start = { x: event.clientX, y: event.clientY, ...viewRef.current };
      let moved = false;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (moved) applyView({ scale: start.scale, tx: start.tx + dx, ty: start.ty + dy });
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        setDragging(false);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      setDragging(true);
    },
    [applyView],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).closest(".rdump-mermaid__controls")) return;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      // Toggle: zoom in toward the cursor, or reset to fit if already enlarged.
      if (viewRef.current.scale > fitScaleRef.current * 1.2) fit();
      else applyZoom(2, event.clientX - rect.left, event.clientY - rect.top);
    },
    [applyZoom, fit],
  );

  const editable = editor.isEditable;
  const openFull = () => {
    if (interactive) openMediaLightbox({ kind: "svg", svg, title: displayTitle });
  };

  return (
    <NodeViewWrapper className="rdump-mermaid">
      <div className="rdump-mermaid__toolbar" contentEditable={false}>
        {editable ? (
          <input
            type="text"
            className="rdump-mermaid__title-input"
            value={title}
            placeholder="Mermaid"
            aria-label="Diagram title"
            spellCheck={false}
            onChange={(event) => updateAttributes({ title: event.target.value })}
            // Keep ProseMirror from treating clicks/keystrokes in the field as
            // node selection or editor shortcuts.
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="rdump-mermaid__title" title={displayTitle}>
            {displayTitle}
          </span>
        )}
        <div className="rdump-mermaid__actions">
          {editable ? (
            <>
              <button
                type="button"
                className="rdump-mermaid__toggle"
                onClick={() => setOpen((value) => !value)}
              >
                {open ? "Hide source" : "Edit source"}
              </button>
              <a
                className="rdump-mermaid__toggle rdump-mermaid__docs"
                href="https://mermaid.js.org/intro/"
                target="_blank"
                rel="noreferrer noopener"
                title="Open Mermaid syntax docs in a new tab"
              >
                Docs <span aria-hidden="true">↗</span>
              </a>
              {!captionOpen ? (
                <button
                  type="button"
                  className="rdump-mermaid__toggle"
                  onClick={openCaption}
                >
                  Add caption
                </button>
              ) : null}
            </>
          ) : null}
          {interactive ? (
            <button
              type="button"
              className="rdump-mermaid__icon-btn"
              onClick={openFull}
              title="Open larger (zoom & pan)"
              aria-label="Open larger"
            >
              <Maximize2 size={15} />
            </button>
          ) : null}
        </div>
      </div>
      {open && editable ? (
        <textarea
          className="rdump-mermaid__editor"
          value={code}
          onChange={(event) => updateAttributes({ code: event.target.value })}
          spellCheck={false}
          rows={Math.max(4, code.split("\n").length + 1)}
        />
      ) : null}
      <div
        ref={stageRef}
        className={`rdump-mermaid__preview${interactive ? " is-interactive" : ""}${
          dragging ? " is-dragging" : ""
        }`}
        contentEditable={false}
        onPointerDown={interactive ? onPointerDown : undefined}
        onMouseDown={interactive ? (event) => event.stopPropagation() : undefined}
        onDoubleClick={interactive ? onDoubleClick : undefined}
      >
        {error ? (
          <pre className="rdump-mermaid__error">{error}</pre>
        ) : (
          <div
            ref={canvasRef}
            className="rdump-mermaid__canvas"
            draggable={false}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        {interactive ? (
          <div className="rdump-mermaid__controls">
            <button
              type="button"
              className="rdump-mermaid__ctrl"
              onClick={() => zoomAtCenter(1 / 1.25)}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <Minus size={15} />
            </button>
            <span className="rdump-mermaid__pct">{scalePct}%</span>
            <button
              type="button"
              className="rdump-mermaid__ctrl"
              onClick={() => zoomAtCenter(1.25)}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              className="rdump-mermaid__ctrl"
              onClick={fit}
              title="Fit to view"
              aria-label="Fit to view"
            >
              <Scan size={15} />
            </button>
          </div>
        ) : null}
      </div>
      <BlockCaption
        editable={editable}
        open={captionOpen}
        value={caption}
        autoFocus={captionAutoFocus}
        onChange={(value) => updateAttributes({ caption: value })}
        onClose={() => setCaptionOpen(false)}
      />
      <NodeViewContent style={{ display: "none" }} />
    </NodeViewWrapper>
  );
}
