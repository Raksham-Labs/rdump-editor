"use client";

import TaskList from "@tiptap/extension-task-list";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import "./Checklist.css";

// Tallies every descendant task item — nested subtasks included, matching
// what the eye would count (same as GitHub's "x of y tasks"). Progress is
// derived at render time and never stored as a node attr, so the canonical
// markdown round-trip (plain GFM `- [ ]` lines) is untouched.
export function countTaskItems(node: PMNode): { done: number; total: number } {
  let done = 0;
  let total = 0;
  node.descendants((child) => {
    if (child.type.name === "taskItem") {
      total += 1;
      if (child.attrs.checked) done += 1;
    }
    return true;
  });
  return { done, total };
}

function ChecklistView({ node }: NodeViewProps) {
  const { done, total } = countTaskItems(node);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;

  return (
    <NodeViewWrapper
      as="div"
      className="rdump-checklist"
      data-complete={complete ? "true" : undefined}
    >
      {/* Decorative overlay — the checkboxes themselves are the accessible
          source of truth, and the count text (not color) states completion. */}
      <div
        className="rdump-checklist__meta"
        contentEditable={false}
        aria-hidden="true"
      >
        <span className="rdump-checklist__bar">
          <span
            className="rdump-checklist__fill"
            data-some={done > 0 ? "true" : undefined}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="rdump-checklist__count">
          {done}/{total}
        </span>
      </div>
      {/* Keep the ul's data-type so every existing task-list style and paste
          rule keeps matching the same DOM it always has. */}
      <NodeViewContent<"ul"> as="ul" data-type="taskList" />
    </NodeViewWrapper>
  );
}

// The stock TaskList node with a React node view layered on top: same schema,
// same name, same markdown round-trip — plus the hover progress chip.
export const ChecklistTaskList = TaskList.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ChecklistView);
  },
});
