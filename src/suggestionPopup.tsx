"use client";

import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type {
  ForwardRefExoticComponent,
  KeyboardEvent as ReactKeyboardEvent,
  RefAttributes,
} from "react";
import { computeFloatingPosition } from "./floatingPosition";

// Shared render() factory for suggestion popups (mentions, [[ page links).
// Mounts the list component in a fixed-position portal at the cursor, then
// refines to an edge-aware position on the next frame once the portal has
// painted and can be measured — same approach as SlashCommand.tsx.

export interface SuggestionListRef {
  onKeyDown: (event: ReactKeyboardEvent) => boolean;
}

export interface SuggestionListProps<Item> {
  items: Item[];
  command: (item: Item) => void;
}

export function createSuggestionRender<Item>(
  ListComponent: ForwardRefExoticComponent<
    SuggestionListProps<Item> & RefAttributes<SuggestionListRef>
  >,
): SuggestionOptions<Item>["render"] {
  return () => {
    let renderer: ReactRenderer<SuggestionListRef, SuggestionListProps<Item>> | null = null;

    const position = (props: SuggestionProps<Item>) => {
      if (!renderer) return;
      const rect = props.clientRect?.();
      const element = renderer.element as HTMLElement;
      element.style.position = "fixed";
      element.style.zIndex = "1000";
      if (!rect) return;
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.bottom + 6}px`;
      requestAnimationFrame(() => {
        if (!renderer) return;
        const elRect = element.getBoundingClientRect();
        if (!elRect.width || !elRect.height) return;
        const pos = computeFloatingPosition(
          { left: rect.left, top: rect.top, bottom: rect.bottom },
          { width: elRect.width, height: elRect.height },
        );
        element.style.left = `${pos.left}px`;
        element.style.top = `${pos.top}px`;
      });
    };

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(ListComponent, {
          editor: props.editor,
          props: {
            items: props.items,
            command: (item: Item) => props.command(item),
          },
        });
        document.body.appendChild(renderer.element);
        position(props);
      },
      onUpdate: (props) => {
        renderer?.updateProps({
          items: props.items,
          command: (item: Item) => props.command(item),
        });
        position(props);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          renderer?.element.remove();
          return true;
        }
        return (
          renderer?.ref?.onKeyDown(props.event as unknown as ReactKeyboardEvent) ?? false
        );
      },
      onExit: () => {
        renderer?.element.remove();
        renderer?.destroy();
        renderer = null;
      },
    };
  };
}
