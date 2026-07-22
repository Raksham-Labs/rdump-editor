"use client";

import {
  AtSign,
  Bold,
  Braces,
  ChartColumn,
  Code2,
  Columns3,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Rows3,
  Sigma,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  ChevronRight,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Workflow,
} from "lucide-react";
import { useEditorState, type Editor } from "@tiptap/react";
import { activeBlockAlignment } from "./alignment";
import type { HeadingLevel, ResolvedEditorConfig } from "../config";
import { EDIT_MATH_EVENT } from "../core/events";
import { AlignMenu } from "./AlignMenu";
import { HighlightMenu } from "./HighlightMenu";
import { ToolbarButton, type IconComponent } from "./ToolbarButton";
import { ToolbarMenu } from "./ToolbarMenu";
import "./Toolbar.css";

const CODE_LANGUAGES = [
  { value: "plaintext", label: "Plain" },
  { value: "typescript", label: "TS" },
  { value: "javascript", label: "JS" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "bash", label: "Bash" },
  { value: "sql", label: "SQL" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "MD" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
];

export function EditorToolbar({
  editor,
  config,
  disabled,
  onRequestLink,
  onRequestImage,
}: {
  editor: Editor;
  config: ResolvedEditorConfig;
  disabled: boolean;
  onRequestLink: () => void;
  onRequestImage: () => void;
}) {
  // Buttons for flag-gated features must disappear with their feature: the
  // extension (and its commands) isn't loaded, so clicking would throw on a
  // missing chain command — and a control that does nothing is chrome debt.
  const { features } = config;
  const headingLevels = config.behavior.headingLevels;
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      paragraph: editor.isActive("paragraph"),
      heading1: editor.isActive("heading", { level: 1 }),
      heading2: editor.isActive("heading", { level: 2 }),
      heading3: editor.isActive("heading", { level: 3 }),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      highlight: editor.isActive("highlight"),
      code: editor.isActive("code"),
      superscript: editor.isActive("superscript"),
      subscript: editor.isActive("subscript"),
      align: activeBlockAlignment(editor),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      taskList: editor.isActive("taskList"),
      blockquote: editor.isActive("blockquote"),
      callout: editor.isActive("callout"),
      details: editor.isActive("details"),
      codeBlock: editor.isActive("codeBlock"),
      table: editor.isActive("table"),
      link: editor.isActive("link"),
      language: (editor.getAttributes("codeBlock").language as string | undefined) ?? "plaintext",
    }),
  });

  return (
    <div className="rdump-toolbar" role="toolbar" aria-label="Editor toolbar">
      <BlockTypeMenu
        editor={editor}
        disabled={disabled}
        headingLevels={headingLevels}
        active={{
          heading1: state.heading1,
          heading2: state.heading2,
          heading3: state.heading3,
        }}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={Bold}
        label="Bold"
        description="Strong emphasis · ⌘B"
        disabled={disabled}
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label="Italic"
        description="Light emphasis · ⌘I"
        disabled={disabled}
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={UnderlineIcon}
        label="Underline"
        description="Underlined text · ⌘U"
        disabled={disabled}
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Strikethrough"
        description="Cross out text"
        disabled={disabled}
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <HighlightMenu
        editor={editor}
        active={state.highlight}
        disabled={disabled}
        description="Mark text with a background color"
      />
      <ToolbarButton
        icon={Code2}
        label="Inline code"
        description="Monospace snippet inside text"
        disabled={disabled}
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolbarButton
        icon={SuperscriptIcon}
        label="Superscript"
        description="Raised small text · ⌘."
        disabled={disabled}
        active={state.superscript}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      />
      <ToolbarButton
        icon={SubscriptIcon}
        label="Subscript"
        description="Lowered small text · ⌘,"
        disabled={disabled}
        active={state.subscript}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      />
      <ToolbarDivider />
      <AlignMenu
        editor={editor}
        align={state.align}
        disabled={disabled}
        description="Align text or image"
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={List}
        label="Bullet list"
        description="Unordered items with dots"
        disabled={disabled}
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="Numbered list"
        description="Ordered items with numbers"
        disabled={disabled}
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      {features.taskLists ? (
        <ToolbarButton
          icon={ListChecks}
          label="Checklist"
          description="Checkable to-dos with progress"
          disabled={disabled}
          active={state.taskList}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />
      ) : null}
      <ToolbarButton
        icon={Quote}
        label="Quote"
        description="Indented blockquote"
        disabled={disabled}
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      {features.callouts ? (
        <ToolbarButton
          icon={Info}
          label="Callout"
          description="Highlighted info / warning panel"
          disabled={disabled}
          active={state.callout}
          onClick={() => editor.chain().focus().toggleCallout({ variant: "info" }).run()}
        />
      ) : null}
      {features.collapsible ? (
        <ToolbarButton
          icon={ChevronRight}
          label="Toggle"
          description="Collapsible expand / collapse block"
          disabled={disabled}
          active={state.details}
          onClick={() => editor.chain().focus().setDetails().run()}
        />
      ) : null}
      {features.codeBlocks ? (
        <ToolbarButton
          icon={Braces}
          label="Code block"
          description="Fenced code with syntax highlight"
          disabled={disabled}
          active={state.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
      ) : null}
      {features.codeBlocks && state.codeBlock ? (
        <select
          value={state.language}
          disabled={disabled}
          onChange={(event) =>
            editor
              .chain()
              .focus()
              .updateAttributes("codeBlock", { language: event.target.value })
              .run()
          }
          className="rdump-toolbar__select"
          title="Code language"
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      ) : null}
      <ToolbarButton
        icon={Minus}
        label="Divider"
        description="Horizontal rule between sections"
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <ToolbarDivider />
      {features.tables ? (
        <ToolbarButton
          icon={TableIcon}
          label="Table"
          description="Insert a 3 × 3 grid"
          disabled={disabled}
          active={state.table}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        />
      ) : null}
      {features.tables && state.table ? (
        <>
          <ToolbarButton
            icon={Rows3}
            label="Add row"
            description="Insert a row below the current one"
            disabled={disabled}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          />
          <ToolbarButton
            icon={Columns3}
            label="Add column"
            description="Insert a column to the right"
            disabled={disabled}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          />
          <ToolbarButton
            icon={Trash2}
            label="Delete table"
            description="Remove the whole table"
            disabled={disabled}
            onClick={() => editor.chain().focus().deleteTable().run()}
          />
        </>
      ) : null}
      <ToolbarDivider />
      <ToolbarButton
        icon={Link2}
        label="Link"
        description="Attach a URL · ⌘K"
        disabled={disabled}
        active={state.link}
        onClick={onRequestLink}
      />
      {features.images ? (
        <ToolbarButton
          icon={ImageIcon}
          label="Image"
          description="Upload or paste an image URL"
          disabled={disabled}
          onClick={onRequestImage}
        />
      ) : null}
      {features.math ? (
        <ToolbarButton
          icon={Sigma}
          label="Math block"
          description="LaTeX equation (KaTeX)"
          disabled={disabled}
          onClick={() => {
            const latex = "f(x) = ax^2 + bx + c";
            const insertPos = editor.state.selection.from;
            editor.chain().focus().insertBlockMath({ latex, pos: insertPos }).run();
            // Open the math editor for the freshly inserted node. Scan a few
            // positions around the insert point in case paragraph splitting
            // shifted the node's actual position.
            const { doc } = editor.state;
            let foundPos: number | null = null;
            doc.nodesBetween(
              Math.max(0, insertPos - 4),
              Math.min(doc.content.size, insertPos + 4),
              (node, pos) => {
                if (foundPos !== null) return false;
                if (node.type.name === "blockMath") {
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
                  detail: { type: "block", pos, latex },
                }),
              );
            });
            }}
        />
      ) : null}
      {features.mermaid ? (
        <ToolbarButton
          icon={Workflow}
          label="Mermaid"
          description="Diagram from text (flowchart, sequence…)"
          disabled={disabled}
          onClick={() => editor.chain().focus().insertMermaid().run()}
        />
      ) : null}
      {features.charts ? (
        <ToolbarButton
          icon={ChartColumn}
          label="Chart"
          description="Data-driven bar / line chart"
          disabled={disabled}
          onClick={() => editor.chain().focus().insertChart().run()}
        />
      ) : null}
      {features.mentions ? (
        <ToolbarButton
          icon={AtSign}
          label="Mention"
          description="@ another user"
          disabled={disabled}
          onClick={() => editor.chain().focus().insertContent("@").run()}
        />
      ) : null}
      {features.hashtags ? (
        <ToolbarButton
          icon={Hash}
          label="Hashtag"
          description="Tag with a # keyword"
          disabled={disabled}
          onClick={() => editor.chain().focus().insertContent(" #").run()}
        />
      ) : null}
    </div>
  );
}

const HEADING_ITEMS = [
  { level: 1, icon: Heading1, label: "Heading 1", description: "Top-level section title" },
  { level: 2, icon: Heading2, label: "Heading 2", description: "Major subsection" },
  { level: 3, icon: Heading3, label: "Heading 3", description: "Minor subsection" },
] as const;

// Paragraph + configured heading levels behind one trigger showing the
// current block's icon — four separate buttons crowded the toolbar.
function BlockTypeMenu({
  editor,
  disabled,
  headingLevels,
  active,
}: {
  editor: Editor;
  disabled: boolean;
  headingLevels: HeadingLevel[];
  active: { heading1: boolean; heading2: boolean; heading3: boolean };
}) {
  const levels = HEADING_ITEMS.filter((h) => headingLevels.includes(h.level));
  const current = levels.find((h) => active[`heading${h.level}`]);

  // No heading levels configured — a one-item menu is worse than the plain
  // paragraph button.
  if (levels.length === 0) {
    return (
      <ToolbarButton
        icon={Type}
        label="Paragraph"
        description="Plain body text"
        disabled={disabled}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
    );
  }

  return (
    <ToolbarMenu
      icon={current?.icon ?? Type}
      label="Text style"
      description="Paragraph or heading level"
      active={Boolean(current)}
      disabled={disabled}
      layout="list"
    >
      {(close) => (
        <>
          <MenuItem
            icon={Type}
            label="Paragraph"
            active={!current}
            onClick={() => {
              editor.chain().focus().setParagraph().run();
              close();
            }}
          />
          {levels.map((h) => (
            <MenuItem
              key={h.level}
              icon={h.icon}
              label={h.label}
              active={active[`heading${h.level}`]}
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: h.level }).run();
                close();
              }}
            />
          ))}
        </>
      )}
    </ToolbarMenu>
  );
}

function MenuItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`rdump-toolbar-menu__item${
        active ? " rdump-toolbar-menu__item--active" : ""
      }`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

function ToolbarDivider() {
  return <span className="rdump-toolbar__divider" />;
}

