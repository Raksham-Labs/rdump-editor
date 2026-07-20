import type { Editor } from "@tiptap/react";
import { getRuntime } from "./runtime";

// HEIC/HEIF aren't decoded by Chrome/Firefox/Edge in <img> tags (only Safari).
// Until a transcode path exists, reject up front with an actionable message
// rather than letting a broken data URL land in the doc. Detect by both MIME
// and extension since Finder drops sometimes leave file.type empty.
const HEIC_EXT_RE = /\.(heic|heif)$/i;
const HEIC_MIME_RE = /^image\/(heic|heif)/i;

const SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/bmp",
]);

const SUPPORTED_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i;

/** Cheap pre-check used by paste/drop handlers to decide whether to intercept. */
export function looksLikeImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return SUPPORTED_EXT_RE.test(file.name) || HEIC_EXT_RE.test(file.name);
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Inserts the file as an image node. When the host provides an uploadImage
 * handler, files up to maxImageBytes are stored through it and referenced by
 * URL, keeping the document body small; oversized files (and upload failures,
 * e.g. offline) fall back to inline base64 so an image never fails to land.
 * Without a handler, every image is stored inline. If `at` is provided,
 * inserts at that document position; otherwise at the selection.
 *
 * Returns true if the file passed validation and the (async) insert started;
 * false if it was rejected synchronously.
 */
export function insertImageFile(
  editor: Editor,
  file: File,
  options?: { at?: number },
): boolean {
  const { uploadImage, maxImageBytes, notify } = getRuntime(editor);
  if (HEIC_EXT_RE.test(file.name) || HEIC_MIME_RE.test(file.type)) {
    notify.error(
      "HEIC/HEIF isn't supported by most browsers. Convert to JPEG or change your iPhone camera setting to 'Most Compatible'.",
    );
    return false;
  }
  if (!file.type.startsWith("image/") && !SUPPORTED_EXT_RE.test(file.name)) {
    notify.error("Please choose an image file.");
    return false;
  }
  if (file.type && !SUPPORTED_MIME.has(file.type)) {
    notify.error(`${file.type} isn't supported. Use JPEG, PNG, GIF, WebP, AVIF, or SVG.`);
    return false;
  }

  void (async () => {
    let src: string | null = null;
    if (uploadImage && file.size <= maxImageBytes) {
      // The node is only inserted after the upload returns, so bridge the
      // gap with a progress notice — on a slow uplink a multi-MB paste
      // otherwise looks like it did nothing.
      const uploading = notify.loading("Uploading image…");
      try {
        const asset = await uploadImage(file);
        src = asset.url;
      } catch (error) {
        console.warn("[rdump-editor] image upload failed, storing image inline", error);
        notify.warning("Upload failed — image stored inside the page instead.");
      } finally {
        uploading.dismiss();
      }
    } else if (uploadImage) {
      notify.warning(
        `Image is over ${maxImageBytes / (1024 * 1024)} MB — stored inside the page, which makes saves heavier.`,
      );
    }
    if (!src) src = await readAsDataUrl(file);
    if (!src) {
      notify.error("Couldn't read the image file.");
      return;
    }
    if (editor.isDestroyed) return;
    // size rides along as a node attr so the placeholder and hover badge can
    // show it — setImage() only types src/alt/title, hence insertContent.
    const imageNode = {
      type: "image",
      attrs: { src, alt: file.name, size: file.size },
    };
    if (typeof options?.at === "number") {
      editor.chain().focus().insertContentAt(options.at, imageNode).run();
    } else {
      editor.chain().focus().insertContent(imageNode).run();
    }
  })();
  return true;
}
