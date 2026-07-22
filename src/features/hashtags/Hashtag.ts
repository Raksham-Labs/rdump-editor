import { InputRule, Mark, markPasteRule, mergeAttributes } from "@tiptap/core";

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
    return [
      // NOT markInputRule: that helper is built for delimiter-closed
      // patterns (`**bold**`), where the keystroke that completes the match
      // is a delimiter the rule consumes. A live $-anchored pattern like a
      // hashtag re-fires on every keystroke, and whether the keystroke
      // survived depended on whether re-applying the mark produced a step —
      // so characters were alternately eaten and left unmarked (typing
      // "#super" yielded "#spr" with a white trailing letter). This handler
      // owns the transaction instead: it re-inserts the full matched tag —
      // including the just-typed character that handleTextInput suppresses —
      // and marks it, so every keystroke both lands and colors immediately.
      new InputRule({
        find: HASHTAG_INPUT,
        handler: ({ state, range, match }) => {
          const full = match[0];
          const tag = match[match.length - 1];
          const start = range.from + full.indexOf(tag);
          state.tr
            .insertText(tag, start, range.to)
            .addMark(start, start + tag.length, this.type.create())
            .removeStoredMark(this.type);
        },
      }),
    ];
  },

  addPasteRules() {
    return [markPasteRule({ find: HASHTAG_PASTE, type: this.type })];
  },
});
