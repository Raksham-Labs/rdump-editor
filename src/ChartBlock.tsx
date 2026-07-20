"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Hash, Plus, Trash2, Type } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BlockCaption } from "./BlockCaption";
import "./ChartBlock.css";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    chart: {
      insertChart: (attrs?: { kind?: ChartKind; data?: ChartRow[] }) => ReturnType;
    };
  }
}

export type ChartKind = "bar" | "line" | "area";

export interface ChartRow {
  label: string;
  value: number;
}

const DEFAULT_ROWS: ChartRow[] = [
  { label: "Run 14", value: 4.6 },
  { label: "Run 15", value: 4.4 },
  { label: "Run 16", value: 4.2 },
  { label: "Run 17", value: 4.8 },
  { label: "Run 18", value: 4.1 },
];

// Lazy so recharts only loads when a chart block actually renders — node
// views mount client-side only, so there's no SSR path to guard.
const ChartPreview = lazy(() =>
  import("./ChartPreview").then((mod) => ({ default: mod.ChartPreview })),
);

export const ChartBlock = Node.create({
  name: "chart",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      kind: {
        default: "bar" as ChartKind,
        parseHTML: (el) => (el.getAttribute("data-kind") as ChartKind | null) ?? "bar",
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
      data: {
        default: DEFAULT_ROWS,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-data");
          if (!raw) return DEFAULT_ROWS;
          try {
            return JSON.parse(raw) as ChartRow[];
          } catch {
            return DEFAULT_ROWS;
          }
        },
        renderHTML: (attrs) => ({ "data-data": JSON.stringify(attrs.data) }),
      },
      // Optional human-readable label shown in the block header.
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? "",
        renderHTML: (attrs) => (attrs.title ? { "data-title": attrs.title } : {}),
      },
      // Optional figure caption shown beneath the chart.
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") ?? "",
        renderHTML: (attrs) => (attrs.caption ? { "data-caption": attrs.caption } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type=\"chart\"]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "chart", class: "rdump-chart" }),
    ];
  },

  addCommands() {
    return {
      insertChart:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              kind: attrs?.kind ?? "bar",
              data: attrs?.data ?? DEFAULT_ROWS,
            },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartView);
  },

  // tiptap-markdown integration: serialize as a ```chart fenced block with
  // JSON-encoded attrs in the body; parse the same shape back when loading.
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; text: (s: string, esc?: boolean) => void; ensureNewLine: () => void; closeBlock: (n: unknown) => void },
          node: { attrs: { kind?: ChartKind; data?: ChartRow[]; title?: string; caption?: string } },
        ) {
          const title = (node.attrs.title ?? "").trim();
          const caption = (node.attrs.caption ?? "").trim();
          const payload = JSON.stringify(
            {
              kind: node.attrs.kind ?? "bar",
              data: node.attrs.data ?? [],
              // Only persist labels when set, so payloads stay clean.
              ...(title ? { title } : {}),
              ...(caption ? { caption } : {}),
            },
            null,
            2,
          );
          state.write("```chart\n");
          state.text(payload, false);
          state.ensureNewLine();
          state.write("```");
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            element.querySelectorAll("pre > code").forEach((codeEl) => {
              if (!/(?:^|\s)language-chart(?:\s|$)/.test(codeEl.className)) {
                return;
              }
              const pre = codeEl.parentElement;
              if (!pre) return;
              let kind: ChartKind = "bar";
              let data: ChartRow[] = [];
              let title = "";
              let caption = "";
              try {
                const parsed = JSON.parse(codeEl.textContent ?? "{}") as {
                  kind?: ChartKind;
                  data?: ChartRow[];
                  title?: string;
                  caption?: string;
                };
                if (parsed.kind) kind = parsed.kind;
                if (Array.isArray(parsed.data)) data = parsed.data;
                if (typeof parsed.title === "string") title = parsed.title;
                if (typeof parsed.caption === "string") caption = parsed.caption;
              } catch {
                // Leave the code block alone if the body isn't valid JSON —
                // user can fix it without us silently swallowing content.
                return;
              }
              const div = document.createElement("div");
              div.setAttribute("data-type", "chart");
              div.setAttribute("data-kind", kind);
              div.setAttribute("data-data", JSON.stringify(data));
              if (title) div.setAttribute("data-title", title);
              if (caption) div.setAttribute("data-caption", caption);
              pre.replaceWith(div);
            });
          },
        },
      },
    };
  },
});

interface DraftRow {
  label: string;
  value: string;
}

function rowsToDraft(rows: ChartRow[]): DraftRow[] {
  return rows.map((row) => ({ label: row.label, value: String(row.value) }));
}

function draftToRows(draft: DraftRow[]): ChartRow[] {
  return draft.map((row) => {
    const numeric = Number.parseFloat(row.value);
    return {
      label: row.label,
      value: Number.isFinite(numeric) ? numeric : 0,
    };
  });
}

function ChartView({ node, updateAttributes, editor }: NodeViewProps) {
  const kind: ChartKind = node.attrs.kind;
  const rows: ChartRow[] = node.attrs.data;
  const title: string = node.attrs.title ?? "";
  const caption: string = node.attrs.caption ?? "";
  const displayTitle = title.trim() || "Chart";
  const editable = editor.isEditable;
  const [open, setOpen] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(() => caption.trim().length > 0);
  const [captionAutoFocus, setCaptionAutoFocus] = useState(false);
  const openCaption = () => {
    setCaptionAutoFocus(true);
    setCaptionOpen(true);
  };
  const [draft, setDraft] = useState<DraftRow[]>(() => rowsToDraft(rows));
  // Track new rows we need to autofocus once the input mounts. Holds the
  // index of the most recently added row; cleared after focus is applied.
  const focusRowRef = useRef<number | null>(null);
  const rowRefs = useRef<Array<HTMLInputElement | null>>([]);

  // When the data panel opens, resync draft from attrs so external changes
  // (undo/redo, sibling edits) aren't masked by stale local state.
  useEffect(() => {
    if (!open) return;
    setDraft(rowsToDraft(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const target = focusRowRef.current;
    if (target === null) return;
    rowRefs.current[target]?.focus();
    focusRowRef.current = null;
  }, [draft.length]);

  const commit = (next: DraftRow[]) => {
    updateAttributes({ data: draftToRows(next) });
  };

  const updateCell = (index: number, key: keyof DraftRow, value: string) => {
    setDraft((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const commitCurrent = () => {
    commit(draft);
  };

  const addRow = () => {
    const next = [...draft, { label: "", value: "0" }];
    focusRowRef.current = next.length - 1;
    setDraft(next);
    commit(next);
  };

  const removeRow = (index: number) => {
    if (draft.length <= 1) return;
    const next = draft.filter((_, i) => i !== index);
    setDraft(next);
    commit(next);
  };

  return (
    <NodeViewWrapper className="rdump-chart">
      <div className="rdump-chart__toolbar" contentEditable={false}>
        {editable ? (
          <input
            type="text"
            className="rdump-chart__title-input"
            value={title}
            placeholder="Chart"
            aria-label="Chart title"
            spellCheck={false}
            onChange={(event) => updateAttributes({ title: event.target.value })}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="rdump-chart__title" title={displayTitle}>
            {displayTitle}
          </span>
        )}
        {editable ? (
          <div className="rdump-chart__actions">
            <select
              value={kind}
              onChange={(event) => updateAttributes({ kind: event.target.value as ChartKind })}
              className="rdump-chart__kind"
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
            </select>
            <button
              type="button"
              className="rdump-chart__toggle"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Hide data" : "Edit data"}
            </button>
            {!captionOpen ? (
              <button type="button" className="rdump-chart__toggle" onClick={openCaption}>
                Add caption
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {open && editable ? (
        <div className="rdump-chart__data" contentEditable={false}>
          <div className="rdump-chart__data-head" role="row">
            <span className="rdump-chart__data-th" role="columnheader">
              <Type size={12} aria-hidden />
              Label
            </span>
            <span className="rdump-chart__data-th" role="columnheader">
              <Hash size={12} aria-hidden />
              Value
            </span>
            <span
              className="rdump-chart__data-th rdump-chart__data-th--action"
              aria-hidden
            />
          </div>
          {draft.map((row, index) => (
            // Position-based keys are fine here: rows don't carry stable
            // ids and order is meaningful (it maps to the x-axis).
            // eslint-disable-next-line react/no-array-index-key
            <div className="rdump-chart__data-row" role="row" key={index}>
              <input
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                className="rdump-chart__data-cell"
                value={row.label}
                placeholder="Label"
                spellCheck={false}
                onChange={(event) => updateCell(index, "label", event.target.value)}
                onBlur={commitCurrent}
              />
              <input
                className="rdump-chart__data-cell rdump-chart__data-cell--number"
                value={row.value}
                inputMode="decimal"
                placeholder="0"
                spellCheck={false}
                onChange={(event) => updateCell(index, "value", event.target.value)}
                onBlur={commitCurrent}
              />
              <button
                type="button"
                className="rdump-chart__data-del"
                title="Delete row"
                aria-label={`Delete row ${index + 1}`}
                disabled={draft.length <= 1}
                onClick={() => removeRow(index)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="rdump-chart__data-add"
            onClick={addRow}
          >
            <Plus size={13} aria-hidden />
            Add row
          </button>
        </div>
      ) : null}
      <div className="rdump-chart__preview" contentEditable={false}>
        <Suspense fallback={<div className="rdump-chart__loading">Loading chart…</div>}>
          <ChartPreview kind={kind} data={rows} />
        </Suspense>
      </div>
      <BlockCaption
        editable={editable}
        open={captionOpen}
        value={caption}
        autoFocus={captionAutoFocus}
        onChange={(value) => updateAttributes({ caption: value })}
        onClose={() => setCaptionOpen(false)}
      />
    </NodeViewWrapper>
  );
}
