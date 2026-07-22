"use client";

import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { ChainedCommands, Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  CheckSquare,
  Code,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  type LucideIcon,
  Plus,
  Quote,
  Trash2,
  Type,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import "./BlockGutter.css";

interface BlockGutterProps {
  editor: Editor;
}

interface HoverNode {
  node: ProseMirrorNode;
  pos: number;
}

// Node types where "Turn into" doesn't make sense (custom block kinds with
// their own internal structure). Hover-menu still offers Duplicate / Delete.
const NON_CONVERTIBLE = new Set([
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "codeBlock",
  "mermaidBlock",
  "chartBlock",
  "callout",
  "details",
  "detailsSummary",
  "detailsContent",
  "image",
  "horizontalRule",
]);

export function BlockGutter({ editor }: BlockGutterProps) {
  const [hover, setHover] = useState<HoverNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const insertBelow = () => {
    if (!hover) {
      // Fallback — if we somehow lost the hover ref, append a paragraph at doc end.
      editor.chain().focus("end").insertContent({ type: "paragraph" }).insertContent("/").run();
      return;
    }
    const insertPos = hover.pos + hover.node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: "paragraph" })
      .setTextSelection(insertPos + 1)
      .insertContent("/")
      .run();
  };

  const runOnHovered = (apply: (chain: ChainedCommands) => ChainedCommands) => {
    if (!hover) return;
    apply(editor.chain().focus(hover.pos + 1)).run();
    setMenuOpen(false);
  };

  const duplicate = () => {
    if (!hover) return;
    const json = hover.node.toJSON();
    editor
      .chain()
      .focus()
      .insertContentAt(hover.pos + hover.node.nodeSize, json)
      .run();
    setMenuOpen(false);
  };

  const remove = () => {
    if (!hover) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: hover.pos, to: hover.pos + hover.node.nodeSize })
      .run();
    setMenuOpen(false);
  };

  const stopDrag = (event: ReactMouseEvent) => event.stopPropagation();

  // Memoized so DragHandle's useEffect doesn't see new callback identities on
  // every render of BlockGutter. Without this, parent re-renders (every
  // keystroke flows through onChange → host setState → us) caused the
  // DragHandle plugin to unregister/re-register on each render, which made
  // ProseMirror destroy ALL plugin views — including the SlashCommand's
  // Suggestion view — and that fired the slash menu's onExit immediately
  // after onStart. Symptom: slash menu flashed and vanished.
  const handleNodeChange = useCallback(
    ({ node, pos }: { node: ProseMirrorNode | null; pos: number }) => {
      if (node) {
        setHover({ node, pos });
      } else {
        setHover(null);
        setMenuOpen(false);
      }
    },
    [],
  );

  const handleDragStart = useCallback((event: DragEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) {
      event.preventDefault();
    }
  }, []);

  const showTurnInto = hover ? !NON_CONVERTIBLE.has(hover.node.type.name) : false;

  return (
    <DragHandle
      editor={editor}
      className="rdump-gutter"
      onNodeChange={handleNodeChange}
      onElementDragStart={handleDragStart}
    >
      <div className="rdump-gutter__inner">
        <button
          type="button"
          data-no-drag="true"
          className="rdump-gutter__btn"
          aria-label="Insert block below"
          title="Click to insert block below"
          onMouseDown={stopDrag}
          onClick={insertBelow}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          data-no-drag="true"
          className="rdump-gutter__btn rdump-gutter__btn--grip"
          aria-label="Drag to move, click for block menu"
          title="Drag to move • Click for menu"
          onMouseDown={stopDrag}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <GripVertical size={14} />
        </button>

        {menuOpen ? (
          <div ref={menuRef} className="rdump-gutter__menu" role="menu">
            {showTurnInto ? (
              <>
                <div className="rdump-gutter__menu-label">Turn into</div>
                <MenuItem
                  icon={Type}
                  label="Text"
                  onSelect={() => runOnHovered((c) => c.setParagraph())}
                />
                <MenuItem
                  icon={Heading1}
                  label="Heading 1"
                  onSelect={() => runOnHovered((c) => c.setHeading({ level: 1 }))}
                />
                <MenuItem
                  icon={Heading2}
                  label="Heading 2"
                  onSelect={() => runOnHovered((c) => c.setHeading({ level: 2 }))}
                />
                <MenuItem
                  icon={Heading3}
                  label="Heading 3"
                  onSelect={() => runOnHovered((c) => c.setHeading({ level: 3 }))}
                />
                <MenuItem
                  icon={Quote}
                  label="Quote"
                  onSelect={() => runOnHovered((c) => c.setParagraph().toggleBlockquote())}
                />
                <MenuItem
                  icon={List}
                  label="Bullet list"
                  onSelect={() => runOnHovered((c) => c.setParagraph().toggleBulletList())}
                />
                <MenuItem
                  icon={ListOrdered}
                  label="Numbered list"
                  onSelect={() => runOnHovered((c) => c.setParagraph().toggleOrderedList())}
                />
                <MenuItem
                  icon={CheckSquare}
                  label="Task list"
                  onSelect={() => runOnHovered((c) => c.setParagraph().toggleTaskList())}
                />
                <MenuItem
                  icon={Code}
                  label="Code block"
                  onSelect={() =>
                    runOnHovered((c) => c.setParagraph().toggleCodeBlock({ language: "plaintext" }))
                  }
                />
                <div className="rdump-gutter__menu-sep" />
              </>
            ) : null}
            <MenuItem icon={Copy} label="Duplicate" onSelect={duplicate} />
            <MenuItem icon={Trash2} label="Delete" variant="danger" onSelect={remove} />
          </div>
        ) : null}
      </div>
    </DragHandle>
  );
}

function MenuItem({
  icon: Icon,
  label,
  variant,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  variant?: "danger";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`rdump-gutter__menu-item${
        variant === "danger" ? " rdump-gutter__menu-item--danger" : ""
      }`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}