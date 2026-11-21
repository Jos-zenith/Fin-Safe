"use client";
import { useEffect, useRef, useState } from "react";

/**
 * How long this item was actually in front of the adviser: counted only while the tab is visible and at least half the
 * card is on screen. `take()` returns the milliseconds since the last call and starts counting again. Only a number is sent.
 */
export function useDwell() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const ms = useRef(0);
  const since = useRef<number | null>(null);
  const inView = useRef(false);
  useEffect(() => {
    const flush = () => {
      if (since.current !== null) ms.current += Date.now() - since.current;
      since.current = null;
    };
    const sync = () => {
      const on = inView.current && document.visibilityState === "visible";
      if (on && since.current === null) since.current = Date.now();
      else if (!on) flush();
    };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([e]) => {
              inView.current = !!e?.isIntersecting && e.intersectionRatio >= 0.5;
              sync();
            },
            { threshold: [0, 0.5, 1] },
          );
    if (io && node) io.observe(node);
    else {
      inView.current = true; // no observer (very old browser): count the time the page is visible
      sync();
    }
    document.addEventListener("visibilitychange", sync);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      flush();
    };
  }, [node]);
  const take = () => {
    if (since.current !== null) {
      ms.current += Date.now() - since.current;
      since.current = Date.now();
    }
    const out = Math.round(ms.current);
    ms.current = 0;
    return out;
  };
  return [setNode, take] as const;
}
