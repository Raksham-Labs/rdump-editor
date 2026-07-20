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
  Highlighter,
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
  Table as TableIcon,
  ChevronRight,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Workflow,
} from "lucide-react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { ComponentType } from "react";
import { EDIT_MATH_EVENT } from "./events";
import "./Toolbar.css";

type IconComponent = ComponentType<{ size?: number; className?: string }>;

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
  disabled,
  onRequestLink,
  onRequestImage,
}: {
  editor: Editor;
  disabled: boolean;
  onRequestLink: () => void;
  onRequestImage: () => void;
}) {
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
      <ToolbarButton
        icon={Type}
        label="Paragraph"
        description="Plain body text"
        disabled={disabled}
        active={state.paragraph}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
      <ToolbarButton
        icon={Heading1}
        label="Heading 1"
        description="Top-level section title"
        disabled={disabled}
        active={state.heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={Heading2}
        label="Heading 2"
        description="Major subsection"
        disabled={disabled}
        active={state.heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={Heading3}
        label="Heading 3"
        description="Minor subsection"
        disabled={disabled}
        active={state.heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
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
      <ToolbarButton
        icon={Highlighter}
        label="Highlight"
        description="Mark with yellow background"
        disabled={disabled}
        active={state.highlight}
        onClick={() => editor.chain().focus().toggleHighlight({ color: "#fff3bf" }).run()}
      />
      <ToolbarButton
        icon={Code2}
        label="Inline code"
        description="Monospace snippet inside text"
        disabled={disabled}
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
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
      <ToolbarButton
        icon={ListChecks}
        label="Checklist"
        description="Checkable to-dos with progress"
        disabled={disabled}
        active={state.taskList}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
      <ToolbarButton
        icon={Quote}
        label="Quote"
        description="Indented blockquote"
        disabled={disabled}
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={Info}
        label="Callout"
        description="Highlighted info / warning panel"
        disabled={disabled}
        active={state.callout}
        onClick={() => editor.chain().focus().toggleCallout({ variant: "info" }).run()}
      />
      <ToolbarButton
        icon={ChevronRight}
        label="Toggle"
        description="Collapsible expand / collapse block"
        disabled={disabled}
        active={state.details}
        onClick={() => editor.chain().focus().setDetails().run()}
      />
      <ToolbarButton
        icon={Braces}
        label="Code block"
        description="Fenced code with syntax highlight"
        disabled={disabled}
        active={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      {state.codeBlock ? (
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
      <ToolbarDivider />
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
      {state.table ? (
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
      <ToolbarButton
        icon={Minus}
        label="Divider"
        description="Horizontal rule between sections"
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={Link2}
        label="Link"
        description="Attach a URL · ⌘K"
        disabled={disabled}
        active={state.link}
        onClick={onRequestLink}
      />
      <ToolbarButton
        icon={ImageIcon}
        label="Image"
        description="Upload or paste an image URL"
        disabled={disabled}
        onClick={onRequestImage}
      />
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
      <ToolbarButton
        icon={Workflow}
        label="Mermaid"
        description="Diagram from text (flowchart, sequence…)"
        disabled={disabled}
        onClick={() => editor.chain().focus().insertMermaid().run()}
      />
      <ToolbarButton
        icon={ChartColumn}
        label="Chart"
        description="Data-driven bar / line chart"
        disabled={disabled}
        onClick={() => editor.chain().focus().insertChart().run()}
      />
      <ToolbarButton
        icon={AtSign}
        label="Mention"
        description="@ another user"
        disabled={disabled}
        onClick={() => editor.chain().focus().insertContent("@").run()}
      />
      <ToolbarButton
        icon={Hash}
        label="Hashtag"
        description="Tag with a # keyword"
        disabled={disabled}
        onClick={() => editor.chain().focus().insertContent(" #").run()}
      />
    </div>
  );
}

export function ToolbarButton({
  icon: Icon,
  label,
  description,
  active,
  disabled,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={description ? `${label} — ${description}` : label}
      disabled={disabled}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className="rdump-toolbar__btn"
    >
      <Icon size={15} />
      <span className="rdump-toolbar__tip" role="tooltip">
        <span className="rdump-toolbar__tip-title">{label}</span>
        {description ? (
          <span className="rdump-toolbar__tip-desc">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

function ToolbarDivider() {
  return <span className="rdump-toolbar__divider" />;
}

