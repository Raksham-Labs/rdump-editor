"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Effective color scheme ("light" | "dark") for a node inside the editor.
 * Resolves the wrapper's data-rdump-color-scheme attribute — with "auto"
 * deferring to the OS — and stays live across theme-prop changes (attribute
 * mutation) and OS preference flips. For content that can't be themed with
 * CSS tokens alone, e.g. the Mermaid renderer's own theme option.
 */
export function useEditorColorScheme(
  ref: RefObject<HTMLElement | null>,
): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wrap = el.closest<HTMLElement>("[data-rdump-color-scheme]");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const compute = () => {
      const attr = wrap?.getAttribute("data-rdump-color-scheme");
      setScheme(attr === "dark" || (attr === "auto" && media.matches) ? "dark" : "light");
    };
    compute();
    if (!wrap) return;
    const observer = new MutationObserver(compute);
    observer.observe(wrap, {
      attributes: true,
      attributeFilter: ["data-rdump-color-scheme"],
    });
    media.addEventListener("change", compute);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", compute);
    };
  }, [ref]);

  return scheme;
}
