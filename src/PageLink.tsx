"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Suggestion, type SuggestionOptions } from "@tiptap/suggestion";
import { FileText } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useState,
  useSyncExternalStore,
  type ForwardedRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  createSuggestionRender,
  type SuggestionListProps,
  type SuggestionListRef,
} from "./suggestionPopup";
import { getRuntime } from "./runtime";
import {
  getWorkspacePages,
  getWorkspacePageTitle,
  hasWorkspacePages,
  subscribeWorkspacePages,
} from "./workspacePages";
import "./SlashCommand.css";
import "./PageLink.css";

// Inline link to another page in the workspace, inserted by typing `[[` (or
// picking a page from the `@` mention menu). Round-trips through markdown as
// inline HTML via the Markdown extension's html:true — the same path Mention
// uses — so no dedicated serializer is needed:
//   <span data-type="page-link" data-doc-id="…" data-label="…">Title</span>
// Hosts that maintain a backlink index can parse these spans back out of the
// saved markdown.

export interface PageLinkItem {
  id: string;
  title: string;
}

// data-label is the title snapshot from insertion time. The node view prefers
// the live title from the workspace registry so renames show through
// everywhere immediately; the snapshot is the fallback for docs that have
// since been deleted (and for read paths without the registry, e.g. external
// markdown viewers, which see it as the span's text content).
function PageLinkView({ node, editor }: NodeViewProps) {
  const docId = (node.attrs.docId as string | null) ?? null;
  const storedLabel = ((node.attrs.label as string) || "Untitled").trim() || "Untitled";
  const liveTitle = useSyncExternalStore(
    subscribeWorkspacePages,
    () => (docId ? getWorkspacePageTitle(docId) : undefined),
    () => undefined,
  );
  const missing = docId !== null && liveTitle === undefined && hasWorkspacePages();
  const title = liveTitle ?? storedLabel;

  return (
    <NodeViewWrapper
      as="span"
      className="rdump-pagelink"
      data-missing={missing ? "true" : undefined}
    >
      <button
        type="button"
        className="rdump-pagelink__btn"
        title={missing ? `"${title}" was deleted or is unavailable` : `Open "${title}"`}
        // preventDefault keeps the editor selection where it is; navigation
        // happens on click without collapsing into the atom first.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (docId) getRuntime(editor).onOpenPage?.(docId);
        }}
      >
        <FileText size={13} aria-hidden className="rdump-pagelink__icon" />
        <span className="rdump-pagelink__label">{title}</span>
      </button>
    </NodeViewWrapper>
  );
}

const PageLinkList = forwardRef(function PageLinkList(
  { items, command }: SuggestionListProps<PageLinkItem>,
  ref: ForwardedRef<SuggestionListRef>,
) {
  const [index, setIndex] = useState(0);
  // Reset the highlight when a new result set arrives — done during render
  // (the sanctioned adjust-state-on-prop-change pattern) rather than in an
  // effect, so there's no flash of a stale highlight.
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setIndex(0);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === "ArrowUp") {
        setIndex((value) => (value + items.length - 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setIndex((value) => (value + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        const item = items[index];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return <div className="rdump-slash rdump-slash--empty">No matching page.</div>;
  }

  return (
    <div className="rdump-slash rdump-slash--pagelink" role="listbox">
      <div className="rdump-slash__group">Link to page</div>
      {items.map((item, i) => (
        <button
          key={item.id}
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
            <FileText size={15} />
          </span>
          <span className="rdump-slash__title">{item.title}</span>
        </button>
      ))}
    </div>
  );
});

export function filterPagesByQuery(query: string, limit: number): PageLinkItem[] {
  const normalized = query.toLowerCase().trim();
  const pages = getWorkspacePages();
  const matched = normalized
    ? pages.filter((page) => (page.title || "Untitled").toLowerCase().includes(normalized))
    : pages;
  return matched.slice(0, limit).map((page) => ({
    id: page.id,
    title: page.title || "Untitled",
  }));
}

// Insert helper shared with the mention picker (its "Pages" section inserts
// the same node). Mirrors the Mention extension's default command, including
// the swallow-the-following-space and collapse-selection details.
export function insertPageLink(
  editor: Parameters<NonNullable<SuggestionOptions<PageLinkItem>["command"]>>[0]["editor"],
  range: { from: number; to: number },
  item: PageLinkItem,
): void {
  const nodeAfter = editor.view.state.selection.$to.nodeAfter;
  if (nodeAfter?.text?.startsWith(" ")) range.to += 1;
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      { type: "pageLink", attrs: { docId: item.id, label: item.title } },
      { type: "text", text: " " },
    ])
    .run();
  editor.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd();
}

const pageLinkSuggestion: Omit<SuggestionOptions<PageLinkItem>, "editor"> = {
  char: "[[",
  pluginKey: new PluginKey("pageLinkSuggestion"),
  allowSpaces: true,
  items: ({ query }) => filterPagesByQuery(query, 8),
  command: ({ editor, range, props }) => insertPageLink(editor, range, props),
  allow: ({ state, range }) => {
    const $from = state.doc.resolve(range.from);
    const type = state.schema.nodes.pageLink;
    return !!$from.parent.type.contentMatch.matchType(type);
  },
  render: createSuggestionRender(PageLinkList),
};

export const PageLink = Node.create({
  name: "pageLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      docId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-doc-id"),
        renderHTML: (attributes) =>
          attributes.docId ? { "data-doc-id": attributes.docId } : {},
      },
      label: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-label") ?? element.textContent ?? "",
        renderHTML: (attributes) =>
          attributes.label ? { "data-label": attributes.label } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="page-link"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ "data-type": "page-link", class: "rdump-pagelink" }, HTMLAttributes),
      String(node.attrs.label ?? ""),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<PageLinkItem>({
        editor: this.editor,
        ...pageLinkSuggestion,
      }),
    ];
  },
});
