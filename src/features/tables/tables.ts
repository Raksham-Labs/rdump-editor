import type { AnyExtension } from "@tiptap/core";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { MarkdownTable } from "./MarkdownTable";
import { MarkdownTableInputRule } from "./MarkdownTableInputRule";

// features.tables — MarkdownTable is the stock Table plus a corrected
// markdown serializer; the bundled one drops image cells (see
// MarkdownTable.ts).
export function create(): AnyExtension[] {
  return [
    MarkdownTable.configure({ resizable: true, renderWrapper: true }),
    TableRow,
    TableHeader,
    TableCell,
    MarkdownTableInputRule,
  ];
}
