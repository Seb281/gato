import { useEffect } from "react";

/**
 * Registers keyboard shortcuts for quiz components.
 *
 * Ignores key events when the active element is an input, textarea,
 * or has contentEditable enabled so typing in form fields is unaffected.
 *
 * Key mapping: event.key values are passed through directly, except
 * " " (space) is normalised to "Space" so callers can use a readable name.
 */
export function useQuizKeyboard(handlers: Record<string, () => void>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }

      const key = e.key === " " ? "Space" : e.key;
      const handler = handlers[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
