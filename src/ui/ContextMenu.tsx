"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { inheritEditorTheme } from "../theme";
import "./ContextMenu.css";

export interface ContextMenuItem {
  label?: string;
  onClick?: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

// Gap preserved between the menu and the viewport edge.
const VIEWPORT_MARGIN = 8;

export function ContextMenu({
  x,
  y,
  items,
  onClose,
  themeSource,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  // Any element inside the editor wrapper. The menu portals to <body>,
  // outside the themed subtree, so the color scheme is copied from here.
  themeSource?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Hidden until measured so the first paint lands at the resolved anchor,
  // never briefly at the raw click point.
  const [style, setStyle] = useState<CSSProperties>({ left: x, top: y, visibility: "hidden" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Anchor toward the side with room. Horizontally: open to the right of the
  // cursor if the menu fits, else flip to the left, else pin to the wider side.
  // Vertically: drop down if it fits, else flip up, else anchor to the taller
  // side and cap the height so the menu scrolls within view. This keeps every
  // item reachable wherever the click lands — including a tall menu near the
  // bottom edge (e.g. the table menu).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (themeSource) inheritEditorTheme(el, themeSource);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = el.offsetWidth;
    const menuH = el.scrollHeight; // natural height, ignoring any prior cap

    const spaceRight = vw - x;
    const spaceLeft = x;
    let left: number;
    if (menuW + VIEWPORT_MARGIN <= spaceRight) {
      left = x;
    } else if (menuW + VIEWPORT_MARGIN <= spaceLeft) {
      left = x - menuW;
    } else if (spaceRight >= spaceLeft) {
      left = Math.max(VIEWPORT_MARGIN, vw - menuW - VIEWPORT_MARGIN);
    } else {
      left = VIEWPORT_MARGIN;
    }

    const spaceBelow = vh - y;
    const spaceAbove = y;
    let top: number;
    let maxHeight: number | undefined;
    if (menuH + VIEWPORT_MARGIN <= spaceBelow) {
      top = y;
    } else if (menuH + VIEWPORT_MARGIN <= spaceAbove) {
      top = y - menuH;
    } else if (spaceBelow >= spaceAbove) {
      top = y;
      maxHeight = spaceBelow - VIEWPORT_MARGIN;
    } else {
      maxHeight = spaceAbove - VIEWPORT_MARGIN;
      top = y - maxHeight;
    }

    setStyle({
      left: Math.round(left),
      top: Math.round(Math.max(VIEWPORT_MARGIN, top)),
      maxHeight: maxHeight ? Math.round(maxHeight) : undefined,
      visibility: "visible",
    });
    // `mounted` is a dep so this re-runs once the portal is actually in the DOM
    // (the first pass bails early because `ref` is still null) — otherwise the
    // menu would stay `visibility: hidden` and never appear.
  }, [x, y, items.length, mounted, themeSource]);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointer);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={ref}
      className="rdump-ctx-menu"
      style={style}
      role="menu"
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={index} className="rdump-ctx-sep" role="separator" />;
        }
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`rdump-ctx-item${item.destructive ? " rdump-ctx-item--danger" : ""}`}
            onClick={() => {
              if (item.disabled || !item.onClick) return;
              item.onClick();
              onClose();
            }}
          >
            {item.icon ? <span className="rdump-ctx-icon">{item.icon}</span> : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}