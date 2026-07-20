import { Mark, markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core";
import "./Hashtag.css";

const HASHTAG_INPUT = /(?:^|\s)(#[\w-]{1,40})$/;
const HASHTAG_PASTE = /(?:^|\s)(#[\w-]{1,40})(?=\s|$)/g;

export const Hashtag = Mark.create({
  name: "hashtag",
  inclusive: false,
  spanning: false,

  parseHTML() {
    return [{ tag: "span[data-type=\"hashtag\"]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "hashtag", class: "rdump-hashtag" }),
      0,
    ];
  },

  addInputRules() {
    return [markInputRule({ find: HASHTAG_INPUT, type: this.type })];
  },

  addPasteRules() {
    return [markPasteRule({ find: HASHTAG_PASTE, type: this.type })];
  },
});
