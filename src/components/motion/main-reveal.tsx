"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Cross-fades the main content on each route AND filter change (keyed by
 * pathname + query). A page/tab transition, not a scroll effect. Respects
 * reduced-motion (renders instantly).
 */
export function MainReveal({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      key={`${pathname}?${search.toString()}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
