"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { BugScreenshot } from "@/lib/types";

type Signed = BugScreenshot & { url: string | null };

export function ScreenshotGallery({ screenshots }: { screenshots: Signed[] }) {
  const [active, setActive] = useState<Signed | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const dur = reduce ? 0 : 0.2;

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active, close]);

  const viewable = screenshots.filter((s) => s.url);
  if (viewable.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {viewable.map((shot) => (
          <button
            key={shot.id}
            type="button"
            onClick={() => setActive(shot)}
            className="group relative aspect-video overflow-hidden rounded-lg border border-line bg-slate-50 transition-colors hover:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.url ?? ""}
              alt={shot.caption ?? "Bug screenshot"}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {active ? (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={active.caption ?? "Screenshot"}
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur, ease: "easeOut" }}
            className="lightbox-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <button
              ref={closeBtnRef}
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.figure
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
              transition={{ duration: dur, ease: "easeOut" }}
              className="flex max-h-full max-w-4xl flex-col items-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url ?? ""}
                alt={active.caption ?? "Bug screenshot"}
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
              />
              {active.caption ? (
                <figcaption className="text-sm text-white/90">
                  {active.caption}
                </figcaption>
              ) : null}
            </motion.figure>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
