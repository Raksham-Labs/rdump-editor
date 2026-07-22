import { Extension, InputRule } from "@tiptap/core";

// Notion-style typing rule: turn `[ ] ` / `[x] ` (with optional leading
// whitespace) at the start of a block into a task list item. Works whether
// the user typed it raw or first triggered StarterKit's bullet rule with
// `- ` (we lift out of the bullet list before re-wrapping).

// Match `[ ]`, `[]`, `[x]` and `[X]` (with or without an inner space).
// Anything other than `x`/`X` inside is treated as unchecked, matching
// Notion / GFM behavior.
const TASK_PATTERN = /^\s*\[([ xX]?)]\s$/;

export const TaskListInputRule = Extension.create({
  name: "taskListInputRule",

  addInputRules() {
    return [
      new InputRule({
        find: TASK_PATTERN,
        handler: ({ state, range, match, chain }) => {
          const checked = match[1].toLowerCase() === "x";

          // Detect whether the matched range lives inside a regular list
          // item — if so we need to unwrap it before toggleTaskList, or
          // we'd end up with a task list nested inside a bullet.
          const $from = state.doc.resolve(range.from);
          let inListItem = false;
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === "listItem") {
              inListItem = true;
              break;
            }
          }

          let pipeline = chain().deleteRange({
            from: range.from,
            to: range.to,
          });

          if (inListItem) {
            pipeline = pipeline.liftListItem("listItem");
          }

          pipeline
            .toggleTaskList()
            .updateAttributes("taskItem", { checked })
            .run();
        },
      }),
    ];
  },
});
