import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { DEFAULT_EDITOR_CONFIG, type ResolvedEditorConfig } from "./config";

// Host-app integration surface. Non-React editor code (paste handlers,
// suggestion resolvers, ProseMirror plugins, node views) can't receive React
// props, so the host's callbacks travel on `editor.storage` via the
// RuntimeBridge extension below. The component keeps ONE mutable runtime
// object for the editor's lifetime and refreshes its fields from props on
// every render — reads through getRuntime() always see current values without
// the extension list ever rebuilding.

export interface NotifyLoadingHandle {
  dismiss: () => void;
}

// Toast-style notification sink. The host maps this onto its own toast
// system; the default quietly logs to the console so the editor works
// standalone.
export interface EditorNotify {
  info: (message: string) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  // Shown while a slow async action (image upload) runs; the returned handle
  // dismisses it.
  loading: (message: string) => NotifyLoadingHandle;
}

export interface MentionUser {
  id: string;
  name: string;
  email: string;
}

export interface PageRef {
  id: string;
  title: string;
}

export interface EditorRuntime {
  // Stores an image externally and returns its URL. Absent ⇒ images are kept
  // inline as base64 data URLs and no migration runs.
  uploadImage?: (file: File) => Promise<{ url: string }>;
  // Supplies the people list for @-mentions. Absent ⇒ the picker offers
  // pages only.
  loadMentionUsers?: () => Promise<MentionUser[]>;
  // Navigate to another document when a page link / page mention is clicked.
  onOpenPage?: (docId: string) => void;
  notify: EditorNotify;
  maxImageBytes: number;
  config: ResolvedEditorConfig;
}

export const defaultNotify: EditorNotify = {
  info: (message) => console.info("[rdump-editor]", message),
  success: (message) => console.info("[rdump-editor]", message),
  warning: (message) => console.warn("[rdump-editor]", message),
  error: (message) => console.error("[rdump-editor]", message),
  loading: (message) => {
    console.info("[rdump-editor]", message);
    return { dismiss: () => {} };
  },
};

export function createDefaultRuntime(): EditorRuntime {
  return {
    notify: defaultNotify,
    maxImageBytes: DEFAULT_EDITOR_CONFIG.behavior.maxImageBytes,
    config: DEFAULT_EDITOR_CONFIG,
  };
}

interface RuntimeBridgeOptions {
  runtime: EditorRuntime;
}

export const RuntimeBridge = Extension.create<RuntimeBridgeOptions>({
  name: "rdumpRuntime",

  addOptions() {
    return { runtime: createDefaultRuntime() };
  },

  addStorage() {
    return { runtime: this.options.runtime };
  },
});

export function getRuntime(editor: Editor): EditorRuntime {
  const storage = (editor.storage as { rdumpRuntime?: { runtime?: EditorRuntime } })
    .rdumpRuntime;
  // Defensive: an editor built without the bridge (shouldn't happen — the
  // extension loader always includes it) still gets working defaults.
  return storage?.runtime ?? createDefaultRuntime();
}
