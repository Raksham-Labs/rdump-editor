import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Mapping, ReplaceStep } from "@tiptap/pm/transform";

// Keeps nested task trees consistent: a parent task item is checked exactly
// when all of its child items are checked.
//
// - Ticking the last open child auto-ticks the parent (and so on upward);
//   unticking any child reopens every ancestor.
// - Ticking/unticking a parent directly cascades the new state down to all
//   of its descendants (the only self-consistent reading of the invariant).
//
// The rule runs only on interactive edits that actually touch task state —
// checkbox toggles and task items being added/removed/re-nested. It never
// runs on whole-document replaces (doc open, external sync, markdown-pane
// re-parse), so legacy documents and hand-authored markdown with
// "inconsistent" trees are left exactly as written until the user toggles
// something in that list.

const pluginKey = new PluginKey("checklistAutoCheck");

const isTaskItem = (node: PMNode | null | undefined): node is PMNode =>
  node?.type.name === "taskItem";
const isTaskList = (node: PMNode | null | undefined): node is PMNode =>
  node?.type.name === "taskList";

interface TreeItem {
  pos: number; // position of the taskItem in the new doc
  actual: boolean; // checked attr currently in the doc
  toggled: boolean; // this exact item was flipped by this update
  final: boolean; // resolved target state
  children: TreeItem[];
}

function taskItemTotal(doc: PMNode): number {
  let count = 0;
  doc.descendants((node) => {
    if (isTaskItem(node)) count += 1;
    return true;
  });
  return count;
}

// Child items of a task item live as direct taskList children of the item;
// deeper task lists belong to the grandchildren's own subtrees.
function buildItems(
  list: PMNode,
  listPos: number,
  toggled: Map<number, boolean>,
): TreeItem[] {
  const items: TreeItem[] = [];
  list.forEach((child, offset) => {
    if (!isTaskItem(child)) return;
    items.push(buildItem(child, listPos + 1 + offset, toggled));
  });
  return items;
}

function buildItem(
  node: PMNode,
  pos: number,
  toggled: Map<number, boolean>,
): TreeItem {
  const children: TreeItem[] = [];
  node.forEach((child, offset) => {
    if (isTaskList(child)) {
      children.push(...buildItems(child, pos + 1 + offset, toggled));
    }
  });
  const actual = Boolean(node.attrs.checked);
  return { pos, actual, toggled: toggled.has(pos), final: actual, children };
}

// Resolves each item's target state: a directly-toggled parent forces its
// whole subtree to the toggled value; everything else rolls up from the
// leaves (parent = all children done).
function resolveFinal(item: TreeItem, forced: boolean | null): boolean {
  const force =
    forced !== null
      ? forced
      : item.toggled && item.children.length
        ? item.actual
        : null;
  if (!item.children.length) {
    item.final = force !== null ? force : item.actual;
    return item.final;
  }
  let all = true;
  for (const child of item.children) {
    if (!resolveFinal(child, force)) all = false;
  }
  item.final = force !== null ? force : all;
  return item.final;
}

function applyFinal(items: TreeItem[], write: (item: TreeItem) => void) {
  for (const item of items) {
    if (item.final !== item.actual) write(item);
    applyFinal(item.children, write);
  }
}

export const ChecklistAutoCheck = Extension.create({
  name: "checklistAutoCheck",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          // Skip our own output and history replay — re-normalizing an undo
          // would fight the user's ability to undo the cascade itself.
          if (transactions.some((tr) => tr.getMeta(pluginKey))) return null;
          if (transactions.some((tr) => tr.getMeta("history$"))) return null;
          // Whole-document replaces are loads, external syncs, or markdown
          // pane re-parses — never a checkbox interaction.
          if (
            transactions.some(
              (tr) =>
                tr.steps.length > 0 &&
                tr.steps[0] instanceof ReplaceStep &&
                tr.steps[0].from === 0 &&
                tr.steps[0].to === tr.before.content.size,
            )
          ) {
            return null;
          }

          const oldDoc = oldState.doc;
          const newDoc = newState.doc;

          const stepMaps = transactions.flatMap((tr) =>
            tr.steps.map((step) => step.getMap()),
          );
          if (!stepMaps.length) return null;
          const mapping = new Mapping(stepMaps);
          const inverted = mapping.invert();

          // Changed ranges, expressed in final-doc coordinates.
          const ranges: Array<{ from: number; to: number }> = [];
          stepMaps.forEach((map, index) => {
            const rest = mapping.slice(index + 1);
            map.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
              ranges.push({
                from: rest.map(newFrom, -1),
                to: rest.map(newTo, 1),
              });
            });
          });
          if (!ranges.length) return null;

          const clampNew = (pos: number) =>
            Math.max(0, Math.min(pos, newDoc.content.size));
          const clampOld = (pos: number) =>
            Math.max(0, Math.min(pos, oldDoc.content.size));

          // Nearest ancestor task item's start, or -1 for a top-level item.
          const nearestItemStart = (doc: PMNode, pos: number): number => {
            const $pos = doc.resolve(pos);
            for (let depth = $pos.depth; depth > 0; depth--) {
              if (isTaskItem($pos.node(depth))) return $pos.before(depth);
            }
            return -1;
          };

          const toggled = new Map<number, boolean>();
          // Outermost task lists (new doc) that need their tree reconciled.
          const affectedLists = new Map<number, PMNode>();
          let structural = false;
          let taskAdjacent = false;

          const noteOutermostListAt = (pos: number) => {
            const $pos = newDoc.resolve(clampNew(pos));
            for (let depth = 1; depth <= $pos.depth; depth++) {
              if (isTaskList($pos.node(depth))) {
                affectedLists.set($pos.before(depth), $pos.node(depth));
                return;
              }
            }
          };

          for (const range of ranges) {
            const from = clampNew(range.from);
            const to = clampNew(range.to);

            // A collapsed range (deletion point) inside a task list still
            // marks that list as affected.
            const $from = newDoc.resolve(from);
            for (let depth = $from.depth; depth > 0; depth--) {
              const ancestor = $from.node(depth);
              if (isTaskList(ancestor) || isTaskItem(ancestor)) {
                taskAdjacent = true;
                noteOutermostListAt(from);
                break;
              }
            }

            newDoc.nodesBetween(from, to, (node, pos) => {
              if (isTaskList(node)) {
                taskAdjacent = true;
                noteOutermostListAt(pos + 1);
              }
              if (!isTaskItem(node)) return true;
              taskAdjacent = true;

              const oldPos = clampOld(inverted.map(pos));
              const oldNode = oldDoc.nodeAt(oldPos);
              if (!isTaskItem(oldNode)) {
                // Freshly inserted item (typed rule, paste, split).
                structural = true;
                return true;
              }
              if (
                Boolean(oldNode.attrs.checked) !== Boolean(node.attrs.checked)
              ) {
                if (oldNode.content.eq(node.content)) {
                  // Pure checkbox flip — cascade-worthy.
                  toggled.set(pos, Boolean(node.attrs.checked));
                } else {
                  // Replaced by different content that happens to differ in
                  // state — reconcile, but don't force a subtree.
                  structural = true;
                }
              }
              // Indent/outdent/move re-parents an item without changing
              // counts or state; ancestors on both sides need a recompute.
              const oldParent = nearestItemStart(oldDoc, oldPos);
              const newParent = nearestItemStart(newDoc, pos);
              const mappedOldParent =
                oldParent < 0 ? -1 : mapping.map(oldParent);
              if (mappedOldParent !== newParent) structural = true;
              return true;
            });
          }

          if (!taskAdjacent) return null;
          if (!structural && !toggled.size) {
            // Deletions leave no task items inside the changed range —
            // catch them by comparing totals. (Only runs on task-adjacent
            // edits, so plain typing never pays for a doc walk.)
            structural = taskItemTotal(oldDoc) !== taskItemTotal(newDoc);
          }
          if (!structural && !toggled.size) return null;
          if (!affectedLists.size) return null;

          const tr = newState.tr;
          for (const [listPos, listNode] of affectedLists) {
            const items = buildItems(listNode, listPos, toggled);
            for (const item of items) resolveFinal(item, null);
            // setNodeAttribute never shifts positions, so every pos gathered
            // from the new doc stays valid while we write.
            applyFinal(items, (item) =>
              tr.setNodeAttribute(item.pos, "checked", item.final),
            );
          }

          if (!tr.steps.length) return null;
          tr.setMeta(pluginKey, true);
          return tr;
        },
      }),
    ];
  },
});
