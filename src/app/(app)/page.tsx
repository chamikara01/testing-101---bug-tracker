import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PendingInvitations } from "@/components/invitations/pending-invitations";
import { SeverityBadge } from "@/components/bugs/severity-badge";
import { SEVERITIES, type Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

type DashboardBug = {
  id: string;
  title: string;
  severity: Severity;
  project_id: string;
  updated_at: string;
};

const SEVERITY_ACCENT: Record<Severity, { ring: string; text: string }> = {
  critical: { ring: "ring-red-200", text: "text-[#B0504F]" },
  major: { ring: "ring-orange-200", text: "text-[#B06A3C]" },
  minor: { ring: "ring-amber-200", text: "text-[#9C7C3A]" },
  trivial: { ring: "ring-slate-200", text: "text-[#6B7280]" },
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: bugsData }, { data: projectsData }, { data: invitesData }] =
    await Promise.all([
      supabase
        .from("bugs")
        .select("id,title,severity,project_id,updated_at")
        .order("updated_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.rpc("my_invitations"),
    ]);

  const bugs: DashboardBug[] = bugsData ?? [];
  const projects = projectsData ?? [];
  const invitations = invitesData ?? [];

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-charcoal">
            Dashboard
          </h1>
        </div>
        <PendingInvitations invites={invitations} />
        <EmptyState
          mascot="point"
          title="Welcome to Testing 101"
          description="Create your first project to start tracking bugs across your team."
          action={
            <Link href="/projects/new" className={buttonVariants({ variant: "primary" })}>
              Create a project
            </Link>
          }
        />
      </div>
    );
  }

  const countBySeverity: Record<Severity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    trivial: 0,
  };
  for (const bug of bugs) countBySeverity[bug.severity] += 1;

  const countByProject = new Map<string, number>();
  for (const bug of bugs) {
    countByProject.set(
      bug.project_id,
      (countByProject.get(bug.project_id) ?? 0) + 1,
    );
  }

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const recentBugs = bugs.slice(0, 8);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-charcoal">
            Dashboard
          </h1>
        </div>
        <p className="text-sm text-brand-slate">
          <span className="font-mono font-semibold text-brand-charcoal">
            {bugs.length}
          </span>{" "}
          {bugs.length === 1 ? "bug" : "bugs"} across{" "}
          <span className="font-mono font-semibold text-brand-charcoal">
            {projects.length}
          </span>{" "}
          {projects.length === 1 ? "project" : "projects"}
        </p>
      </div>

      <PendingInvitations invites={invitations} />

      {/* Bugs by severity */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SEVERITIES.map((severity) => {
          const accent = SEVERITY_ACCENT[severity];
          return (
            <Card key={severity} className={cn("ring-1 ring-inset", accent.ring)}>
              <CardContent className="flex flex-col gap-3">
                <SeverityBadge severity={severity} />
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-display text-3xl font-bold tabular-nums",
                      accent.text,
                    )}
                  >
                    {countBySeverity[severity]}
                  </span>
                  <span className="text-xs text-brand-slate">
                    {countBySeverity[severity] === 1 ? "bug" : "bugs"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Projects */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-charcoal">
            Projects
          </h2>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-brand-blue hover:text-brand-blue-dark"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const count = countByProject.get(project.id) ?? 0;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group block rounded-xl border border-line bg-surface p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-blue/50 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-display font-semibold text-brand-charcoal group-hover:text-brand-blue">
                    {project.name}
                  </span>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-brand-slate transition-colors group-hover:text-brand-blue"
                  />
                </div>
                <p className="mt-2 font-mono text-xs text-brand-slate">
                  {count} {count === 1 ? "bug" : "bugs"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recently updated bugs */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-brand-charcoal">
          Recently updated
        </h2>
        {recentBugs.length === 0 ? (
          <EmptyState
            mascot="thumbsup"
            title="All clear"
            description="No bugs logged yet. Nice and quiet."
          />
        ) : (
          <Card className="divide-y divide-line p-0">
            {recentBugs.map((bug) => (
              <Link
                key={bug.id}
                href={`/projects/${bug.project_id}/bugs/${bug.id}`}
                className="flex flex-col gap-1.5 px-5 py-3.5 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-brand-charcoal">
                  {bug.title}
                </span>
                <span className="flex items-center gap-3">
                  <span className="truncate font-mono text-xs text-brand-slate">
                    {projectName.get(bug.project_id) ?? "Unknown"}
                  </span>
                  <SeverityBadge severity={bug.severity} />
                  <span className="ml-auto shrink-0 font-mono text-xs text-brand-slate sm:ml-0 sm:w-16 sm:text-right">
                    {format(new Date(bug.updated_at), "MMM d")}
                  </span>
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
