import type { AnyExtension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { ChecklistAutoCheck } from "./ChecklistAutoCheck";
import { ChecklistTaskList } from "./ChecklistProgress";
import { TaskListInputRule } from "./TaskListInputRule";

// features.taskLists — stock task list + a hover progress chip ("3/12" +
// bar) derived live from the item tree — nothing extra is persisted to
// markdown. Parent items mirror their subtree: all children done ⇒ parent
// done (ChecklistAutoCheck).
export function create(): AnyExtension[] {
  return [
    ChecklistTaskList,
    TaskItem.configure({ nested: true }),
    TaskListInputRule,
    ChecklistAutoCheck,
  ];
}
