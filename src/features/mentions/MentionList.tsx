"use client";

import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { FileText } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ForwardedRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { getRuntime, type MentionUser } from "../../runtime";
import { filterPagesByQuery, insertPageLink } from "../pageLinks/PageLink";
import {
  createSuggestionRender,
  type SuggestionListProps,
  type SuggestionListRef,
} from "../../ui/suggestionPopup";
import "../../ui/SlashCommand.css";
import "./MentionList.css";

// The `@` picker resolves two kinds of targets:
//   - People — supplied by the host's loadMentionUsers handler (fetched once,
//     filtered locally per keystroke). Picking one inserts a Mention node.
//   - Pages — the workspace page list. Picking one inserts the same
//     pageLink node as the `[[` flow, so it navigates and counts as a
//     backlink exactly like a wikilink.

export interface MentionEntry {
  id: string;
  label: string;
  kind: "user" | "page";
  // Email for people — disambiguates same-name teammates in the list.
  sublabel?: string;
}

const USERS_PER_QUERY = 5;
const PAGES_PER_QUERY = 5;

// One fetch per host loader (i.e. per session); a failure clears the cache so
// the next `@` retries instead of pinning an empty people section. Keyed by
// the loader function so distinct editors sharing a host loader share the
// cache, while a host swapping loaders naturally gets a fresh fetch.
const usersCache = new WeakMap<() => Promise<MentionUser[]>, Promise<MentionEntry[]>>();

// Resolve a mention's person (name + email) by id from the cached people
// list. Backs the hover card on rendered @mentions — the mention node only
// stores id + label, so the email is looked up here. Returns null when the id
// isn't in the list (e.g. the person has since left).
export async function lookupMentionUser(
  editor: Editor,
  id: string,
): Promise<{ name: string; email: string } | null> {
  const users = await loadOrgUsers(editor);
  const match = users.find((user) => user.id === id && user.kind === "user");
  if (!match) return null;
  return { name: match.label, email: match.sublabel ?? "" };
}

function loadOrgUsers(editor: Editor): Promise<MentionEntry[]> {
  const loader = getRuntime(editor).loadMentionUsers;
  if (!loader) return Promise.resolve([]);
  let cached = usersCache.get(loader);
  if (!cached) {
    cached = loader()
      .then((users) =>
        users.map<MentionEntry>((user) => ({
          id: user.id,
          label: user.name || user.email,
          kind: "user",
          sublabel: user.email,
        })),
      )
      .catch((error) => {
        console.warn("[rdump-editor] mention users fetch failed", error);
        usersCache.delete(loader);
        return [];
      });
    usersCache.set(loader, cached);
  }
  return cached;
}

const MentionList = forwardRef(function MentionList(
  { items, command }: SuggestionListProps<MentionEntry>,
  ref: ForwardedRef<SuggestionListRef>,
) {
  const [index, setIndex] = useState(0);
  // Reset the highlight when a new result set arrives — render-time state
  // adjustment, same pattern as PageLinkList.
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
    return <div className="rdump-slash rdump-slash--empty">No people or pages found.</div>;
  }

  // Items arrive people-first then pages; inject a header when the kind
  // flips, same trick as SlashList's group headers.
  let lastKind: MentionEntry["kind"] | null = null;

  return (
    <div className="rdump-slash rdump-slash--mention" role="listbox">
      {items.map((item, i) => {
        const showHeader = item.kind !== lastKind;
        lastKind = item.kind;
        return (
          <div key={`${item.kind}:${item.id}`}>
            {showHeader ? (
              <div className="rdump-slash__group">
                {item.kind === "user" ? "People" : "Pages"}
              </div>
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
              {item.kind === "user" ? (
                <span className="rdump-slash__avatar">{item.label[0]?.toUpperCase()}</span>
              ) : (
                <span className="rdump-slash__icon">
                  <FileText size={15} />
                </span>
              )}
              <span className="rdump-slash__text">
                <span className="rdump-slash__title">{item.label}</span>
                {item.sublabel ? (
                  <span className="rdump-slash__desc">{item.sublabel}</span>
                ) : null}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});

// Explicit key: the Mention extension generates an anonymous PluginKey per
// suggestion, which the outside-click dismiss (createSuggestionRender's
// exitSuggestion call) couldn't reference.
const mentionSuggestionKey = new PluginKey("mentionSuggestion");

export const mentionSuggestion: Omit<SuggestionOptions<MentionEntry>, "editor"> = {
  char: "@",
  pluginKey: mentionSuggestionKey,
  allowSpaces: false,
  items: async ({ query, editor }) => {
    const normalized = query.toLowerCase().trim();
    const users = await loadOrgUsers(editor);
    const matchedUsers = (
      normalized
        ? users.filter(
            (user) =>
              user.label.toLowerCase().includes(normalized) ||
              user.sublabel?.toLowerCase().includes(normalized),
          )
        : users
    ).slice(0, USERS_PER_QUERY);
    const matchedPages = filterPagesByQuery(query, PAGES_PER_QUERY).map<MentionEntry>(
      (page) => ({ id: page.id, label: page.title, kind: "page" }),
    );
    return [...matchedUsers, ...matchedPages];
  },
  // Override the Mention extension's default insert so page picks become
  // pageLink nodes; people keep the standard mention chip.
  command: ({ editor, range, props }) => {
    if (props.kind === "page") {
      insertPageLink(editor, range, { id: props.id, title: props.label });
      return;
    }
    const nodeAfter = editor.view.state.selection.$to.nodeAfter;
    if (nodeAfter?.text?.startsWith(" ")) range.to += 1;
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: "mention", attrs: { id: props.id, label: props.label } },
        { type: "text", text: " " },
      ])
      .run();
    editor.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd();
  },
  render: createSuggestionRender(MentionList, mentionSuggestionKey),
};
