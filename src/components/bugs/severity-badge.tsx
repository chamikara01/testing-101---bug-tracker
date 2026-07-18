import { cn } from "@/lib/utils";
import { SEVERITY_LABELS, type Severity } from "@/lib/types";

// Inverted: solid severity-color background, white text. Muted / desaturated
// tones (Jira-style) rather than saturated red/orange/yellow - softer while
// keeping white legible.
const STYLE: Record<Severity, string> = {
  critical: "bg-[#B0504F] text-white",
  major: "bg-[#B06A3C] text-white",
  minor: "bg-[#9C7C3A] text-white",
  trivial: "bg-[#6B7280] text-white",
};

/** Matching muted severity color for the left-edge bar on bug rows. */
export const SEVERITY_BAR: Record<Severity, string> = {
  critical: "bg-[#B0504F]",
  major: "bg-[#B06A3C]",
  minor: "bg-[#9C7C3A]",
  trivial: "bg-[#6B7280]",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STYLE[severity],
        className,
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
