"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ToolbarButton, type IconComponent } from "./ToolbarButton";
import "./ToolbarMenu.css";

// Generic dropdown for toolbar surfaces: a ToolbarButton trigger with an
// anchored popover row beneath it. Children are a render function receiving
// close() so item clicks can dismiss the menu.
export function ToolbarMenu({
  icon,
  label,
  description,
  active,
  disabled,
  layout = "row",
  popClassName,
  children,
}: {
  icon: IconComponent;
  label: string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  // "row" — horizontal strip of icon buttons; "list" — vertical labeled items.
  layout?: "row" | "list";
  popClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="rdump-toolbar-menu">
      <ToolbarButton
        icon={icon}
        label={label}
        description={description}
        active={active}
        disabled={disabled}
        chevron
        onClick={() => setOpen((o) => !o)}
      />
      {open ? (
        <div
          className={`rdump-toolbar-menu__pop${
            layout === "list" ? " rdump-toolbar-menu__pop--list" : ""
          }${popClassName ? ` ${popClassName}` : ""}`}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
