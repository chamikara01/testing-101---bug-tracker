import { createClient } from "@/lib/supabase/server";
import { StructureList } from "@/components/projects/structure-list";

export default async function StructurePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: isOwner }, { data: sections }, { data: portals }] =
    await Promise.all([
      supabase.rpc("is_project_owner", { pid: projectId }),
      supabase
        .from("project_sections")
        .select("id, name, position")
        .eq("project_id", projectId)
        .order("position")
        .order("created_at"),
      supabase
        .from("project_portals")
        .select("id, name, position")
        .eq("project_id", projectId)
        .order("position")
        .order("created_at"),
    ]);

  const canEdit = isOwner ?? false;

  return (
    <div className="space-y-6">
      <StructureList
        projectId={projectId}
        table="project_sections"
        items={sections ?? []}
        canEdit={canEdit}
        title="Sections"
        description="The areas of the product this project covers. Testers pick one when filing a bug, and reports are grouped by them."
        addLabel="Section name"
        emptyText={
          canEdit
            ? "No sections yet. Add the areas your testers work through."
            : "No sections yet. A project owner can add them."
        }
        deleteWarning="Bugs filed against it stay, but lose their section."
      />

      <StructureList
        projectId={projectId}
        table="project_portals"
        items={portals ?? []}
        canEdit={canEdit}
        title="Portals"
        description="Only needed when the product ships more than one front end — an admin portal and a customer portal, say. Leave this empty and the field never appears on the bug form."
        addLabel="Portal name"
        emptyText={
          canEdit
            ? "No portals. This project is treated as a single portal."
            : "No portals configured for this project."
        }
        deleteWarning="Bugs filed against it stay, but lose their portal."
      />
    </div>
  );
}
