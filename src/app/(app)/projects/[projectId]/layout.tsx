import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabs } from "@/components/project-tabs";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  // RLS: returns a row only if the current user is a member of this project.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  // Count of bugs currently in the recycle bin, for the tab badge.
  const { count: trashCount } = await supabase
    .from("bugs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .not("deleted_at", "is", null);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-brand-slate hover:text-brand-charcoal"
        >
          <ChevronLeft className="h-4 w-4" />
          All projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-charcoal">
          {project.name}
        </h1>
        {project.description ? (
          <p className="mt-1 max-w-2xl text-sm text-brand-slate">
            {project.description}
          </p>
        ) : null}
      </div>
      <ProjectTabs projectId={projectId} trashCount={trashCount ?? 0} />
      <div>{children}</div>
    </div>
  );
}
