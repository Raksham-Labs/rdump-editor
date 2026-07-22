"use client";

import type { Editor } from "@tiptap/react";
import { Ban, Highlighter } from "lucide-react";
import { ToolbarMenu } from "./ToolbarMenu";
import "./HighlightMenu.css";

export const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fff3bf" },
  { name: "Green", value: "#d3f9d8" },
  { name: "Blue", value: "#d0ebff" },
  { name: "Pink", value: "#ffdeeb" },
  { name: "Orange", value: "#ffe8cc" },
  { name: "Red", value: "#ffc9c9" },
];

// Highlight color picker shared by the fixed toolbar and the bubble bar:
// a Highlighter trigger that expands to a row of round color dots with a
// slashed "no color" dot at the end (Tiptap-example style).
export function HighlightMenu({
  editor,
  active,
  disabled,
  description,
}: {
  editor: Editor;
  active: boolean;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <ToolbarMenu
      icon={Highlighter}
      label="Highlight"
      description={description}
      active={active}
      disabled={disabled}
      popClassName="rdump-highlight-menu__row"
    >
      {(close) => (
        <>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className="rdump-highlight-menu__swatch"
              title={color.name}
              aria-label={color.name}
              style={{ background: color.value }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: color.value }).run();
                close();
              }}
            />
          ))}
          <button
            type="button"
            className="rdump-highlight-menu__swatch rdump-highlight-menu__swatch--none"
            title="Remove highlight"
            aria-label="Remove highlight"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              close();
            }}
          >
            <Ban size={13} />
          </button>
        </>
      )}
    </ToolbarMenu>
  );
}
