"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { computeFloatingPosition } from "./floatingPosition";
import { lookupMentionUser } from "./MentionList";
import "./MentionHoverCard.css";

interface HoverTarget {
  id: string;
  name: string;
  rect: { left: number; top: number; bottom: number };
}

// A read-only hover card for rendered @mention chips. The mention node carries
// only id + label (name), so the email is resolved on demand from the cached
// org users list. Not gated on `editable` — readers hovering a mention should
// see who it is too. Uses delegated mouseover/mouseout on the editor surface
// (mouseenter/leave don't bubble) so it works for every chip without a
// per-node NodeView.
export function MentionHoverCard({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<HoverTarget | null>(null);
  // Resolved email tagged with the id it belongs to, so a stale in-flight
  // lookup for a previous chip can't paint onto the current one. Set only from
  // the async callback — never synchronously in an effect.
  const [resolved, setResolved] = useState<{ id: string; email: string } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  // The chip currently driving the card — guards against redundant re-resolves
  // when mouseover re-fires on the same element.
  const activeChip = useRef<HTMLElement | null>(null);

  const clearHide = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);
  // Small grace period so moving the pointer from the chip onto the card (or
  // vice versa) doesn't flicker the card closed.
  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = window.setTimeout(() => {
      activeChip.current = null;
      setTarget(null);
    }, 120);
  }, [clearHide]);

  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    const chipOf = (node: EventTarget | null): HTMLElement | null =>
      node instanceof HTMLElement
        ? (node.closest('[data-type="mention"]') as HTMLElement | null)
        : null;

    const onOver = (event: MouseEvent) => {
      const chip = chipOf(event.target);
      if (!chip) return;
      clearHide();
      if (activeChip.current === chip) return;
      activeChip.current = chip;
      const rect = chip.getBoundingClientRect();
      setTarget({
        id: chip.getAttribute("data-id") ?? "",
        name:
          chip.getAttribute("data-label") ??
          chip.textContent?.replace(/^@/, "") ??
          "",
        rect: { left: rect.left, top: rect.top, bottom: rect.bottom },
      });
    };
    const onOut = (event: MouseEvent) => {
      const chip = chipOf(event.target);
      if (!chip) return;
      // Staying within the same chip (moving between its descendants) isn't a
      // real leave.
      if (chip.contains(event.relatedTarget as Node | null)) return;
      scheduleHide();
    };

    dom.addEventListener("mouseover", onOver);
    dom.addEventListener("mouseout", onOut);
    return () => {
      dom.removeEventListener("mouseover", onOver);
      dom.removeEventListener("mouseout", onOut);
      clearHide();
    };
  }, [editor, clearHide, scheduleHide]);

  // Resolve the email for the hovered mention. Keyed on the id so it doesn't
  // re-fetch when only the chip's screen rect changes.
  const targetId = target?.id ?? null;
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    lookupMentionUser(editor, targetId).then((user) => {
      if (!cancelled) setResolved({ id: targetId, email: user?.email ?? "" });
    });
    return () => {
      cancelled = true;
    };
  }, [editor, targetId]);

  // Measure the rendered card and flip/clamp it into the viewport. Re-runs when
  // the resolved email lands, since that changes the card's size.
  useLayoutEffect(() => {
    if (!target) return;
    const el = cardRef.current;
    if (!el) return;
    const size = el.getBoundingClientRect();
    setPos(
      computeFloatingPosition(target.rect, {
        width: size.width,
        height: size.height,
      }),
    );
  }, [target, resolved]);

  if (!target) return null;

  const email = resolved && resolved.id === target.id ? resolved.email : null;

  return (
    <div
      ref={cardRef}
      className="rdump-mention-card"
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 50,
      }}
      onMouseEnter={clearHide}
      onMouseLeave={scheduleHide}
    >
      <span className="rdump-mention-card__avatar" aria-hidden="true">
        {target.name[0]?.toUpperCase() ?? "@"}
      </span>
      <span className="rdump-mention-card__body">
        <span className="rdump-mention-card__name">{target.name || "Unknown"}</span>
        <span className="rdump-mention-card__email">
          {email === null ? "…" : email || "No email on file"}
        </span>
      </span>
    </div>
  );
}
