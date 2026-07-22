import type { Editor } from "@tiptap/react";
import { getRuntime } from "../../runtime";

// Lazy migration of legacy documents: images inserted before external storage
// existed live as base64 data URIs inside the body. The editor invokes this on
// the FIRST genuine user edit of a session — never on mere open — so the doc
// is already dirty by the user's own hand and the rewrites simply join that
// edit and save through the host's normal flow. Docs that are only read stay
// byte-identical for the host.
//
// Requires the host's uploadImage handler; without one there is nowhere to
// move the bytes, so this is a no-op. Hosts with content-hash dedupe get
// idempotency for free: if a migration uploaded but the rewritten doc never
// got saved (tab closed), the next run re-uploads the same bytes and gets the
// same URL back.

// Docs with a migration currently running — guards against double effects
// (StrictMode) and re-renders re-entering the loop.
const inFlight = new Set<string>();

interface InlineImage {
  src: string;
  alt: string | null;
  approxBytes: number;
}

function findNextInlineImage(editor: Editor, skipped: Set<string>): InlineImage | null {
  let found: InlineImage | null = null;
  editor.state.doc.descendants((node) => {
    if (found) return false;
    if (node.type.name !== "image") return true;
    const src = node.attrs.src as string | null;
    if (!src || !src.startsWith("data:") || skipped.has(src)) return true;
    found = {
      src,
      alt: (node.attrs.alt as string | null) ?? null,
      // base64 ≈ 4/3 of the raw bytes; good enough for the size gate.
      approxBytes: Math.round((src.length * 3) / 4),
    };
    return false;
  });
  return found;
}

// Swaps every image node carrying `src` to the uploaded URL in one
// transaction. Attribute-only changes never shift positions, so all swaps can
// share a single descendants pass. addToHistory:false keeps Cmd+Z from
// resurrecting megabytes of base64.
function rewriteSrc(editor: Editor, src: string, url: string, size: number): void {
  editor.commands.command(({ tr, state }) => {
    let changed = false;
    state.doc.descendants((node, pos) => {
      if (node.type.name === "image" && node.attrs.src === src) {
        tr.setNodeAttribute(pos, "src", url);
        tr.setNodeAttribute(pos, "size", size);
        changed = true;
      }
      return true;
    });
    if (changed) tr.setMeta("addToHistory", false);
    return changed;
  });
}

export async function migrateInlineImages(editor: Editor, docId: string): Promise<void> {
  const { uploadImage, maxImageBytes, notify } = getRuntime(editor);
  if (!uploadImage) return;
  if (inFlight.has(docId)) return;
  inFlight.add(docId);
  // Srcs to leave alone for this run: over the upload cap, or rejected by the
  // upload handler (unsupported mime). Session-local — a future open retries.
  const skipped = new Set<string>();
  let migrated = 0;
  try {
    while (!editor.isDestroyed) {
      const target = findNextInlineImage(editor, skipped);
      if (!target) break;
      if (target.approxBytes > maxImageBytes) {
        skipped.add(target.src);
        continue;
      }
      let blob: Blob;
      try {
        blob = await (await fetch(target.src)).blob();
      } catch {
        skipped.add(target.src);
        continue;
      }
      try {
        const file = new File([blob], target.alt || "image", {
          type: blob.type || "application/octet-stream",
        });
        const asset = await uploadImage(file);
        if (editor.isDestroyed) break;
        rewriteSrc(editor, target.src, asset.url, blob.size);
        migrated += 1;
      } catch (error) {
        // Network down (fetch rejects with TypeError before any response):
        // stop entirely and let a later open retry. Upload-side rejection
        // (bad mime, race): skip just this image and keep going.
        if (error instanceof TypeError) {
          console.warn("[rdump-editor] image migration paused — network unavailable", error);
          break;
        }
        console.warn("[rdump-editor] image migration skipped one image", error);
        skipped.add(target.src);
      }
    }
  } finally {
    inFlight.delete(docId);
  }
  if (migrated > 0) {
    notify.success(
      `Moved ${migrated} image${migrated === 1 ? "" : "s"} to attachment storage — this page just got lighter.`,
    );
  }
}
