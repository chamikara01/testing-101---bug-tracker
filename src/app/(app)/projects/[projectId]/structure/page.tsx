import { createClient } from "@/lib/supabase/server";
import { StructureList } from "@/components/projects/structure-list";

export default async function StructurePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const [{ data: isOwner }, { data: portalRows }, { data: sectionRows }] =
    await Promise.all([
      supabase.rpc("is_project_owner", { pid: projectId }),
      supabase
        .from("project_portals")
        .select("id, name, position")
        .eq("project_id", projectId)
        .order("position")
        .order("created_at"),
      supabase
        .from("project_sections")
        .select("id, name, position, portal_id")
        .eq("project_id", projectId)
        .order("position")
        .order("created_at"),
    ]);

  const canEdit = isOwner ?? false;
  const portals = portalRows ?? [];
  const sections = sectionRows ?? [];
  // Every project has a portal (the database guarantees it), so more than one
  // is the signal that this project actually uses portals.
  const multiPortal = portals.length > 1;

  const portalsCard = (
    <StructureList
      projectId={projectId}
      table="project_portals"
      items={portals}
      canEdit={canEdit}
      allowDelete={multiPortal}
      title="Portals"
      description={
        multiPortal
          ? "The separate front ends of this product. Each keeps its own list of sections, so two portals can use the same section name without it being the same section."
          : "Only needed when the product ships more than one front end, an admin portal and a customer portal, say. Add a second and each portal gets its own sections."
      }
      addLabel="Portal name"
      emptyText="No portals."
      deleteWarning="Its sections go with it, and bugs filed against them lose their location."
    />
  );

  const sectionCards = portals.map((portal) => (
    <StructureList
      key={portal.id}
      projectId={projectId}
      table="project_sections"
      portalId={portal.id}
      items={sections.filter((section) => section.portal_id === portal.id)}
      canEdit={canEdit}
      title={multiPortal ? `Sections - ${portal.name}` : "Sections"}
      description={
        multiPortal
          ? `The areas of the ${portal.name} portal. Testers pick one when filing a bug against it.`
          : "The areas of the product this project covers. Testers pick one when filing a bug, and reports are grouped by them."
      }
      addLabel="Section name"
      emptyText={
        canEdit
          ? "No sections yet. Add the areas your testers work through."
          : "No sections yet. A project owner can add them."
      }
      deleteWarning="Bugs filed against it stay, but lose their section."
    />
  ));

  // With one portal the portal level is noise, so sections lead and the portal
  // card sits underneath as the way to opt in to more.
  return (
    <div className="space-y-6">
      {multiPortal ? (
        <>
          {portalsCard}
          {sectionCards}
        </>
      ) : (
        <>
          {sectionCards}
          {portalsCard}
        </>
      )}
    </div>
  );
}
