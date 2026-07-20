import { useEffect, useMemo, useState } from "react";
import {
  RDumpEditor,
  type MentionUser,
  type PageRef,
  type RDumpEditorConfig,
} from "@rakshamlabs/rdump-editor";
import { RoundTrip } from "./RoundTrip";

const DOC_KEY = "rdump-playground:doc";
const CONFIG_KEY = "rdump-playground:config";

const STARTER_DOC = `# @rakshamlabs/rdump-editor playground

Type \`/\` for blocks. Everything you see is the packaged editor.

- [ ] Try a task list
- Try a table: type \`| a | b |\` then a delimiter row

Some **bold**, ==highlight==, and $e^{i\\pi}+1=0$ inline math.
`;

const DEMO_PAGES: PageRef[] = [
  { id: "pg-1", title: "Getting started" },
  { id: "pg-2", title: "Release checklist" },
  { id: "pg-3", title: "Meeting notes" },
];

const DEMO_USERS: MentionUser[] = [
  { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" },
  { id: "u-2", name: "Grace Hopper", email: "grace@example.com" },
  { id: "u-3", name: "Alan Turing", email: "alan@example.com" },
];

const loadDemoUsers = () => Promise.resolve(DEMO_USERS);

// Fake upload: object URLs stand in for a host's asset store. Good enough to
// exercise the upload path end to end (progress notice, node insert, resize).
const uploadDemoImage = (file: File) =>
  Promise.resolve({ url: URL.createObjectURL(file) });

const FEATURE_KEYS = [
  "images",
  "tables",
  "taskLists",
  "codeBlocks",
  "math",
  "mermaid",
  "charts",
  "callouts",
  "details",
  "hashtags",
  "mentions",
  "pageLinks",
] as const;

const UI_KEYS = [
  "toolbar",
  "bubbleMenu",
  "slashMenu",
  "dragHandle",
  "markdownView",
  "footer",
] as const;

type Flags = {
  features: Record<(typeof FEATURE_KEYS)[number], boolean>;
  ui: Record<(typeof UI_KEYS)[number], boolean>;
};

const ALL_ON: Flags = {
  features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Flags["features"],
  ui: Object.fromEntries(UI_KEYS.map((k) => [k, true])) as Flags["ui"],
};

function loadFlags(): Flags {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return ALL_ON;
    const parsed = JSON.parse(raw) as Partial<Flags>;
    return {
      features: { ...ALL_ON.features, ...parsed.features },
      ui: { ...ALL_ON.ui, ...parsed.ui },
    };
  } catch {
    return ALL_ON;
  }
}

export function App() {
  const [tab, setTab] = useState<"editor" | "roundtrip">("editor");
  const [flags, setFlags] = useState<Flags>(loadFlags);
  const [content, setContent] = useState(
    () => localStorage.getItem(DOC_KEY) ?? STARTER_DOC,
  );

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(flags));
  }, [flags]);

  const config = useMemo<RDumpEditorConfig>(
    () => ({ features: flags.features, ui: flags.ui }),
    [flags],
  );
  // Config changes rebuild the Tiptap instance; keying the editor on the
  // config makes that an explicit clean remount.
  const configKey = JSON.stringify(config);

  const toggle = (group: "features" | "ui", key: string) =>
    setFlags((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: !prev[group][key as keyof (typeof prev)[typeof group]],
      },
    }));

  return (
    <div className="pg-shell">
      <aside className="pg-sidebar">
        <h1>@rakshamlabs/rdump-editor</h1>
        <div className="pg-tabs">
          <button
            type="button"
            className={tab === "editor" ? "is-active" : ""}
            onClick={() => setTab("editor")}
          >
            Editor
          </button>
          <button
            type="button"
            className={tab === "roundtrip" ? "is-active" : ""}
            onClick={() => setTab("roundtrip")}
          >
            Round-trip
          </button>
        </div>

        <h2>features</h2>
        {FEATURE_KEYS.map((key) => (
          <label key={key} className="pg-toggle">
            <input
              type="checkbox"
              checked={flags.features[key]}
              onChange={() => toggle("features", key)}
            />
            {key}
          </label>
        ))}

        <h2>ui</h2>
        {UI_KEYS.map((key) => (
          <label key={key} className="pg-toggle">
            <input
              type="checkbox"
              checked={flags.ui[key]}
              onChange={() => toggle("ui", key)}
            />
            {key}
          </label>
        ))}

        <p className="pg-remount-note">
          Toggling remounts the editor with the new config. Content persists in
          localStorage. Careful: turning a feature off degrades that content on
          the next serialize (mermaid/chart fences survive; HTML-based nodes
          like math or callouts don't).
        </p>
      </aside>

      <main className="pg-main">
        {tab === "editor" ? (
          <RDumpEditor
            key={configKey}
            documentId="playground-doc"
            initialContent={content}
            config={config}
            pages={DEMO_PAGES}
            onOpenPage={(id) => window.alert(`open page: ${id}`)}
            onUploadImage={uploadDemoImage}
            loadMentionUsers={loadDemoUsers}
            onChange={(markdown) => {
              setContent(markdown);
              localStorage.setItem(DOC_KEY, markdown);
            }}
          />
        ) : (
          <RoundTrip />
        )}
      </main>
    </div>
  );
}
