"use client";

import { CellSelection } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/react";
import {
  ArrowDownFromLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  Columns3,
  Heading,
  Merge,
  Rows3,
  Split,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

interface TableMenuState {
  x: number;
  y: number;
}

export function TableContextMenu({
  editor,
  scrollRef,
}: {
  editor: Editor;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [menu, setMenu] = useState<TableMenuState | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onContextMenu = (event: MouseEvent) => {
      if (!editor.isEditable) return;
      const target = event.target as HTMLElement | null;
      const tableEl = target?.closest("table");
      if (!tableEl) return;
      event.preventDefault();

      // Keep an existing multi-cell selection so Merge/Split stay enabled.
      // Only move the cursor to the clicked cell when there's no CellSelection.
      const selection = editor.state.selection;
      if (selection instanceof CellSelection) {
        editor.view.focus();
      } else {
        const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords) {
          editor.chain().focus().setTextSelection(coords.pos).run();
        } else {
          editor.commands.focus();
        }
      }

      setMenu({ x: event.clientX, y: event.clientY });
    };

    container.addEventListener("contextmenu", onContextMenu);
    return () => container.removeEventListener("contextmenu", onContextMenu);
  }, [editor, scrollRef]);

  const close = useCallback(() => setMenu(null), []);

  if (!menu) return null;

  const canMerge = editor.can().mergeCells();
  const canSplit = editor.can().splitCell();

  const items: ContextMenuItem[] = [
    {
      label: "Insert row above",
      icon: <ArrowUpFromLine size={14} />,
      onClick: () => editor.chain().focus().addRowBefore().run(),
    },
    {
      label: "Insert row below",
      icon: <ArrowDownFromLine size={14} />,
      onClick: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      label: "Insert column left",
      icon: <ArrowLeftFromLine size={14} />,
      onClick: () => editor.chain().focus().addColumnBefore().run(),
    },
    {
      label: "Insert column right",
      icon: <ArrowRightFromLine size={14} />,
      onClick: () => editor.chain().focus().addColumnAfter().run(),
    },
    { separator: true },
    {
      label: "Merge cells",
      icon: <Merge size={14} />,
      disabled: !canMerge,
      onClick: () => editor.chain().focus().mergeCells().run(),
    },
    {
      label: "Split cell",
      icon: <Split size={14} />,
      disabled: !canSplit,
      onClick: () => editor.chain().focus().splitCell().run(),
    },
    { separator: true },
    {
      label: "Toggle header row",
      icon: <Heading size={14} />,
      onClick: () => editor.chain().focus().toggleHeaderRow().run(),
    },
    {
      label: "Toggle header column",
      icon: <Heading size={14} />,
      onClick: () => editor.chain().focus().toggleHeaderColumn().run(),
    },
    { separator: true },
    {
      label: "Delete row",
      icon: <Rows3 size={14} />,
      destructive: true,
      onClick: () => editor.chain().focus().deleteRow().run(),
    },
    {
      label: "Delete column",
      icon: <Columns3 size={14} />,
      destructive: true,
      onClick: () => editor.chain().focus().deleteColumn().run(),
    },
    {
      label: "Delete table",
      icon: <Trash2 size={14} />,
      destructive: true,
      onClick: () => editor.chain().focus().deleteTable().run(),
    },
  ];

  return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={close} />;
}
