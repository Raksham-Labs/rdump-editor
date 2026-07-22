import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

// Notion-style typing rule: when the user has just finished a GFM table at
// the top level, convert it to a real Tiptap table.
//
// Trigger pattern (at the doc root):
//   paragraph i-1 : `| col | col |`         (header)
//   paragraph i   : `|---|---|`              (delimiter — any number of dashes)
//   paragraph i+1 : `| a | b |` (optional)   (zero or more body rows)
//   …
//   paragraph N   : ``                       (empty — user pressed Enter)
//
// The trailing empty paragraph is the "user stopped typing" signal. While
// they're mid-typing a delimiter or partial body row, nothing fires.
//
// Dashes are matched permissively — ASCII hyphen plus en-dash (U+2013) and
// em-dash (U+2014) — because the Typography extension converts long
// hyphen runs to those characters.

function looksLikeTableRow(text: string): boolean {
  const t = text.trim();
  return t.length >= 3 && t.startsWith("|") && t.endsWith("|");
}

function isTableDelimiter(text: string): boolean {
  if (!text.includes("|")) return false;
  if (!/[\-–—]/.test(text)) return false;
  return text.replace(/[\s|:\-–—]/g, "") === "";
}

function splitRow(text: string): string[] {
  let inner = text.trim();
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").map((cell) => cell.trim());
}

const KEY = new PluginKey("markdownTableInputRule");

export const MarkdownTableInputRule = Extension.create({
  name: "markdownTableInputRule",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: KEY,
        appendTransaction: (transactions, _oldState, newState) => {
          if (transactions.some((tr) => tr.getMeta(KEY))) return null;
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const { schema, doc } = newState;
          const tableType = schema.nodes.table;
          const rowType = schema.nodes.tableRow;
          const headerCellType = schema.nodes.tableHeader;
          const cellType = schema.nodes.tableCell;
          const paragraphType = schema.nodes.paragraph;
          if (
            !tableType ||
            !rowType ||
            !headerCellType ||
            !cellType ||
            !paragraphType
          ) {
            return null;
          }

          let cursor = 0;
          for (let i = 0; i < doc.content.childCount; i++) {
            const node = doc.content.child(i);
            const nodeStart = cursor;
            cursor += node.nodeSize;

            if (node.type.name !== "paragraph") continue;
            if (!isTableDelimiter(node.textContent)) continue;
            if (i === 0) continue;

            const prev = doc.content.child(i - 1);
            if (prev.type.name !== "paragraph") continue;
            if (!looksLikeTableRow(prev.textContent)) continue;

            const headerCells = splitRow(prev.textContent);
            const delimCells = splitRow(node.textContent);
            if (headerCells.length < 2) continue;
            if (headerCells.length !== delimCells.length) continue;

            // Walk forward through consecutive table-shaped paragraphs as
            // body rows. The first non-table-shaped paragraph after them
            // gates the conversion — it must be empty (user pressed Enter)
            // so we don't fire while they're still typing a row.
            const bodyRows: string[][] = [];
            let consumedEnd = cursor; // position after the delimiter node
            let scan = i + 1;
            while (scan < doc.content.childCount) {
              const row = doc.content.child(scan);
              if (row.type.name !== "paragraph") break;
              if (!looksLikeTableRow(row.textContent)) break;
              bodyRows.push(splitRow(row.textContent));
              consumedEnd += row.nodeSize;
              scan++;
            }

            if (scan >= doc.content.childCount) continue;
            const stopper = doc.content.child(scan);
            if (stopper.type.name !== "paragraph") continue;
            if (stopper.textContent.trim() !== "") continue;

            // When the user has just finished the delimiter with no body
            // rows yet, seed an empty row and absorb the stopper paragraph
            // (we want their cursor to land inside the new table). When
            // they've already typed body rows, leave the stopper paragraph
            // alone so the cursor stays where they are below the table.
            const placeCursorInTable = bodyRows.length === 0;
            if (placeCursorInTable) {
              bodyRows.push(headerCells.map(() => ""));
              consumedEnd += stopper.nodeSize;
            }

            const mkParagraph = (text: string) =>
              paragraphType.create(null, text ? schema.text(text) : null);

            const headerRow = rowType.create(
              null,
              headerCells.map((text) =>
                headerCellType.create(null, mkParagraph(text)),
              ),
            );
            const dataRows = bodyRows.map((row) =>
              rowType.create(
                null,
                headerCells.map((_, k) =>
                  cellType.create(null, mkParagraph(row[k] ?? "")),
                ),
              ),
            );
            const tableNode = tableType.create(null, [headerRow, ...dataRows]);

            const fromPos = nodeStart - prev.nodeSize;
            const toPos = consumedEnd;

            const tr = newState.tr;
            tr.setMeta(KEY, true);
            tr.replaceWith(fromPos, toPos, tableNode);

            if (placeCursorInTable) {
              // Step into table > first body row > first cell > paragraph.
              const intoTable = fromPos + 1;
              const intoFirstBodyRow = intoTable + headerRow.nodeSize + 1;
              const intoFirstCell = intoFirstBodyRow + 1;
              const intoFirstCellPara = intoFirstCell + 1;
              const target = tr.doc.resolve(
                Math.min(intoFirstCellPara, tr.doc.content.size),
              );
              tr.setSelection(TextSelection.near(target));
            }

            return tr;
          }

          return null;
        },
      }),
    ];
  },
});
