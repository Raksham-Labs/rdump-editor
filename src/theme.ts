import type { CSSProperties } from "react";

// Theming surface for hosts.
//
// Three layers, weakest to strongest:
//   1. styles/theme.css defaults — light-dark() pairs on :where(:root),
//      zero specificity.
//   2. Host CSS: define any of the same custom properties on :root (or any
//      ancestor) to re-theme every editor. Plain colors pin both modes; a
//      light-dark() pair themes each mode separately.
//   3. The `themeVars` component prop — inline vars on that instance's
//      wrapper, beating both stylesheets.
//
// Which side of a light-dark() pair renders is controlled by the `theme`
// prop ("light" | "dark" | "auto"), carried as data-rdump-color-scheme on
// the editor wrapper.

export type RDumpEditorTheme = "light" | "dark" | "auto";

export type ThemeTokenName =
  | "background"
  | "panel"
  | "panel-subtle"
  | "foreground"
  | "foreground-soft"
  | "muted"
  | "muted-strong"
  | "muted-bg"
  | "border"
  | "border-strong"
  | "accent"
  | "accent-hover"
  | "accent-soft"
  | "accent-soft-strong"
  | "accent-fg"
  | "accent-text"
  | "danger"
  | "danger-soft"
  | "danger-soft-strong"
  | "warning"
  | "warning-soft"
  | "warning-soft-strong"
  | "success"
  | "success-soft"
  | "success-soft-strong"
  | "radius-sm"
  | "radius-md"
  | "radius-lg"
  | "shadow-popover"
  | "shadow-float"
  | "duration-fast"
  | "font-sans"
  | "font-mono";

// Token overrides for one editor instance, keyed without the leading `--`.
// Values are raw CSS — a color, a light-dark() pair, a shadow list, a font
// stack — whatever the token holds.
export type RDumpThemeVars = Partial<Record<ThemeTokenName, string>>;

export function themeVarsToStyle(vars?: RDumpThemeVars): CSSProperties | undefined {
  if (!vars) return undefined;
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(vars)) {
    if (value) style[`--${name}`] = value;
  }
  return style as CSSProperties;
}

/**
 * Copies the editor's theme onto an element portaled to <body> (slash menu,
 * suggestion popups). Those live outside the editor wrapper's DOM subtree,
 * so they'd otherwise miss both the color-scheme attribute and any
 * `themeVars` inline overrides and render light inside a dark editor.
 */
export function inheritEditorTheme(target: HTMLElement, editorDom: HTMLElement): void {
  const wrap = editorDom.closest<HTMLElement>("[data-rdump-color-scheme]");
  if (!wrap) return;
  const scheme = wrap.getAttribute("data-rdump-color-scheme");
  if (scheme) target.setAttribute("data-rdump-color-scheme", scheme);
  for (let i = 0; i < wrap.style.length; i += 1) {
    const prop = wrap.style.item(i);
    if (prop.startsWith("--")) {
      target.style.setProperty(prop, wrap.style.getPropertyValue(prop));
    }
  }
}
