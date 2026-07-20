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
import { resolveConfig } from "./config";
import { loadExtensions } from "./extensions";
import {
  getEditorMarkdown,
  parseStoredContent,
  serializeDoc,
  type ContentFormat,
} from "./markdown";
import { createDefaultRuntime } from "./runtime";

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

describe("feature gating", () => {
  const FENCES = "# Doc\n\n```mermaid\ngraph TD\n  A --> B\n```\n";

  it("keeps mermaid fences as plain code blocks when the feature is off", async () => {
    const off = { features: { mermaid: false, charts: false } };
    const pass1 = await serializeOnce(FENCES, off);
    expect(pass1).toContain("```mermaid");
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
        details: false,
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
