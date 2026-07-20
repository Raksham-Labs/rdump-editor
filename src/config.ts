// Structural configuration for the editor. Everything here is decided before
// the Tiptap instance is created: feature flags gate which extension modules
// are even imported (heavy dependencies like katex, lowlight, mermaid and
// recharts only load when their feature is on), ui flags gate the chrome, and
// behavior holds the tunable numbers/strings that used to be constants.
//
// Reactive data and callbacks (page list, upload handler, notifications, …)
// are component props, not config — see the EditorRuntime in runtime.ts.

export interface EditorFeatureConfig {
  images: boolean;
  tables: boolean;
  taskLists: boolean;
  codeBlocks: boolean;
  math: boolean;
  mermaid: boolean;
  charts: boolean;
  callouts: boolean;
  details: boolean;
  hashtags: boolean;
  mentions: boolean;
  pageLinks: boolean;
}

export interface EditorUiConfig {
  toolbar: boolean;
  bubbleMenu: boolean;
  slashMenu: boolean;
  // The drag handle / plus gutter in the left margin.
  dragHandle: boolean;
  // The Editor / Split / Markdown view switch and the raw-markdown pane.
  markdownView: boolean;
  // Word/character counts (and the long-doc warning) below the surface.
  footer: boolean;
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface EditorBehaviorConfig {
  placeholder: { paragraph: string; heading: string };
  headingLevels: HeadingLevel[];
  characterLimit: number;
  // Character count past which the footer nudges the user to split the page.
  // `false` disables the warning entirely.
  longDocWarningChars: number | false;
  // Images at or under this many bytes go through the host's upload handler;
  // bigger ones are stored inline as base64 so an insert never fails.
  maxImageBytes: number;
  // localStorage key for persisting the Editor/Split/Markdown view choice.
  // `false` disables persistence (the mode still works for the session).
  persistViewModeKey: string | false;
}

export interface RDumpEditorConfig {
  features?: Partial<EditorFeatureConfig>;
  ui?: Partial<EditorUiConfig>;
  behavior?: Partial<Omit<EditorBehaviorConfig, "placeholder">> & {
    placeholder?: Partial<EditorBehaviorConfig["placeholder"]>;
  };
}

export interface ResolvedEditorConfig {
  features: EditorFeatureConfig;
  ui: EditorUiConfig;
  behavior: EditorBehaviorConfig;
}

export const DEFAULT_EDITOR_CONFIG: ResolvedEditorConfig = {
  features: {
    images: true,
    tables: true,
    taskLists: true,
    codeBlocks: true,
    math: true,
    mermaid: true,
    charts: true,
    callouts: true,
    details: true,
    hashtags: true,
    mentions: true,
    pageLinks: true,
  },
  ui: {
    toolbar: true,
    bubbleMenu: true,
    slashMenu: true,
    dragHandle: true,
    markdownView: true,
    footer: true,
  },
  behavior: {
    placeholder: {
      paragraph: "Press / for blocks, or just start writing…",
      heading: "Section title",
    },
    headingLevels: [1, 2, 3],
    characterLimit: 100_000,
    longDocWarningChars: 50_000,
    maxImageBytes: 4 * 1024 * 1024,
    persistViewModeKey: "rdump:editor-view",
  },
};

export function resolveConfig(config?: RDumpEditorConfig): ResolvedEditorConfig {
  const defaults = DEFAULT_EDITOR_CONFIG;
  if (!config) return defaults;
  return {
    features: { ...defaults.features, ...config.features },
    ui: { ...defaults.ui, ...config.ui },
    behavior: {
      ...defaults.behavior,
      ...config.behavior,
      placeholder: {
        ...defaults.behavior.placeholder,
        ...config.behavior?.placeholder,
      },
    },
  };
}
