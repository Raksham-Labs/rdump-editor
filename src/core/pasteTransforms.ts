// Paste-time helpers.
//
// 1. rewriteTaskListHTML — runs in editorProps.transformPastedHTML when the
//    clipboard carries rich HTML (rendered checklist from GitHub, MD
//    preview, Notion, etc.). Those sources emit `<li>` with a nested
//    checkbox input; Tiptap's TaskItem parser only picks up
//    `data-type="taskItem"` + `data-checked="…"`, so we rewrite attributes
//    and drop the input.
// 2. containsMarkdownExtras — predicate used in handlePaste to decide
//    whether to force the plain-text → markdown-it path over the clipboard's
//    HTML view. Catches markdown features that survive in plain text but
//    get visually mangled in the HTML wrapper (task lists, tables, etc.).
//    Full markdown conversion is delegated to tiptap-markdown's parser.

// Match GFM task syntax — accepts `[ ]`, `[]`, `[x]`, `[X]` for the box.
const TASK_LINE = /^([ \t]*)([-*+])\s+\[([ xX]?)]\s+(.*)$/;

function looksLikeTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= 3 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

// Delimiter row like `|---|---|` or `| :--- | ---: | :---: |`. Also
// accepts en-dash (U+2013) and em-dash (U+2014) in case the source (or our
// Typography extension) has converted hyphen runs.
function isTableDelimiter(line: string): boolean {
  if (!line.includes("|")) return false;
  if (!/[\-–—]/.test(line)) return false;
  return line.replace(/[\s|:\-–—]/g, "") === "";
}

export function containsMarkdownExtras(text: string): boolean {
  if (!text) return false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (TASK_LINE.test(lines[i])) return true;
    if (
      looksLikeTableRow(lines[i]) &&
      i + 1 < lines.length &&
      isTableDelimiter(lines[i + 1])
    ) {
      return true;
    }
  }
  return false;
}

export function rewriteTaskListHTML(html: string): string {
  if (!html) return html;
  if (!/<input[^>]*type=["']?checkbox/i.test(html)) return html;
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("li").forEach((li) => {
    const checkbox = li.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    if (!checkbox) return;
    const list = li.closest("ul, ol");
    if (list) list.setAttribute("data-type", "taskList");
    li.setAttribute("data-type", "taskItem");
    li.setAttribute(
      "data-checked",
      checkbox.checked || checkbox.hasAttribute("checked") ? "true" : "false",
    );
    li.classList.remove("task-list-item");
    list?.classList.remove("contains-task-list");
    checkbox.remove();
  });
  return doc.body.innerHTML;
}
