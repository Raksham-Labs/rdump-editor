import type { AnyExtension } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { CodeBlockView } from "./CodeBlockView";

// features.codeBlocks — syntax-highlighted code blocks. lowlight (and its
// grammar set) only loads when this module does, i.e. when the feature is on;
// with the feature off the base StarterKit codeBlock keeps fences intact.
const lowlight = createLowlight(common);

export function create(): AnyExtension[] {
  return [
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
      },
    }).configure({
      lowlight,
      defaultLanguage: "plaintext",
    }),
  ];
}
