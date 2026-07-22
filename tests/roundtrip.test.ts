// Golden round-trip tests over the fixture corpus.
//
// Invariant under test: serialization is IDEMPOTENT — serialize(parse(md))
// applied twice yields the same bytes as applied once. If this drifts, hosts
// that hash canonical markdown see phantom dirty state on every open.
//
// A fixture whose first serialization differs from the fixture text itself is
// reported (not failed): it means the fixture wasn't hand-written in exactly
// canonical form. The assertion that matters is pass1 === pass2.
//
// Runs headless (happy-dom). Node views are React components and never mount
// here — parse/serialize only exercises the schema and markdown storage.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config";
import { loadExtensions } from "../src/core/extensions";
import {
  getEditorMarkdown,
  parseStoredContent,
  serializeDoc,
  type ContentFormat,
} from "../src/core/markdown";
import { createDefaultRuntime } from "../src/runtime";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../playground/fixtures");
const fixtures = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".md"))
  .sort()
  .map((name) => ({ name, content: readFileSync(join(fixturesDir, name), "utf8") }));

async function serializeOnce(
  input: string,
  config: Parameters<typeof resolveConfig>[0] = undefined,
): Promise<string> {
  const extensions = await loadExtensions(resolveConfig(config), createDefaultRuntime());
  const editor = new Editor({
    element: document.createElement("div"),
    extensions,
    content: parseStoredContent(input),
  });
  try {
    return getEditorMarkdown(editor);
  } finally {
    editor.destroy();
  }
}

describe("content formats", () => {
  const MD = "# Title\n\nSome **bold** text.";

  async function serializeAs(input: string, format: ContentFormat): Promise<string> {
    const extensions = await loadExtensions(resolveConfig(), createDefaultRuntime());
    const editor = new Editor({
      element: document.createElement("div"),
      extensions,
      content: parseStoredContent(input),
    });
    try {
      return serializeDoc(editor, format);
    } finally {
      editor.destroy();
    }
  }

  it("emits render-ready HTML", async () => {
    const html = await serializeAs(MD, "html");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("emits lossless stringified Tiptap JSON that round-trips", async () => {
    const json = await serializeAs(MD, "json");
    const doc = JSON.parse(json) as { type: string };
    expect(doc.type).toBe("doc");
    // Feeding the JSON back in re-serializes to the identical string, and
    // converts back to the original markdown — same doc, three spellings.
    expect(await serializeAs(json, "json")).toBe(json);
    expect(await serializeAs(json, "markdown")).toBe(MD);
  });

  it("accepts HTML input regardless of output format", async () => {
    const html = await serializeAs(MD, "html");
    expect(await serializeAs(html, "markdown")).toBe(MD);
  });
});

describe("inline code exit", () => {
  it("ArrowRight at the end of a block clears the code mark for further typing", async () => {
    const extensions = await loadExtensions(resolveConfig(), createDefaultRuntime());
    const editor = new Editor({
      element: document.createElement("div"),
      extensions,
      content: "<p>run <code>pnpm i</code></p>",
    });
    try {
      // Caret at the very end of the paragraph — inside the code mark's
      // trailing edge, where typing would otherwise keep extending it.
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      expect(editor.isActive("code")).toBe(true);

      // Real keydown path. (commands.keyboardShortcut can't be used here:
      // it wraps handlers in captureTransaction, which replays doc steps
      // only — a stored-mark change has none and gets swallowed.)
      const handled = editor.view.someProp("handleKeyDown", (f) =>
        f(editor.view, new KeyboardEvent("keydown", { key: "ArrowRight" })),
      );
      expect(handled).toBe(true);
      expect(editor.isActive("code")).toBe(false);

      editor.commands.insertContent("x");
      expect(editor.getHTML()).toContain("<code>pnpm i</code>x");
    } finally {
      editor.destroy();
    }
  });

  it("leaves the mark alone mid-block", async () => {
    const extensions = await loadExtensions(resolveConfig(), createDefaultRuntime());
    const editor = new Editor({
      element: document.createElement("div"),
      extensions,
      content: "<p><code>ab</code> tail</p>",
    });
    try {
      // Caret inside the code span with more text following: the escape must
      // not fire (other extensions may still consume the key — Details binds
      // ArrowRight too — so assert on mark state, not event handling).
      editor.commands.setTextSelection(2);
      expect(editor.isActive("code")).toBe(true);
      editor.view.someProp("handleKeyDown", (f) =>
        f(editor.view, new KeyboardEvent("keydown", { key: "ArrowRight" })),
      );
      expect(editor.state.storedMarks).toBeNull();
      expect(editor.isActive("code")).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});

describe("feature gating", () => {
  const FENCES = "# Doc\n\n```mermaid\ngraph TD\n  A --> B\n```\n";

  it("keeps mermaid fences as plain code blocks when the feature is off", async () => {
    const off = { features: { mermaid: false, charts: false } };
    const pass1 = await serializeOnce(FENCES, off);
    expect(pass1).toContain("```mermaid");
    expect(await serializeOnce(pass1, off)).toBe(pass1);
  });

  it("round-trips fenced code with codeBlocks off (PlainCodeBlock fallback)", async () => {
    const off = { features: { codeBlocks: false } };
    const md = "```js\nconsole.log(1)\n```";
    const pass1 = await serializeOnce(md, off);
    expect(pass1).toContain("```js");
    expect(await serializeOnce(pass1, off)).toBe(pass1);
  });

  it("builds a working editor with every feature off", async () => {
    const allOff = {
      features: {
        images: false,
        tables: false,
        taskLists: false,
        codeBlocks: false,
        math: false,
        mermaid: false,
        charts: false,
        callouts: false,
        collapsible: false,
        hashtags: false,
        mentions: false,
        pageLinks: false,
      },
    };
    // Note: the serializer emits no trailing newline.
    const md = "# Hi\n\nJust **text** and\n\n- a list";
    expect(await serializeOnce(md, allOff)).toBe(md);
  });

  it("survives mermaid-off / charts-on (FencedBlockSwap schema guard)", async () => {
    const partial = { features: { mermaid: false } };
    const pass1 = await serializeOnce(FENCES, partial);
    expect(pass1).toContain("```mermaid");
  });
});

describe("hashtag typing", () => {
  it("keeps every character and marks the whole tag as it is typed", async () => {
    const extensions = await loadExtensions(resolveConfig(), createDefaultRuntime());
    const editor = new Editor({
      element: document.createElement("div"),
      extensions,
      content: "<p>tag</p>",
    });
    try {
      editor.commands.setTextSelection(4); // caret after "tag"
      // Real typing path: handleTextInput per character (input rules fire
      // here; unhandled characters insert as the browser would). The space
      // is typed too so the rule's \s-prefix branch is exercised.
      for (const ch of " #super") {
        const view = editor.view;
        const { from, to } = view.state.selection;
        const handled = view.someProp("handleTextInput", (f) =>
          f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)),
        );
        if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
      }
      expect(editor.getText()).toBe("tag #super");
      let marked = "";
      editor.state.doc.descendants((node) => {
        if (node.isText && node.marks.some((m) => m.type.name === "hashtag")) {
          marked += node.text;
        }
      });
      expect(marked).toBe("#super");
      // Caret ends up after the tag, ready for the next character.
      expect(editor.state.selection.from).toBe(11);
    } finally {
      editor.destroy();
    }
  });
});

describe("alignment and scripts", () => {
  it("aligned paragraph and heading round-trip through the HTML spelling", async () => {
    const p = await serializeOnce('<p style="text-align: center">Centered <strong>bold</strong></p>');
    expect(p).toBe('<p style="text-align: center;">\nCentered <strong>bold</strong>\n</p>');
    expect(await serializeOnce(p)).toBe(p);

    const h = await serializeOnce('<h2 style="text-align: right">Title</h2>');
    expect(h).toBe('<h2 style="text-align: right;">\nTitle\n</h2>');
    expect(await serializeOnce(h)).toBe(h);
  });

  it("explicit left alignment normalizes to the stock spelling", async () => {
    expect(await serializeOnce('<p style="text-align: left">Plain</p>')).toBe("Plain");
    expect(await serializeOnce('<h1 style="text-align: left">Hi</h1>')).toBe("# Hi");
  });

  it("subscript and superscript round-trip as inline HTML", async () => {
    const md = await serializeOnce("<p>H<sub>2</sub>O and x<sup>2</sup></p>");
    expect(md).toBe("H<sub>2</sub>O and x<sup>2</sup>");
    expect(await serializeOnce(md)).toBe(md);
  });

  it("image alignment forces the <img> spelling and round-trips", async () => {
    const md = await serializeOnce(
      '<img src="https://example.com/a.png" alt="pic" data-align="center">',
    );
    expect(md).toBe('<img src="https://example.com/a.png" alt="pic" data-align="center">');
    expect(await serializeOnce(md)).toBe(md);
  });

  it("a table with an aligned cell takes the HTML path and round-trips", async () => {
    const md = await serializeOnce(
      '<table><tr><th><p>Head</p></th></tr><tr><td><p style="text-align: center">Mid</p></td></tr></table>',
    );
    // GFM pipes can't hold the alignment — the whole table must serialize
    // as HTML with the style intact.
    expect(md).toContain("<table");
    expect(md).toContain("text-align: center");
    expect(await serializeOnce(md)).toBe(md);
  });

  it("subscript and superscript exclude each other", async () => {
    const extensions = await loadExtensions(resolveConfig(), createDefaultRuntime());
    const editor = new Editor({
      element: document.createElement("div"),
      extensions,
      content: "<p>x</p>",
    });
    try {
      editor.commands.selectAll();
      editor.commands.toggleSubscript();
      expect(editor.isActive("subscript")).toBe(true);
      editor.commands.toggleSuperscript();
      expect(editor.isActive("superscript")).toBe(true);
      expect(editor.isActive("subscript")).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});

describe("markdown round-trip", () => {
  it("has fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    it(`${fixture.name} serializes idempotently`, async () => {
      const pass1 = await serializeOnce(fixture.content);
      const pass2 = await serializeOnce(pass1);
      expect(pass2).toBe(pass1);
      if (pass1 !== fixture.content) {
        if (process.env.UPDATE_FIXTURES) {
          // Golden update: rewrite the fixture as its canonical form so
          // future runs assert byte-identity (UPDATE_FIXTURES=1 vitest run).
          writeFileSync(join(fixturesDir, fixture.name), pass1);
        } else {
          // Byte-identity against the canonical corpus. If this fails after
          // an intentional serializer change, regenerate the corpus with
          // UPDATE_FIXTURES=1 and review the diff.
          expect(pass1).toBe(fixture.content);
        }
      }
    });
  }
});
