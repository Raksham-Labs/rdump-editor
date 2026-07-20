"use client";

import { useEditorState, type ChainedCommands, type Editor } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Info,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ToolbarButton } from "./Toolbar";
import "./BubbleBar.css";

interface BubbleBarProps {
  editor: Editor;
  onRequestLink: () => void;
}

type ChainFn = (chain: ChainedCommands) => ChainedCommands;

interface TurnIntoItem {
  label: string;
  icon: LucideIcon;
  match: (editor: Editor) => boolean;
  run: ChainFn;
}

// Order mirrors the slash menu so users build muscle memory across surfaces.
const TURN_INTO: TurnIntoItem[] = [
  {
    label: "Text",
    icon: Type,
    match: (e) => e.isActive("paragraph") && !e.isActive("bulletList") && !e.isActive("orderedList") && !e.isActive("taskList") && !e.isActive("blockquote") && !e.isActive("callout"),
    run: (c) => c.setParagraph(),
  },
  {
    label: "Heading 1",
    icon: Heading1,
    match: (e) => e.isActive("heading", { level: 1 }),
    run: (c) => c.setHeading({ level: 1 }),
  },
  {
    label: "Heading 2",
    icon: Heading2,
    match: (e) => e.isActive("heading", { level: 2 }),
    run: (c) => c.setHeading({ level: 2 }),
  },
  {
    label: "Heading 3",
    icon: Heading3,
    match: (e) => e.isActive("heading", { level: 3 }),
    run: (c) => c.setHeading({ level: 3 }),
  },
  {
    label: "Bullet list",
    icon: List,
    match: (e) => e.isActive("bulletList"),
    run: (c) => c.setParagraph().toggleBulletList(),
  },
  {
    label: "Numbered list",
    icon: ListOrdered,
    match: (e) => e.isActive("orderedList"),
    run: (c) => c.setParagraph().toggleOrderedList(),
  },
  {
    label: "Task list",
    icon: ListChecks,
    match: (e) => e.isActive("taskList"),
    run: (c) => c.setParagraph().toggleTaskList(),
  },
  {
    label: "Quote",
    icon: Quote,
    match: (e) => e.isActive("blockquote"),
    run: (c) => c.setParagraph().toggleBlockquote(),
  },
  {
    label: "Callout",
    icon: Info,
    match: (e) => e.isActive("callout"),
    run: (c) => c.setParagraph().toggleCallout({ variant: "info" }),
  },
  {
    label: "Code block",
    icon: Code,
    match: (e) => e.isActive("codeBlock"),
    run: (c) => c.setParagraph().toggleCodeBlock({ language: "plaintext" }),
  },
];

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fff3bf" },
  { name: "Green", value: "#d3f9d8" },
  { name: "Blue", value: "#d0ebff" },
  { name: "Pink", value: "#ffdeeb" },
  { name: "Orange", value: "#ffe8cc" },
  { name: "Red", value: "#ffc9c9" },
];

export function BubbleBar({ editor, onRequestLink }: BubbleBarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      highlight: editor.isActive("highlight"),
      link: editor.isActive("link"),
    }),
  });

  return (
    <>
      <TurnIntoMenu editor={editor} />
      <span className="rdump-bubble__divider" />
      <ToolbarButton
        icon={Bold}
        label="Bold"
        active={state?.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label="Italic"
        active={state?.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={UnderlineIcon}
        label="Underline"
        active={state?.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Strikethrough"
        active={state?.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        icon={Code2}
        label="Inline code"
        active={state?.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <span className="rdump-bubble__divider" />
      <HighlightMenu editor={editor} active={state?.highlight ?? false} />
      <ToolbarButton
        icon={Link2}
        label="Link"
        active={state?.link}
        onClick={onRequestLink}
      />
    </>
  );
}

function TurnIntoMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const current =
    TURN_INTO.find((item) => item.match(editor)) ?? TURN_INTO[0]; // default Text

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const CurrentIcon = current.icon;

  return (
    <div ref={wrapRef} className="rdump-bubble__menu-wrap">
      <button
        type="button"
        className="rdump-bubble__turn-into"
        onClick={() => setOpen((o) => !o)}
        title="Turn block into"
      >
        <CurrentIcon size={13} />
        <span>{current.label}</span>
        <ChevronDown size={11} />
      </button>
      {open ? (
        <div className="rdump-bubble__dropdown" role="menu">
          {TURN_INTO.map((item) => {
            const Icon = item.icon;
            const isActive = item === current;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`rdump-bubble__dropdown-item${
                  isActive ? " rdump-bubble__dropdown-item--active" : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  item.run(editor.chain().focus()).run();
                  setOpen(false);
                }}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function HighlightMenu({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="rdump-bubble__menu-wrap">
      <ToolbarButton
        icon={Highlighter}
        label="Highlight"
        active={active}
        onClick={() => setOpen((o) => !o)}
      />
      {open ? (
        <div className="rdump-bubble__dropdown rdump-bubble__swatches" role="menu">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className="rdump-bubble__swatch"
              title={color.name}
              aria-label={color.name}
              style={{ background: color.value }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: color.value }).run();
                setOpen(false);
              }}
            />
          ))}
          <button
            type="button"
            className="rdump-bubble__swatch-clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setOpen(false);
            }}
          >
            None
          </button>
        </div>
      ) : null}
    </div>
  );
}
