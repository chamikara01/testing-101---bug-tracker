import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchProjectStructure, formatLocation } from "@/lib/structure";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { BugFilters } from "@/components/bugs/bug-filters";
import { ExportButtons } from "@/components/bugs/export-buttons";
import { SeverityBadge, SEVERITY_BAR } from "@/components/bugs/severity-badge";
import { SEVERITIES, type Severity, type StructureOption } from "@/lib/types";

function asOption<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** Only accept an id that actually belongs to this project — a stale or
 *  hand-edited query string must not reach Postgres as a bogus uuid. */
function asStructureId(
  value: string | undefined,
  items: StructureOption[],
): string | undefined {
  return value && items.some((item) => item.id === value) ? value : undefined;
}

export default async function ProjectBugsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ severity?: string; section?: string; portal?: string }>;
}) {
  const { projectId } = await params;
  const filters = await searchParams;
  const severity = asOption<Severity>(filters.severity, SEVERITIES);

  const supabase = await createClient();
  const { sections, portals } = await fetchProjectStructure(supabase, projectId);
  const sectionId = asStructureId(filters.section, sections);
  const portalId = asStructureId(filters.portal, portals);

  let query = supabase
    .from("bugs")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (severity) query = query.eq("severity", severity);
  if (sectionId) query = query.eq("section_id", sectionId);
  if (portalId) query = query.eq("portal_id", portalId);
  const { data: bugs } = await query.order("created_at", { ascending: false });

  // Resolve the last editor's email for each bug (one batched query).
  const bugList = bugs ?? [];
  const editorIds = [
    ...new Set(
      bugList
        .map((b) => b.updated_by)
        .filter((id): id is string => id !== null),
    ),
  ];
  const emailById = new Map<string, string | null>();
  if (editorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", editorIds);
    for (const p of profiles ?? []) emailById.set(p.id, p.email);
  }

  const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));
  const portalNameById = new Map(portals.map((p) => [p.id, p.name]));

  const newBugHref = `/projects/${projectId}/bugs/new`;
  const exportParams = new URLSearchParams();
  if (severity) exportParams.set("severity", severity);
  if (sectionId) exportParams.set("section", sectionId);
  if (portalId) exportParams.set("portal", portalId);
  const exportQuery = exportParams.toString();
  const qs = exportQuery ? `?${exportQuery}` : "";
  const filtered = !!severity || !!sectionId || !!portalId;
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

      <BugFilters sections={sections} portals={portals} />

      {!bugs || bugs.length === 0 ? (
        <EmptyState
          mascot={filtered ? "shrug" : "search"}
          title={filtered ? "No bugs match these filters" : "No bugs yet"}
          description={
            filtered
              ? "Try clearing the filters, or report a new bug."
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
          {bugs.map((bug) => {
            const location = formatLocation(
              bug.portal_id ? (portalNameById.get(bug.portal_id) ?? null) : null,
              bug.section_id ? (sectionNameById.get(bug.section_id) ?? null) : null,
            );
            return (
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
                    {location ? (
                      <>
                        <span className="mx-1.5">·</span>
                        {location}
                      </>
                    ) : null}
                    <span className="mx-1.5">·</span>
                    Updated{" "}
                    {formatDistanceToNow(new Date(bug.updated_at), {
                      addSuffix: true,
                    })}
                    {bug.updated_by && emailById.get(bug.updated_by) ? (
                      <> by {emailById.get(bug.updated_by)}</>
                    ) : null}
                  </p>
                </div>
                <SeverityBadge severity={bug.severity} />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
