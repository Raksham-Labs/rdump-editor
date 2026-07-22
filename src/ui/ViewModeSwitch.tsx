"use client";

import { Code, Columns2, PenLine, type LucideIcon } from "lucide-react";

// The three ways to look at a document: the rich WYSIWYG editor, the raw
// markdown source, or both at once. Split is responsive — side by side on a
// wide screen, stacked on a narrow one (handled in CSS).
export type ViewMode = "editor" | "split" | "markdown";

export function isViewMode(value: string | null): value is ViewMode {
  return value === "editor" || value === "split" || value === "markdown";
}

const VIEW_OPTIONS: {
  value: ViewMode;
  label: string;
  title: string;
  icon: LucideIcon;
}[] = [
  { value: "editor", label: "Editor", title: "Rich editor", icon: PenLine },
  { value: "split", label: "Split", title: "Editor + Markdown side by side", icon: Columns2 },
  { value: "markdown", label: "Markdown", title: "Markdown source", icon: Code },
];

// Three-way view switch (Editor / Split / Markdown), rendered at the right of
// the toolbar row.
export function ViewModeSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="rdump-viewswitch" role="group" aria-label="Editor view">
      {VIEW_OPTIONS.map(({ value: mode, label, title, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          className="rdump-viewswitch__btn"
          data-active={value === mode ? "true" : "false"}
          aria-pressed={value === mode}
          title={title}
          onClick={() => onChange(mode)}
        >
          <Icon size={14} />
          <span className="rdump-viewswitch__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
