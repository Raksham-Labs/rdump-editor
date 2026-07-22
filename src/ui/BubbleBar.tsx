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
  Info,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Type,
  Underline as UnderlineIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { activeBlockAlignment, applyBlockAlignment } from "./alignment";
import type { ResolvedEditorConfig } from "../config";
import { ALIGNMENTS, AlignMenu } from "./AlignMenu";
import { HighlightMenu } from "./HighlightMenu";
import { ToolbarButton } from "./ToolbarButton";
import "./BubbleBar.css";

interface BubbleBarProps {
  editor: Editor;
  config: ResolvedEditorConfig;
  onRequestLink: () => void;
}

type ChainFn = (chain: ChainedCommands) => ChainedCommands;

interface TurnIntoItem {
  label: string;
  icon: LucideIcon;
  match: (editor: Editor) => boolean;
  run: ChainFn;
  // Absent means always available (StarterKit block). Items whose feature is
  // flagged off must not render: the extension isn't loaded, so running the
  // command would throw on the missing chain method.
  available?: (config: ResolvedEditorConfig) => boolean;
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
    available: (cfg) => cfg.behavior.headingLevels.includes(1),
  },
  {
    label: "Heading 2",
    icon: Heading2,
    match: (e) => e.isActive("heading", { level: 2 }),
    run: (c) => c.setHeading({ level: 2 }),
    available: (cfg) => cfg.behavior.headingLevels.includes(2),
  },
  {
    label: "Heading 3",
    icon: Heading3,
    match: (e) => e.isActive("heading", { level: 3 }),
    run: (c) => c.setHeading({ level: 3 }),
    available: (cfg) => cfg.behavior.headingLevels.includes(3),
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
    available: (cfg) => cfg.features.taskLists,
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
    available: (cfg) => cfg.features.callouts,
  },
  {
    label: "Code block",
    icon: Code,
    match: (e) => e.isActive("codeBlock"),
    run: (c) => c.setParagraph().toggleCodeBlock({ language: "plaintext" }),
    // The plain codeBlock node exists even with the flag off (markdown
    // round-trip needs it), but the language header / highlighting UI is
    // part of the gated module — don't offer creating bare boxes.
    available: (cfg) => cfg.features.codeBlocks,
  },
];

export function BubbleBar({ editor, config, onRequestLink }: BubbleBarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      superscript: editor.isActive("superscript"),
      subscript: editor.isActive("subscript"),
      highlight: editor.isActive("highlight"),
      link: editor.isActive("link"),
      image: editor.isActive("image"),
      align: activeBlockAlignment(editor),
    }),
  });

  // A node-selected image gets a reduced bar: only alignment applies (the
  // default bubble shouldShow fires for node selections too, so without this
  // the image would surface text-mark buttons that do nothing).
  if (state?.image) {
    return (
      <>
        {ALIGNMENTS.filter((a) => a.value !== "justify").map((a) => (
          <ToolbarButton
            key={a.value}
            icon={a.icon}
            label={a.label}
            active={state.align === a.value}
            onClick={() => applyBlockAlignment(editor, a.value)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <TurnIntoMenu editor={editor} config={config} />
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
      <ToolbarButton
        icon={SuperscriptIcon}
        label="Superscript"
        active={state?.superscript}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      />
      <ToolbarButton
        icon={SubscriptIcon}
        label="Subscript"
        active={state?.subscript}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      />
      <span className="rdump-bubble__divider" />
      <AlignMenu editor={editor} align={state?.align ?? "left"} />
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

function TurnIntoMenu({ editor, config }: { editor: Editor; config: ResolvedEditorConfig }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const items = TURN_INTO.filter((item) => item.available?.(config) ?? true);
  const current = items.find((item) => item.match(editor)) ?? items[0]; // default Text

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
          {items.map((item) => {
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
