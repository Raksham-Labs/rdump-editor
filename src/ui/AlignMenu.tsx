"use client";

import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  type LucideIcon,
} from "lucide-react";
import { applyBlockAlignment, type BlockAlignment } from "./alignment";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarMenu } from "./ToolbarMenu";

export const ALIGNMENTS: { value: BlockAlignment; label: string; icon: LucideIcon }[] = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
  { value: "justify", label: "Justify", icon: AlignJustify },
];

// Compact alignment picker shared by the toolbar and bubble bar: the trigger
// shows the current alignment's icon and expands to the full set — four
// inline buttons would crowd either surface.
export function AlignMenu({
  editor,
  align,
  disabled,
  description,
}: {
  editor: Editor;
  align: BlockAlignment;
  disabled?: boolean;
  description?: string;
}) {
  const current = ALIGNMENTS.find((a) => a.value === align) ?? ALIGNMENTS[0];
  return (
    <ToolbarMenu
      icon={current.icon}
      label="Text alignment"
      description={description}
      active={align !== "left"}
      disabled={disabled}
    >
      {(close) =>
        ALIGNMENTS.map((a) => (
          <ToolbarButton
            key={a.value}
            icon={a.icon}
            label={a.label}
            active={align === a.value}
            onClick={() => {
              applyBlockAlignment(editor, a.value);
              close();
            }}
          />
        ))
      }
    </ToolbarMenu>
  );
}
