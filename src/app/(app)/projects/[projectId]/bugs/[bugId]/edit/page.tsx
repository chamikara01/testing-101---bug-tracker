import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signScreenshots } from "@/lib/screenshots";
import { fetchProjectStructure } from "@/lib/structure";
import { BugForm } from "@/components/bugs/bug-form";

export default async function EditBugPage({
  params,
}: {
  params: Promise<{ projectId: string; bugId: string }>;
}) {
  const { projectId, bugId } = await params;
  const supabase = await createClient();

  const { data: bug } = await supabase
    .from("bugs")
    .select("*")
    .eq("id", bugId)
    .maybeSingle();

  if (!bug) notFound();

  const { data: screenshots } = await supabase
    .from("bug_screenshots")
    .select("*")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: true });

  const signed = await signScreenshots(supabase, screenshots ?? []);
  const { sections, portals } = await fetchProjectStructure(supabase, projectId);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-brand-charcoal">Edit bug</h2>
      <BugForm
        projectId={projectId}
        mode="edit"
        bug={bug}
        screenshots={signed}
        sections={sections}
        portals={portals}
      />
    </div>
  );
}
