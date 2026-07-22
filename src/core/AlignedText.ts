import Heading from "@tiptap/extension-heading";
import Paragraph from "@tiptap/extension-paragraph";
import type { Fragment, Node as PMNode } from "@tiptap/pm/model";
import { serializeBlockHTML } from "./blockHtml";

/**
 * Paragraph/Heading with alignment-aware markdown serialization.
 *
 * The TextAlign extension stores alignment as a `textAlign` attribute on
 * these nodes, but markdown has no spelling for it and the stock serializers
 * (which only look at content and level) silently drop the attribute — an
 * aligned block would snap back to left on every save/reload. So a block
 * carrying an explicit alignment serializes as raw HTML instead
 * (`<p style="text-align: center">…</p>`), which the html:true round-trip
 * parses back losslessly via TextAlign's style-based parseHTML. Unaligned
 * blocks keep the stock markdown spelling, so pre-existing docs serialize
 * byte-identically (no phantom dirty flags).
 */

type SerializerState = {
  write: (s: string) => void;
  repeat: (s: string, n: number) => string;
  renderInline: (n: PMNode, fromBlockStart?: boolean) => void;
  closeBlock: (n: unknown) => void;
};

// Left is normal flow — an explicit "left" (pasted HTML, say) reads as
// unaligned so it normalizes back to the plain markdown spelling.
function isAligned(node: PMNode): boolean {
  return Boolean(node.attrs.textAlign) && node.attrs.textAlign !== "left";
}

export const AlignedParagraph = Paragraph.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(state: SerializerState, node: PMNode, parent: PMNode | Fragment) {
          if (isAligned(node)) {
            state.write(serializeBlockHTML(node, parent));
            state.closeBlock(node);
            return;
          }
          // Stock spelling — prosemirror-markdown's paragraph serializer.
          state.renderInline(node);
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});

export const AlignedHeading = Heading.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(state: SerializerState, node: PMNode, parent: PMNode | Fragment) {
          if (isAligned(node)) {
            state.write(serializeBlockHTML(node, parent));
            state.closeBlock(node);
            return;
          }
          // Stock spelling — prosemirror-markdown's heading serializer.
          state.write(state.repeat("#", node.attrs.level) + " ");
          state.renderInline(node, false);
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
