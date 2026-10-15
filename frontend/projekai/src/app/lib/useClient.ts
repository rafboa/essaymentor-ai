import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True after hydration; false during server render and the hydrating pass. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Whether the platform's shortcut modifier is ⌘ rather than Ctrl. */
export function useIsMac(): boolean {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => false);
}

/** Live result of a CSS media query; false during server render. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
