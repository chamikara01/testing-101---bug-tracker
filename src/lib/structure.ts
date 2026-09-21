import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SectionOption, StructureOption } from "@/lib/types";

export interface ProjectStructure {
  /**
   * Portals of the project, in display order. Always at least one: the
   * database creates a "Main" portal with every project so sections have a
   * parent. A project with exactly one portal is a project that does not use
   * portals, and the UI hides the level entirely in that case.
   */
  portals: StructureOption[];
  /** Sections across all portals, in display order, each tagged with its portal. */
  sections: SectionOption[];
}

/** Load a project's portals and their sections for the pickers and filters. */
export async function fetchProjectStructure(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectStructure> {
  const [{ data: portals }, { data: sections }] = await Promise.all([
    supabase
      .from("project_portals")
      .select("id, name")
      .eq("project_id", projectId)
      .order("position")
      .order("created_at"),
    supabase
      .from("project_sections")
      .select("id, name, portal_id")
      .eq("project_id", projectId)
      .order("position")
      .order("created_at"),
  ]);

  return { portals: portals ?? [], sections: sections ?? [] };
}

/** True once a project actually uses portals, i.e. has more than the one the
 *  database created for it. Every portal-facing control keys off this. */
export function usesPortals(portals: StructureOption[]): boolean {
  return portals.length > 1;
}

/** Sections of one portal, in order. */
export function sectionsOf(
  sections: SectionOption[],
  portalId: string | null,
): SectionOption[] {
  if (!portalId) return [];
  return sections.filter((section) => section.portal_id === portalId);
}

/**
 * Human-readable location for a bug: "Portal · Section", dropping the portal
 * for projects that do not use them, and null when there is nothing to show.
 */
export function formatLocation(
  portalName: string | null,
  sectionName: string | null,
): string | null {
  const parts = [portalName, sectionName].filter(
    (part): part is string => !!part,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
