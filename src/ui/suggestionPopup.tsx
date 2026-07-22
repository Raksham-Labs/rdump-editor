"use client";

import type { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import { exitSuggestion, type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import type {
  ForwardRefExoticComponent,
  KeyboardEvent as ReactKeyboardEvent,
  RefAttributes,
} from "react";
import { computeFloatingPosition } from "./floatingPosition";
import { inheritEditorTheme } from "../theme";

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
  // The SAME key the caller hands to Suggestion — needed to end the
  // suggestion programmatically on an outside click.
  pluginKey?: PluginKey,
): SuggestionOptions<Item>["render"] {
  return () => {
    let renderer: ReactRenderer<SuggestionListRef, SuggestionListProps<Item>> | null = null;
    let onOutsideDown: ((event: MouseEvent) => void) | null = null;

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
        // Body portal — outside the editor wrapper, so the theme (color
        // scheme + inline token overrides) must be copied on explicitly.
        inheritEditorTheme(renderer.element as HTMLElement, props.editor.view.dom);
        document.body.appendChild(renderer.element);
        position(props);
        // Dismiss on outside click. The plugin only exits on its own when
        // the caret moves or the query breaks, so clicking the page outside
        // the editor would otherwise leave the popup hanging.
        onOutsideDown = (event: MouseEvent) => {
          if (!renderer || renderer.element.contains(event.target as Node)) return;
          exitSuggestion(props.editor.view, pluginKey);
        };
        document.addEventListener("mousedown", onOutsideDown);
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
          // Full plugin exit, not just hiding the element — otherwise the
          // suggestion stays active invisibly and a follow-up Enter would
          // still run the hidden selected item.
          exitSuggestion(props.view, pluginKey);
          return true;
        }
        return (
          renderer?.ref?.onKeyDown(props.event as unknown as ReactKeyboardEvent) ?? false
        );
      },
      onExit: () => {
        if (onOutsideDown) document.removeEventListener("mousedown", onOutsideDown);
        onOutsideDown = null;
        renderer?.element.remove();
        renderer?.destroy();
        renderer = null;
      },
    };
  };
}
