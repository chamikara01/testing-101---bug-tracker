"use client";

import { useState } from "react";
import { AlertTriangle, Check, FileDown, FileText, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Fmt = "docx" | "pdf";
type Status = "idle" | "loading" | "done" | "error";

interface ExportButtonsProps {
  docxHref: string;
  pdfHref: string;
  context?: string;
}

/**
 * Fetches the export, shows a spinner, then a brief checkmark before the file
 * downloads - a small "report ready" moment instead of a bare link.
 */
export function ExportButtons({
  docxHref,
  pdfHref,
  context = "report",
}: ExportButtonsProps) {
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<Record<Fmt, Status>>({
    docx: "idle",
    pdf: "idle",
  });

  async function download(fmt: Fmt, href: string) {
    if (status[fmt] !== "idle") return;
    setStatus((s) => ({ ...s, [fmt]: "loading" }));
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? `report.${fmt}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus((s) => ({ ...s, [fmt]: "done" }));
      window.setTimeout(
        () => setStatus((s) => ({ ...s, [fmt]: "idle" })),
        1600,
      );
    } catch {
      setStatus((s) => ({ ...s, [fmt]: "error" }));
      window.setTimeout(
        () => setStatus((s) => ({ ...s, [fmt]: "idle" })),
        2600,
      );
    }
  }

  function renderButton(
    fmt: Fmt,
    href: string,
    Icon: typeof FileText,
    label: string,
  ) {
    const st = status[fmt];
    return (
      <button
        type="button"
        onClick={() => download(fmt, href)}
        disabled={st !== "idle"}
        aria-label={`Export ${context} as ${label}`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          st === "done" && "border-brand-green/40 text-brand-green",
          st === "error" && "border-red-300 text-red-600",
        )}
      >
        {st === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : st === "done" ? (
          <motion.span
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            <Check className="h-4 w-4" />
          </motion.span>
        ) : st === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {st === "done" ? "Ready" : st === "error" ? "Failed" : label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {renderButton("docx", docxHref, FileText, "Word")}
      {renderButton("pdf", pdfHref, FileDown, "PDF")}
    </div>
  );
}
