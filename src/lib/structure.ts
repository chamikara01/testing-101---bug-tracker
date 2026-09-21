import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { StructureOption } from "@/lib/types";

export interface ProjectStructure {
  /** Sections of the project, in display order. Usually non-empty. */
  sections: StructureOption[];
  /** Portals of the project, in display order. Empty for most projects. */
  portals: StructureOption[];
}

/**
 * Load a project's sections and portals for the pickers and filters. Both are
 * optional per project, so either list may come back empty — callers hide the
 * corresponding control in that case.
 */
export async function fetchProjectStructure(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<ProjectStructure> {
  const [{ data: sections }, { data: portals }] = await Promise.all([
    supabase
      .from("project_sections")
      .select("id, name")
      .eq("project_id", projectId)
      .order("position")
      .order("created_at"),
    supabase
      .from("project_portals")
      .select("id, name")
      .eq("project_id", projectId)
      .order("position")
      .order("created_at"),
  ]);

  return { sections: sections ?? [], portals: portals ?? [] };
}

/** Human-readable "Portal · Section" location, or null when neither is set. */
export function formatLocation(
  portalName: string | null,
  sectionName: string | null,
): string | null {
  const parts = [portalName, sectionName].filter(
    (part): part is string => !!part,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
