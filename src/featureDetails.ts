import type { AnyExtension } from "@tiptap/core";
import Details, { DetailsContent, DetailsSummary } from "@tiptap/extension-details";

// features.details — collapsible toggle blocks.
export function create(): AnyExtension[] {
  return [
    Details.configure({
      persist: true,
      HTMLAttributes: { class: "rdump-details" },
      // Filled right-pointing triangle SVG injected into the toggle button.
      // Filled (not stroked) so there are no round line-caps to render as
      // dots at the icon's small size — that was the "bullet" artifact from
      // the lucide ChevronRight version. The Details extension renders the
      // button as plain DOM, hence innerHTML rather than a React node.
      renderToggleButton: ({ element, isOpen }) => {
        element.setAttribute(
          "aria-label",
          isOpen ? "Collapse toggle content" : "Expand toggle content",
        );
        element.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 1.5l4 3.5-4 3.5z" fill="currentColor"/></svg>';
      },
    }),
    DetailsSummary,
    DetailsContent,
  ];
}
