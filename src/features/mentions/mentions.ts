import type { AnyExtension } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import { mentionSuggestion } from "./MentionList";

// features.mentions — `@` picker for people (via the host's loadMentionUsers
// handler) and pages (via the workspace pages store).
export function create(): AnyExtension[] {
  return [
    Mention.configure({
      HTMLAttributes: {
        class: "rdump-mention",
        "data-type": "mention",
      },
      renderText({ node }) {
        return `@${node.attrs.label ?? node.attrs.id}`;
      },
      suggestion: mentionSuggestion,
    }),
  ];
}
