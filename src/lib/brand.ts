import type { Severity } from "@/lib/database.types";

/** Raw brand palette (hex). Mirrors the @theme tokens in globals.css. */
export const BRAND = {
  blue: "#2563eb",
  blueDark: "#1d4ed8",
  blueSoft: "#dbeafe",
  charcoal: "#1e293b",
  charcoalLight: "#334155",
  slate: "#64748b",
  green: "#16a34a",
  greenDark: "#15803d",
  greenSoft: "#dcfce7",
  canvas: "#f8fafc",
  surface: "#ffffff",
  line: "#e2e8f0",
  white: "#ffffff",
} as const;

/* ---------------------------------------------------------------------------
 * Web badge classes (Tailwind). Full literal strings so Tailwind v4 detects
 * them during class scanning. Pair with the <Badge> component.
 * ------------------------------------------------------------------------- */
export const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-red-200",
  major: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
  minor: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  trivial: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

/* ---------------------------------------------------------------------------
 * Solid hex colors for exported documents (docx / pdf), where we render filled
 * badges. `bg`/`fg` include the leading '#'; docx callers should strip it.
 * ------------------------------------------------------------------------- */
export interface DocColor {
  bg: string;
  fg: string;
}

export const SEVERITY_DOC: Record<Severity, DocColor> = {
  critical: { bg: "#dc2626", fg: "#ffffff" },
  major: { bg: "#ea580c", fg: "#ffffff" },
  minor: { bg: "#d97706", fg: "#ffffff" },
  trivial: { bg: "#64748b", fg: "#ffffff" },
};

/** Strip a leading '#' - docx expects 6-char hex without it. */
export function hex(color: string): string {
  return color.replace(/^#/, "");
}
