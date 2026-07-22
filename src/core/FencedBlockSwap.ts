import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { ChartKind, ChartRow } from "../features/charts/ChartBlock";

// Live-typing companion to the markdown serialize/parse round-trip on
// MermaidBlock and ChartBlock.
//
// When the user types ```mermaid<Enter>code<Enter>, StarterKit's CodeBlock
// rule fires first and creates a `codeBlock` with `language="mermaid"`.
// This plugin watches for such blocks at the top level and swaps them for
// MermaidBlock / ChartBlock — but only once the cursor has moved out of
// the block, so we never yank the caret out from under the user mid-type.

const KEY = new PluginKey("fencedBlockSwap");

export const FencedBlockSwap = Extension.create({
  name: "fencedBlockSwap",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: KEY,
        appendTransaction: (transactions, _oldState, newState) => {
          if (transactions.some((tr) => tr.getMeta(KEY))) return null;
          if (
            !transactions.some(
              (tr) => tr.docChanged || tr.selectionSet,
            )
          ) {
            return null;
          }

          const { schema, doc, selection } = newState;
          const mermaidType = schema.nodes.mermaid;
          const chartType = schema.nodes.chart;
          if (!mermaidType && !chartType) return null;

          type Swap = {
            from: number;
            to: number;
            replacement: ReturnType<typeof mermaidType.create>;
          };
          const swaps: Swap[] = [];

          doc.descendants((node, pos) => {
            if (node.type.name !== "codeBlock") return;
            const lang = (node.attrs as { language?: string }).language;
            if (lang !== "mermaid" && lang !== "chart") return;
            // Skip if the selection sits inside this block — wait for the
            // user to navigate out before swapping.
            const start = pos;
            const end = pos + node.nodeSize;
            if (selection.from >= start && selection.from <= end) return;

            if (lang === "mermaid" && mermaidType) {
              const code = node.textContent;
              swaps.push({
                from: start,
                to: end,
                replacement: mermaidType.create({ code }),
              });
            } else if (lang === "chart" && chartType) {
              let kind: ChartKind = "bar";
              let data: ChartRow[] = [];
              try {
                const parsed = JSON.parse(node.textContent || "{}") as {
                  kind?: ChartKind;
                  data?: ChartRow[];
                };
                if (parsed.kind) kind = parsed.kind;
                if (Array.isArray(parsed.data)) data = parsed.data;
              } catch {
                // Invalid JSON — leave it as a code block. Better than
                // silently dropping the user's text into a default chart.
                return;
              }
              swaps.push({
                from: start,
                to: end,
                replacement: chartType.create({ kind, data }),
              });
            }
          });

          if (swaps.length === 0) return null;

          const tr = newState.tr;
          tr.setMeta(KEY, true);
          // Replace in reverse order so earlier positions stay valid.
          for (let i = swaps.length - 1; i >= 0; i--) {
            const { from, to, replacement } = swaps[i];
            tr.replaceWith(from, to, replacement);
          }
          return tr;
        },
      }),
    ];
  },
});
