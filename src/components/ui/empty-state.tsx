import * as React from "react";
import { cn } from "@/lib/utils";
import { Mascot, type MascotName } from "@/components/brand/mascot";

export function EmptyState({
  mascot,
  icon,
  title,
  description,
  action,
  className,
}: {
  /** Testing 101 mascot illustration (preferred). */
  mascot?: MascotName;
  /** Fallback icon if no mascot is given. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      {mascot ? (
        <Mascot name={mascot} className="mb-4 h-36" />
      ) : icon ? (
        <div className="mb-3 text-brand-slate">{icon}</div>
      ) : null}
      <h3 className="font-display text-lg font-semibold text-brand-charcoal">
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-brand-slate">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
