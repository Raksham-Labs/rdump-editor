import { getHTMLFromFragment } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";

/**
 * The raw-HTML escape hatch for blocks markdown can't express (a table with
 * merged cells, an aligned paragraph). Reproduces tiptap-markdown's HTMLNode
 * serializer — including the `formatBlock` line breaks — byte for byte, so
 * docs that already take this path don't get rewritten (and flagged dirty)
 * the first time they're opened after this change.
 */
export function serializeBlockHTML(node: PMNode, parent: PMNode | Fragment): string {
  const schema = node.type.schema;
  const html = getHTMLFromFragment(Fragment.from(node), schema);
  const atTopLevel =
    parent instanceof Fragment || parent.type.name === schema.topNodeType.name;
  if (!node.isBlock || !atTopLevel) return html;
  const body = new window.DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
    .body;
  const element = body.firstElementChild;
  if (!element) return html;
  element.innerHTML = element.innerHTML.trim() ? `\n${element.innerHTML}\n` : "\n";
  return element.outerHTML;
}
