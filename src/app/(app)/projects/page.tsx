import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PendingInvitations } from "@/components/invitations/pending-invitations";
import type { Project } from "@/lib/types";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projectsData } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const projects: Project[] = projectsData ?? [];

  const { data: bugsData } = await supabase.from("bugs").select("project_id");
  const { data: invitesData } = await supabase.rpc("my_invitations");
  const invitations = invitesData ?? [];

  const bugCounts = new Map<string, number>();
  for (const bug of bugsData ?? []) {
    bugCounts.set(bug.project_id, (bugCounts.get(bug.project_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-charcoal">
            Projects
          </h1>
        </div>
        <Link href="/projects/new" className={buttonVariants({ variant: "primary" })}>
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      <PendingInvitations invites={invitations} />

      {projects.length === 0 ? (
        <EmptyState
          mascot="clipboard"
          title="No projects yet"
          description="Create your first project to start tracking bugs and inviting your QA team."
          action={
            <Link href="/projects/new" className={buttonVariants({ variant: "primary" })}>
              <Plus className="h-4 w-4" />
              New project
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const bugCount = bugCounts.get(project.id) ?? 0;
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="group block">
                <Card className="flex h-full flex-col transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-brand-blue/50 group-hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3">
                    <h2 className="font-display text-base font-semibold text-brand-charcoal transition-colors group-hover:text-brand-blue">
                      {project.name}
                    </h2>
                    {project.description ? (
                      <p className="line-clamp-2 text-sm text-brand-slate">
                        {project.description}
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-400">No description</p>
                    )}
                    <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                      <span className="font-mono text-xs text-brand-slate">
                        {bugCount} {bugCount === 1 ? "bug" : "bugs"}
                      </span>
                      <span className="font-mono text-xs text-brand-slate">
                        {format(new Date(project.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
