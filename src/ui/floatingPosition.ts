/**
 * Decide where a floating popover should sit given the anchor's screen rect
 * and the popover's measured size. Flips above the anchor when there's no
 * room below; clamps to viewport horizontally. Both inputs and outputs are
 * viewport-relative (use with `position: fixed`).
 */
export function computeFloatingPosition(
  anchor: { left: number; top: number; bottom: number },
  elementSize: { width: number; height: number },
  options?: { gap?: number; margin?: number; viewport?: { w: number; h: number } },
): { left: number; top: number } {
  const gap = options?.gap ?? 6;
  const margin = options?.margin ?? 8;
  const vp =
    options?.viewport ?? { w: window.innerWidth, h: window.innerHeight };

  const spaceBelow = vp.h - anchor.bottom - gap - margin;
  const spaceAbove = anchor.top - gap - margin;

  let top: number;
  if (elementSize.height <= spaceBelow) {
    top = anchor.bottom + gap;
  } else if (elementSize.height <= spaceAbove) {
    top = anchor.top - gap - elementSize.height;
  } else {
    // Neither side fits — pin to the top of the viewport with margin.
    top = margin;
  }

  let left = anchor.left;
  if (left + elementSize.width > vp.w - margin) {
    left = vp.w - elementSize.width - margin;
  }
  if (left < margin) left = margin;

  return { left, top };
}
