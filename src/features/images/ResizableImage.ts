import { mergeAttributes, ResizableNodeView } from "@tiptap/core";
import Image from "@tiptap/extension-image";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ImageAttrs = {
  src?: string | null;
  alt?: string | null;
  title?: string | null;
  width?: number | null;
  size?: number | null;
  align?: string | null;
};

// Left is the null/default alignment (normal flow), so only center/right are
// ever stored — and only they force the HTML markdown spelling.
const IMAGE_ALIGNMENTS = ["center", "right"];

/**
 * Markdown spelling for one image node. Shared by the node's own serializer
 * and the table serializer (MarkdownTable.ts), which has to inline image
 * cells by hand because GFM cells hold inline content only.
 */
export function serializeImageMarkdown(
  attrs: ImageAttrs,
  esc: (s: string) => string,
): string {
  const { src = "", alt, title, width, size, align } = attrs;
  if (width || size || align) {
    const parts = [`src="${escapeAttr(String(src ?? ""))}"`];
    if (alt) parts.push(`alt="${escapeAttr(String(alt))}"`);
    if (title) parts.push(`title="${escapeAttr(String(title))}"`);
    if (width) parts.push(`width="${Math.round(width)}"`);
    if (size) parts.push(`data-size="${Math.round(size)}"`);
    if (align) parts.push(`data-align="${escapeAttr(String(align))}"`);
    return `<img ${parts.join(" ")}>`;
  }
  const href = String(src ?? "").replace(/[()]/g, "\\$&");
  const titleSuffix = title ? ` "${String(title).replace(/"/g, '\\"')}"` : "";
  return `![${esc(String(alt ?? ""))}](${href}${titleSuffix})`;
}

/**
 * Image with a width-only resize model.
 *
 * Tiptap's stock resize writes BOTH `style.width` and `style.height` inline
 * on the <img>. When the editor's `max-width: 100%` clamps the rendered
 * width, the inline pixel height keeps growing past the natural aspect
 * ratio and the image visibly stretches. We sidestep that by:
 *   1. dropping `height` from the node's schema (so reloads never re-apply
 *      a stretched height),
 *   2. clearing inline `style.height` in the `onResize` hook (the core
 *      handler sets both styles before invoking us, so this wipes the
 *      offending one), and
 *   3. committing only `width` on mouse-up.
 *
 * The browser then derives rendered height from the (possibly clamped)
 * width and the image's intrinsic aspect ratio, so the picture always
 * looks correct.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        // The width attribute comes back from HTML as a string; the resize
        // model works in numbers, so normalize on parse.
        parseHTML: (element) => {
          const raw = element.getAttribute("width");
          const parsed = raw ? Number.parseInt(raw, 10) : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        },
      },
      // Block alignment: center | right (left is the null default). Applied
      // by the bubble bar when the image is node-selected; rendered as
      // data-align so both the node-view container (flex justify) and the
      // static HTML output (margin auto) can align off it in CSS.
      align: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-align");
          return raw && IMAGE_ALIGNMENTS.includes(raw) ? raw : null;
        },
        renderHTML: (attributes) =>
          attributes.align ? { "data-align": String(attributes.align) } : {},
      },
      // Original file size in bytes, captured at insert time (imageInsert.ts).
      // Shown in the loading placeholder and the hover badge.
      size: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-size");
          const parsed = raw ? Number.parseInt(raw, 10) : NaN;
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        },
        renderHTML: (attributes) =>
          attributes.size ? { "data-size": String(attributes.size) } : {},
      },
    };
  },

  // Markdown round-trip. The stock `![alt](src)` spelling has nowhere to put
  // width/size, which is why resizes used to vanish on reload — so any image
  // carrying either attr serializes as an inline <img> instead, and the
  // html:true pass-through parses it back with everything intact. Plain
  // images keep the stock spelling, so pre-existing docs serialize
  // byte-identically (no phantom dirty flags).
  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            esc: (s: string, startOfLine?: boolean) => string;
            closeBlock: (n: unknown) => void;
          },
          node: { isBlock: boolean; attrs: ImageAttrs },
        ) {
          state.write(serializeImageMarkdown(node.attrs, (s) => state.esc(s)));
          // The tiptap image is a block node (`inline: false`), so it must
          // terminate its block — exactly as MermaidBlock/ChartBlock and the
          // stock tiptap-markdown HTMLNode serializer do. Without this the next
          // block glues straight onto the `<img …>`: a following `### heading`
          // becomes `<img …>### heading`, which markdown-it re-parses as a
          // single inline-HTML paragraph, stripping the `#` markup so the
          // heading round-trips back as escaped literal text (`\### …`).
          if (node.isBlock) state.closeBlock(node);
        },
      },
    };
  },

  addNodeView() {
    const opts = this.options.resize;
    if (!opts || !opts.enabled || typeof document === "undefined") {
      return null;
    }
    const { directions, minWidth, alwaysPreserveAspectRatio } = opts;
    const typeName = this.name;

    return ({ node, getPos, HTMLAttributes, editor }) => {
      const el = document.createElement("img");
      // Tiptap hands node views only the per-attribute rendered attrs — the
      // extension's configured HTMLAttributes (class="rdump-image") must be
      // merged in by hand, exactly as a renderHTML implementation would.
      // Without it the img had no class, so the max-width clamp and every
      // img.rdump-image rule missed it: the picture rendered at natural
      // size, overflowing the wrapper the handles and badge anchor to.
      const merged = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
      Object.entries(merged).forEach(([key, value]) => {
        if (value == null) return;
        if (key === "width" || key === "height") return;
        el.setAttribute(key, String(value));
      });
      el.src = HTMLAttributes.src as string;

      const nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width) => {
          el.style.width = `${width}px`;
          el.style.height = "";
        },
        onCommit: (width) => {
          const pos = getPos();
          if (pos === undefined) return;
          editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes(typeName, { width })
            .run();
        },
        onUpdate: (updatedNode) => {
          if (updatedNode.type !== node.type) return false;
          // Alignment changes are attribute-only updates that keep this node
          // view instance alive — mirror them onto the DOM by hand (defined
          // below; ProseMirror never calls update() during construction).
          applyAlign(updatedNode.attrs.align);
          return true;
        },
        options: {
          directions,
          min: { width: minWidth },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
        },
      });

      // Human-readable size, shown centered in the loading placeholder and as
      // a corner badge on hover. Prefer the size attr captured at insert;
      // legacy inline images fall back to an estimate from the data-URI
      // length (base64 ≈ 4/3 of the raw bytes). External URLs stay unlabeled.
      const src = typeof HTMLAttributes.src === "string" ? HTMLAttributes.src : "";
      const sizeBytes =
        typeof node.attrs.size === "number" && node.attrs.size > 0
          ? node.attrs.size
          : src.startsWith("data:")
            ? Math.round((src.length * 3) / 4)
            : null;

      // Until the bytes arrive, show a shimmer placeholder instead of an
      // invisible gap — uploaded images stream from the host's asset store,
      // so there's a real network wait to cover. Error flips to a static
      // broken-image state (still selectable/deletable) rather than hiding
      // forever.
      const dom = nodeView.dom;
      // The container is the flex shell CSS aligns against; the img carries
      // the attr too so copied/static HTML keeps the alignment.
      const applyAlign = (align: unknown) => {
        if (typeof align === "string" && IMAGE_ALIGNMENTS.includes(align)) {
          dom.setAttribute("data-align", align);
          el.setAttribute("data-align", align);
        } else {
          dom.removeAttribute("data-align");
          el.removeAttribute("data-align");
        }
      };
      applyAlign(node.attrs.align);
      if (sizeBytes) {
        // The label lives on the wrapper (not the container) because the CSS
        // pseudo-elements that render it via attr() sit on the wrapper.
        dom
          .querySelector("[data-resize-wrapper]")
          ?.setAttribute("data-size-label", formatBytes(sizeBytes));
      }
      const markLoaded = () => {
        dom.classList.remove("rdump-image-loading");
        dom.style.pointerEvents = "";
      };
      dom.classList.add("rdump-image-loading");
      dom.style.pointerEvents = "none";
      el.onload = markLoaded;
      el.onerror = () => {
        markLoaded();
        dom.classList.add("rdump-image-error");
      };
      // Cached and data-URI images can be complete before handlers attach —
      // skip the shimmer entirely so legacy inline images don't flash.
      if (el.complete && el.naturalWidth > 0) markLoaded();
      return nodeView;
    };
  },
});