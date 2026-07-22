"use client";

// Tiny module-level store bridging the host's page list into the editor
// extensions. Suggestion plugins ([[ page links, @ mentions) and the PageLink
// node view can't reach React context from inside ProseMirror plugins, so the
// editor component publishes its `pages` prop here and extension code reads /
// subscribes. Navigation on page-link click goes through the runtime's
// onOpenPage handler (see runtime.ts), not this store.

export interface WorkspacePageRef {
  id: string;
  title: string;
}

let pages: WorkspacePageRef[] = [];
let titleById = new Map<string, string>();
// Cheap fingerprint of the published list so the editor component can call
// setWorkspacePages on every render of changing host state (every keystroke)
// without notifying subscribers unless an id or title actually changed.
let fingerprint = "";
const listeners = new Set<() => void>();

export function setWorkspacePages(next: WorkspacePageRef[]): void {
  const nextFingerprint = next.map((page) => `${page.id} ${page.title}`).join("");
  if (nextFingerprint === fingerprint) return;
  fingerprint = nextFingerprint;
  pages = next;
  titleById = new Map(next.map((page) => [page.id, page.title]));
  for (const listener of listeners) listener();
}

export function getWorkspacePages(): WorkspacePageRef[] {
  return pages;
}

export function getWorkspacePageTitle(docId: string): string | undefined {
  return titleById.get(docId);
}

// False until the first publish — lets a link chip avoid flashing the
// "missing page" style while the host's page list is still loading.
export function hasWorkspacePages(): boolean {
  return fingerprint !== "";
}

export function subscribeWorkspacePages(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
