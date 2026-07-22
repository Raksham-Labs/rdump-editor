import { InputRule, type AnyExtension } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import { EDIT_MATH_EVENT } from "../../core/events";

// features.math — KaTeX-rendered inline/block math. This module is the only
// importer of @tiptap/extension-mathematics (which pulls in katex), so the
// KaTeX runtime stays out of the bundle unless the feature is on. Hosts must
// include katex's stylesheet themselves (katex/dist/katex.min.css).
//
// Use BlockMath / InlineMath directly so we can replace their input rules.
// The bundled Mathematics extension wires `$$…$$` to inline and `$$$…$$$` to
// block, which is the opposite of standard markdown.
export function create(): AnyExtension[] {
  return [
    BlockMath.extend({
      addInputRules() {
        return [
          new InputRule({
            // Block math `$$ … $$` — standard markdown spelling.
            find: /(?<!\$)\$\$([^$\n]+?)\$\$(?!\$)/,
            handler: ({ state, range, match }) => {
              const latex = match[1].trim();
              if (!latex) return;
              const { tr } = state;
              const $from = state.doc.resolve(range.from);
              const node = this.type.create({ latex });
              const consumesHostTextblock =
                $from.depth > 0 &&
                $from.parent.isTextblock &&
                range.from === $from.start() &&
                range.to === $from.end();
              const canReplaceHostTextblock =
                consumesHostTextblock &&
                $from
                  .node(-1)
                  .canReplaceWith(
                    $from.index(-1),
                    $from.indexAfter(-1),
                    this.type,
                  );
              const replacementRange = canReplaceHostTextblock
                ? { from: $from.before(), to: $from.after() }
                : range;
              tr.replaceWith(replacementRange.from, replacementRange.to, node);
            },
          }),
        ];
      },
    }).configure({
      katexOptions: { throwOnError: false },
      onClick: (node, pos) => {
        window.dispatchEvent(
          new CustomEvent(EDIT_MATH_EVENT, {
            detail: {
              type: "block",
              pos,
              latex: (node.attrs.latex as string | undefined) ?? "",
            },
          }),
        );
      },
    }),
    InlineMath.extend({
      addInputRules() {
        return [
          new InputRule({
            // Inline math `$ … $` — single dollars, no spaces immediately
            // inside, no adjacent extra `$` so this doesn't fight the
            // block rule above.
            find: /(?<!\$)\$([^$\n]+?)\$(?!\$)/,
            handler: ({ state, range, match }) => {
              const latex = match[1].trim();
              if (!latex) return;
              const { tr } = state;
              tr.replaceWith(range.from, range.to, this.type.create({ latex }));
            },
          }),
        ];
      },
    }).configure({
      katexOptions: { throwOnError: false },
      onClick: (node, pos) => {
        window.dispatchEvent(
          new CustomEvent(EDIT_MATH_EVENT, {
            detail: {
              type: "inline",
              pos,
              latex: (node.attrs.latex as string | undefined) ?? "",
            },
          }),
        );
      },
    }),
  ];
}
