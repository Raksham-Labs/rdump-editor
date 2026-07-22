"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentType } from "react";
import "./Toolbar.css";

export type IconComponent = ComponentType<{ size?: number; className?: string }>;

// The shared icon button for every chrome surface (fixed toolbar, bubble
// bar, dropdown rows). Lives outside Toolbar.tsx so menus that are embedded
// in the toolbar can use it without a circular import. `chevron` marks
// menu triggers with a small ▾ so it's visible that the button opens a
// dropdown rather than toggling something.
export function ToolbarButton({
  icon: Icon,
  label,
  description,
  active,
  disabled,
  chevron,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={description ? `${label} — ${description}` : label}
      aria-haspopup={chevron ? "menu" : undefined}
      disabled={disabled}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className={`rdump-toolbar__btn${chevron ? " rdump-toolbar__btn--menu" : ""}`}
    >
      <Icon size={15} />
      {chevron ? <ChevronDown size={9} className="rdump-toolbar__btn-chevron" /> : null}
      <span className="rdump-toolbar__tip" role="tooltip">
        <span className="rdump-toolbar__tip-title">{label}</span>
        {description ? (
          <span className="rdump-toolbar__tip-desc">{description}</span>
        ) : null}
      </span>
    </button>
  );
}
