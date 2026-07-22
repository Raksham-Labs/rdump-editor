import type { Editor } from "@tiptap/core";

export type BlockAlignment = "left" | "center" | "right" | "justify";

/**
 * One alignment surface for both toolbars: routes to the image node's align
 * attribute when an image is node-selected, and to TextAlign otherwise.
 * "Left" is spelled as *no* attribute in both models (normal flow), so
 * left-aligning resets instead of storing an explicit value — that keeps
 * untouched and left-aligned content on the plain markdown spelling.
 */
export function applyBlockAlignment(editor: Editor, alignment: BlockAlignment): void {
  const chain = editor.chain().focus();
  if (editor.isActive("image")) {
    if (alignment === "justify") return;
    chain
      .updateAttributes("image", { align: alignment === "left" ? null : alignment })
      .run();
    return;
  }
  if (alignment === "left") {
    chain.unsetTextAlign().run();
    return;
  }
  chain.setTextAlign(alignment).run();
}

/** Which alignment reads as active for the current selection. */
export function activeBlockAlignment(editor: Editor): BlockAlignment {
  if (editor.isActive("image")) {
    const align = editor.getAttributes("image").align as string | null;
    return align === "center" || align === "right" ? align : "left";
  }
  for (const alignment of ["center", "right", "justify"] as const) {
    if (editor.isActive({ textAlign: alignment })) return alignment;
  }
  return "left";
}
