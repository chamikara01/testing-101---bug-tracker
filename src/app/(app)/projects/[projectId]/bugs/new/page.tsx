import { createClient } from "@/lib/supabase/server";
import { fetchProjectStructure } from "@/lib/structure";
import { BugForm } from "@/components/bugs/bug-form";

export default async function NewBugPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { sections, portals } = await fetchProjectStructure(supabase, projectId);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-brand-charcoal">Report a bug</h2>
      <BugForm
        projectId={projectId}
        mode="create"
        sections={sections}
        portals={portals}
      />
    </div>
  );
}
