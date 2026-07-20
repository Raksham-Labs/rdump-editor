import { getHTMLFromFragment } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { serializeImageMarkdown, type ImageAttrs } from "./ResizableImage";

/**
 * Table markdown serialization.
 *
 * tiptap-markdown ships its own `table` serializer, and it drops image cells
 * on the floor: it only ever looks at `cell.firstChild` and guards the write
 * with `if (cellContent.textContent.trim())`. An image is a leaf block with no
 * text content, so a cell holding just an image serializes to `|  |` — the
 * picture is gone the moment the doc is saved, while the identical image one
 * line below the table round-trips fine.
 *
 * This replaces that serializer. A cell's own extension storage wins over
 * tiptap-markdown's defaults (see its `getMarkdownSpec`), so defining
 * `storage.markdown.serialize` here is enough to take over; `parse` still
 * falls through to markdown-it.
 *
 * Output is byte-identical to upstream for every table that already
 * serialized cleanly, so opening an existing doc doesn't mark it dirty.
 */

function childNodes(node: PMNode | undefined): PMNode[] {
  return (node?.content as unknown as { content?: PMNode[] })?.content ?? [];
}

function hasSpan(cell: PMNode): boolean {
  return cell.attrs.colspan > 1 || cell.attrs.rowspan > 1;
}

/**
 * A cell is inline-renderable when its single child is either a textblock
 * (the normal case) or an image (the case upstream loses). Anything else — a
 * list, a code block, a callout, or more than one block — can't be spelled as
 * GFM inline content, and sends the whole table down the raw-HTML path where
 * nothing is lost.
 */
function isCellSerializable(cell: PMNode): boolean {
  const children = childNodes(cell);
  if (children.length > 1) return false;
  const only = children[0];
  if (!only) return true;
  return only.isTextblock || only.type.name === "image";
}

function isMarkdownSerializable(node: PMNode): boolean {
  const rows = childNodes(node);
  const [firstRow, ...bodyRows] = rows;
  if (
    childNodes(firstRow).some(
      (cell) =>
        cell.type.name !== "tableHeader" || hasSpan(cell) || !isCellSerializable(cell),
    )
  ) {
    return false;
  }
  return !bodyRows.some((row) =>
    childNodes(row).some(
      (cell) =>
        cell.type.name === "tableHeader" || hasSpan(cell) || !isCellSerializable(cell),
    ),
  );
}

type SerializerState = {
  write: (s: string) => void;
  esc: (s: string, startOfLine?: boolean) => string;
  ensureNewLine: () => void;
  closeBlock: (n: unknown) => void;
  renderInline: (n: PMNode) => void;
  inTable: boolean;
};

// A row lives on one line, so an unescaped pipe anywhere in a cell (an image
// filename used as alt text, say) would split it into extra columns.
function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|");
}

/**
 * The raw-HTML escape hatch for tables GFM can't express (merged cells, a
 * callout or list inside a cell). Reproduces tiptap-markdown's HTMLNode
 * serializer — including the `formatBlock` line breaks — byte for byte, so
 * docs that already take this path don't get rewritten (and flagged dirty)
 * the first time they're opened after this change.
 */
function serializeTableHTML(node: PMNode, parent: PMNode | Fragment): string {
  const schema = node.type.schema;
  const html = getHTMLFromFragment(Fragment.from(node), schema);
  const atTopLevel =
    parent instanceof Fragment || parent.type.name === schema.topNodeType.name;
  if (!node.isBlock || !atTopLevel) return html;
  const body = new window.DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
    .body;
  const element = body.firstElementChild;
  if (!element) return html;
  element.innerHTML = element.innerHTML.trim() ? `\n${element.innerHTML}\n` : "\n";
  return element.outerHTML;
}

export const MarkdownTable = Table.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(state: SerializerState, node: PMNode, parent: PMNode | Fragment) {
          if (!isMarkdownSerializable(node)) {
            state.write(serializeTableHTML(node, parent));
            state.closeBlock(node);
            return;
          }
          state.inTable = true;
          node.forEach((row, _pos, rowIndex) => {
            state.write("| ");
            row.forEach((cell, _cellPos, colIndex) => {
              if (colIndex) state.write(" | ");
              const content = cell.firstChild;
              if (!content) return;
              if (content.type.name === "image") {
                state.write(
                  escapePipes(
                    serializeImageMarkdown(content.attrs as ImageAttrs, (s) =>
                      state.esc(s),
                    ),
                  ),
                );
              } else if (content.textContent.trim()) {
                state.renderInline(content);
              }
            });
            state.write(" |");
            state.ensureNewLine();
            if (!rowIndex) {
              const delimiterRow = Array.from({ length: row.childCount })
                .map(() => "---")
                .join(" | ");
              state.write(`| ${delimiterRow} |`);
              state.ensureNewLine();
            }
          });
          state.closeBlock(node);
          state.inTable = false;
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});
