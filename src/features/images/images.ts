import type { AnyExtension } from "@tiptap/core";
import { ResizableImage } from "./ResizableImage";

// features.images — resizable image node. The upload path (paste/drop and
// the image popover) reads the host's uploadImage handler from the runtime;
// see imageInsert.ts.
export function create(): AnyExtension[] {
  return [
    ResizableImage.configure({
      allowBase64: true,
      HTMLAttributes: { class: "rdump-image" },
      resize: {
        enabled: true,
        directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
        minWidth: 80,
        alwaysPreserveAspectRatio: true,
      },
    }),
  ];
}
