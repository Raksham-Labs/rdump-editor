"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import "./SlashCommand.css";
import {
  Calculator,
  ChartColumn,
  CheckSquare,
  ChevronRight,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Table as TableIcon,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ForwardedRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { EDIT_MATH_EVENT, OPEN_IMAGE_PICKER_EVENT } from "./events";
import { computeFloatingPosition } from "./floatingPosition";

// Scan the doc near a recently-inserted math node and fire the MathPopover
// open event for it. We can't trust the position we passed to insertBlockMath
// /insertInlineMath because paragraph-splitting can shift the actual landing
// spot. Done in a rAF so the NodeView's DOM is painted before the popover
// measures it via editor.view.nodeDOM(pos).
function openMathEditor(
  editor: Editor,
  type: "inline" | "block",
  nearPos: number,
  latex: string,
) {
  const nodeTypeName = type === "block" ? "blockMath" : "inlineMath";
  const { doc } = editor.state;
  let foundPos: number | null = null;
  doc.nodesBetween(
    Math.max(0, nearPos - 4),
    Math.min(doc.content.size, nearPos + 4),
    (node, pos) => {
      if (foundPos !== null) return false;
      if (node.type.name === nodeTypeName) {
        foundPos = pos;
        return false;
      }
      return true;
    },
  );
  if (foundPos === null) return;
  const pos = foundPos;
  requestAnimationFrame(() => {
    window.dispatchEvent(
      new CustomEvent(EDIT_MATH_EVENT, {
        detail: { type, pos, latex },
      }),
    );
  });
}

type SlashGroup = "Basic" | "Lists" | "Blocks" | "Code & math" | "Media" | "Advanced";

interface SlashItem {
  title: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  group: SlashGroup;
  command: (ctx: { editor: Editor; range: Range }) => void;
}

// Order matters — controls section order in the rendered menu and the
// default keyboard-nav order when no filter is applied.
const GROUP_ORDER: SlashGroup[] = [
  "Basic",
  "Lists",
  "Blocks",
  "Code & math",
  "Media",
  "Advanced",
];

const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Text",
    description: "Plain paragraph.",
    keywords: ["paragraph", "p", "body"],
    icon: FileText,
    group: "Basic",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("paragraph").run(),
  },
  {
    title: "Heading 1",
    description: "Top-level section title.",
    keywords: ["h1", "title"],
    icon: Heading1,
    group: "Basic",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Section heading.",
    keywords: ["h2"],
    icon: Heading2,
    group: "Basic",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Subsection heading.",
    keywords: ["h3"],
    icon: Heading3,
    group: "Basic",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "Unordered list with bullets.",
    keywords: ["bullet", "unordered", "ul"],
    icon: List,
    group: "Lists",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "Ordered list with numbers.",
    keywords: ["numbered", "ordered", "ol"],
    icon: ListOrdered,
    group: "Lists",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Checklist",
    description: "Tasks with progress tracking.",
    keywords: ["task", "todo", "checklist", "check", "progress"],
    icon: CheckSquare,
    group: "Lists",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Blockquote.",
    keywords: ["quote", "blockquote"],
    icon: Quote,
    group: "Blocks",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Callout",
    description: "Highlighted admonition.",
    keywords: ["callout", "info", "admonition", "note"],
    icon: Info,
    group: "Blocks",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("paragraph")
        .setCallout({ variant: "info" })
        .run();
    },
  },
  {
    title: "Toggle",
    description: "Click an arrow to expand or hide content.",
    keywords: ["toggle", "collapsible", "details", "expand", "fold", "spoiler"],
    icon: ChevronRight,
    group: "Blocks",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setDetails().run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule.",
    keywords: ["divider", "hr", "line", "separator"],
    icon: Minus,
    group: "Blocks",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Code block",
    description: "Fenced code with syntax highlight.",
    keywords: ["code", "pre", "fence"],
    icon: Code,
    group: "Code & math",
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCodeBlock({ language: "plaintext" })
        .run(),
  },
  {
    title: "Math block",
    description: "KaTeX equation block.",
    keywords: ["math", "katex", "equation", "latex"],
    icon: Sigma,
    group: "Code & math",
    // Pass explicit pos so the math node lands where the slash trigger was.
    // The extension's commands default to editor.state.selection.from which
    // reads the pre-chain selection — after deleteRange, that's stale, and
    // the math ends up in the wrong block (often a sibling paragraph).
    // After insertion, auto-open the MathPopover so the user can edit the
    // default LaTeX without an extra click.
    command: ({ editor, range }) => {
      const latex = "f(x) = ax^2 + bx + c";
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertBlockMath({ latex, pos: range.from })
        .run();
      openMathEditor(editor, "block", range.from, latex);
    },
  },
  {
    title: "Inline math",
    description: "Inline KaTeX expression.",
    keywords: ["inline math", "katex", "equation"],
    icon: Calculator,
    group: "Code & math",
    command: ({ editor, range }) => {
      const latex = "x^2 + y^2 = r^2";
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertInlineMath({ latex, pos: range.from })
        .run();
      openMathEditor(editor, "inline", range.from, latex);
    },
  },
  {
    title: "Image",
    description: "Upload or paste an image URL.",
    keywords: ["image", "picture", "attachment", "upload"],
    icon: ImageIcon,
    group: "Media",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // Dispatch a CustomEvent picked up by the editor component — keeps the
      // slash extension free of React-state coupling.
      window.dispatchEvent(new CustomEvent(OPEN_IMAGE_PICKER_EVENT));
    },
  },
  {
    title: "Page link",
    description: "Link to another page — or just type [[.",
    keywords: ["page link", "wikilink", "internal", "backlink", "reference", "[["],
    icon: Link2,
    group: "Advanced",
    // Inserting the literal `[[` re-triggers the PageLink suggestion plugin,
    // which owns the picker from here — one flow whether typed or clicked.
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertContent("[[").run(),
  },
  {
    title: "Table",
    description: "Resizable 3x3 table with header.",
    keywords: ["table", "grid"],
    icon: TableIcon,
    group: "Advanced",
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Mermaid diagram",
    description: "Diagram block rendered with Mermaid.",
    keywords: ["mermaid", "diagram", "flowchart"],
    icon: Workflow,
    group: "Advanced",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertMermaid().run(),
  },
  {
    title: "Chart",
    description: "Recharts-powered chart block.",
    keywords: ["chart", "graph", "recharts", "plot"],
    icon: ChartColumn,
    group: "Advanced",
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertChart().run(),
  },
];

// Note: the standalone "Mention" slash item was removed. Users get the
// mention picker by simply typing `@` inline, which is the natural Notion
// flow. Slash menu is for blocks; mentions are inline marks.

// Pre-sort once at module load — items() is called on every keystroke and
// returning a new array reference there caused SlashList's `[items]` effect
// to thrash (resetting index to 0 each press). Authoring order already
// matches GROUP_ORDER so this is just defensive.
const SORTED_SLASH_ITEMS: ReadonlyArray<SlashItem> = [...SLASH_ITEMS].sort(
  (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
);

export interface SlashListRef {
  onKeyDown: (event: ReactKeyboardEvent) => boolean;
}

interface SlashListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export const SlashList = forwardRef(function SlashList(
  { items, command }: SlashListProps,
  ref: ForwardedRef<SlashListRef>,
) {
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [items]);

  const select = (i: number) => {
    const item = items[i];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === "ArrowUp") {
        setIndex((value) => (value + items.length - 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setIndex((value) => (value + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        select(index);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return <div className="rdump-slash rdump-slash--empty">No matching block.</div>;
  }

  // Walk the items in their existing order — they're already grouped because
  // SLASH_ITEMS is authored that way and the filter preserves order. Inject
  // a header whenever the group changes vs. the previous rendered item.
  let lastGroup: SlashGroup | null = null;

  return (
    <div className="rdump-slash" role="listbox">
      {items.map((item, i) => {
        const Icon = item.icon;
        const showHeader = item.group !== lastGroup;
        lastGroup = item.group;
        return (
          <div key={item.title}>
            {showHeader ? (
              <div className="rdump-slash__group">{item.group}</div>
            ) : null}
            <button
              type="button"
              role="option"
              aria-selected={i === index}
              className={`rdump-slash__item${i === index ? " rdump-slash__item--active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(event) => {
                event.preventDefault();
                command(item);
              }}
            >
              <span className="rdump-slash__icon">
                <Icon size={16} />
              </span>
              <span className="rdump-slash__text">
                <span className="rdump-slash__title">{item.title}</span>
                <span className="rdump-slash__desc">{item.description}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        allowSpaces: false,
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
          const normalized = query.toLowerCase().trim();
          if (!normalized) return SORTED_SLASH_ITEMS as SlashItem[];
          return SORTED_SLASH_ITEMS.filter((item) => {
            const haystack = [item.title, ...item.keywords].join(" ").toLowerCase();
            return haystack.includes(normalized);
          });
        },
        command: ({ editor, range, props }) => {
          (props as SlashItem).command({ editor, range });
        },
        render: () => {
          let renderer: ReactRenderer<SlashListRef, SlashListProps> | null = null;

          const position = (props: SuggestionProps<SlashItem>) => {
            if (!renderer) return;
            const rect = props.clientRect?.();
            const element = renderer.element as HTMLElement;
            element.style.position = "fixed";
            element.style.zIndex = "1000";
            if (!rect) return;
            // Place immediately at cursor.bottom — this is correct for the
            // common case. The React portal that fills `element` mounts
            // asynchronously, so measuring it here returns 0×0. We defer
            // the edge-aware refinement to the next frame, by which time
            // the portal has painted and getBoundingClientRect is honest.
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.bottom + 6}px`;
            requestAnimationFrame(() => {
              if (!renderer) return;
              const elRect = element.getBoundingClientRect();
              if (!elRect.width || !elRect.height) return;
              const pos = computeFloatingPosition(
                { left: rect.left, top: rect.top, bottom: rect.bottom },
                { width: elRect.width, height: elRect.height },
              );
              element.style.left = `${pos.left}px`;
              element.style.top = `${pos.top}px`;
            });
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashList, {
                editor: props.editor,
                props: {
                  items: props.items,
                  command: (item: SlashItem) => props.command(item),
                },
              });
              document.body.appendChild(renderer.element);
              position(props);
            },
            onUpdate: (props) => {
              renderer?.updateProps({
                items: props.items,
                command: (item: SlashItem) => props.command(item),
              });
              position(props);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                renderer?.element.remove();
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event as unknown as ReactKeyboardEvent) ?? false;
            },
            onExit: () => {
              renderer?.element.remove();
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
