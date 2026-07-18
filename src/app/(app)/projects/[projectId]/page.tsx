import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { BugFilters } from "@/components/bugs/bug-filters";
import { ExportButtons } from "@/components/bugs/export-buttons";
import { SeverityBadge, SEVERITY_BAR } from "@/components/bugs/severity-badge";
import { SEVERITIES, type Severity } from "@/lib/types";

function asOption<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export default async function ProjectBugsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ severity?: string }>;
}) {
  const { projectId } = await params;
  const filters = await searchParams;
  const severity = asOption<Severity>(filters.severity, SEVERITIES);

  const supabase = await createClient();

  let query = supabase.from("bugs").select("*").eq("project_id", projectId);
  if (severity) query = query.eq("severity", severity);
  const { data: bugs } = await query.order("created_at", { ascending: false });

  const newBugHref = `/projects/${projectId}/bugs/new`;
  const qs = severity ? `?severity=${severity}` : "";
  const count = bugs?.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Issues</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-brand-charcoal">
            Bugs{" "}
            <span className="font-sans text-sm font-normal text-brand-slate">
              ({count})
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            docxHref={`/api/projects/${projectId}/export/docx${qs}`}
            pdfHref={`/api/projects/${projectId}/export/pdf${qs}`}
            context="project report"
          />
          <Link href={newBugHref} className={buttonVariants({ variant: "primary" })}>
            <Plus className="h-4 w-4" />
            New bug
          </Link>
        </div>
      </div>

      <BugFilters />

      {!bugs || bugs.length === 0 ? (
        <EmptyState
          mascot={severity ? "shrug" : "search"}
          title={severity ? "No bugs match this filter" : "No bugs yet"}
          description={
            severity
              ? "Try clearing the severity filter, or report a new bug."
              : "Nothing to hunt down here yet. Report the first bug to start tracking."
          }
          action={
            <Link
              href={newBugHref}
              className={buttonVariants({ variant: "primary" })}
            >
              <Plus className="h-4 w-4" />
              New bug
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden p-0">
          {bugs.map((bug) => (
            <Link
              key={bug.id}
              href={`/projects/${projectId}/bugs/${bug.id}`}
              className="group relative flex items-center gap-4 py-3.5 pl-5 pr-4 transition-colors hover:bg-surface-2"
            >
              <span
                className={`absolute left-0 top-0 h-full w-1 ${SEVERITY_BAR[bug.severity]}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-brand-charcoal transition-colors group-hover:text-brand-blue">
                  {bug.title}
                </p>
                <p className="mt-0.5 text-xs text-brand-slate">
                  <span className="font-mono">#{bug.id.slice(0, 6)}</span>
                  <span className="mx-1.5">·</span>
                  Updated{" "}
                  {formatDistanceToNow(new Date(bug.updated_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <SeverityBadge severity={bug.severity} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
