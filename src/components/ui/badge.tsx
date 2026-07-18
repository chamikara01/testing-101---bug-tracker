import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill badge. Pass a color class string from lib/brand.ts, e.g.
 *   <Badge className={SEVERITY_BADGE[bug.severity]}>{SEVERITY_LABELS[...]}</Badge>
 */
export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
