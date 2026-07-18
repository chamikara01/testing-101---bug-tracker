import { imageSize } from "image-size";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SCREENSHOT_BUCKET } from "@/lib/types";
import type { Bug, Severity } from "@/lib/types";
import type { Database } from "@/lib/database.types";

/** Image formats we can embed in both docx and pdf. */
export type ExportImageExt = "png" | "jpg" | "gif" | "bmp";

export interface ExportScreenshot {
  caption: string | null;
  data: Uint8Array;
  contentType: string;
  width: number;
  height: number;
  ext: ExportImageExt;
}

export interface ReportBug {
  bug: Bug;
  reporterEmail: string | null;
  screenshots: ExportScreenshot[];
}

/** Everything the docx/pdf builders need to render a report (1..N bugs). */
export interface ReportData {
  title: string;
  version: string;
  date: string;
  preparedBy: string | null;
  summary: string;
  bugs: ReportBug[];
}

type DB = SupabaseClient<Database>;

function mapImageType(type: string | undefined): {
  ext: ExportImageExt;
  contentType: string;
} {
  switch (type) {
    case "jpg":
    case "jpeg":
      return { ext: "jpg", contentType: "image/jpeg" };
    case "gif":
      return { ext: "gif", contentType: "image/gif" };
    case "bmp":
      return { ext: "bmp", contentType: "image/bmp" };
    case "png":
    default:
      return { ext: "png", contentType: "image/png" };
  }
}

async function fetchScreenshots(
  supabase: DB,
  bugId: string,
): Promise<ExportScreenshot[]> {
  const { data: rows } = await supabase
    .from("bug_screenshots")
    .select("*")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: true });

  const out: ExportScreenshot[] = [];
  for (const row of rows ?? []) {
    const { data: file } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .download(row.storage_path);
    if (!file) continue;

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      continue;
    }

    let dimensions: { width?: number; height?: number; type?: string };
    try {
      dimensions = imageSize(bytes);
    } catch {
      continue;
    }
    if (!dimensions.width || !dimensions.height) continue;

    const { ext, contentType } = mapImageType(dimensions.type);
    out.push({
      caption: row.caption,
      data: bytes,
      contentType,
      width: dimensions.width,
      height: dimensions.height,
      ext,
    });
  }
  return out;
}

function today(): string {
  return format(new Date(), "d MMMM yyyy");
}

/**
 * A report for a single bug. Returns null if the bug is missing / not visible
 * under RLS. Throws if there is no authenticated user.
 */
export async function buildSingleBugReport(
  bugId: string,
): Promise<ReportData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: bug } = await supabase
    .from("bugs")
    .select("*")
    .eq("id", bugId)
    .maybeSingle();
  if (!bug) return null;

  const [{ data: project }, { data: reporter }, screenshots] =
    await Promise.all([
      supabase.from("projects").select("name").eq("id", bug.project_id).maybeSingle(),
      supabase.from("profiles").select("email").eq("id", bug.reporter_id).maybeSingle(),
      fetchScreenshots(supabase, bug.id),
    ]);

  const projectName = project?.name ?? "Untitled project";
  return {
    title: `${projectName} - Bug Report`,
    version: "1",
    date: today(),
    preparedBy: user.email ?? null,
    summary: `This report documents the issue “${bug.title}” identified in ${projectName}. Full details, reproduction steps, and expected vs. actual behaviour are provided below.`,
    bugs: [{ bug, reporterEmail: reporter?.email ?? null, screenshots }],
  };
}

/**
 * A report for a whole project (optionally filtered by severity). Returns null
 * if the project is missing / not visible under RLS. Throws if unauthenticated.
 */
export async function buildProjectReport(
  projectId: string,
  opts: { severity?: Severity } = {},
): Promise<ReportData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  let query = supabase
    .from("bugs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (opts.severity) query = query.eq("severity", opts.severity);
  const { data: bugRows } = await query;
  const bugs = bugRows ?? [];

  const reporterIds = [...new Set(bugs.map((b) => b.reporter_id))];
  const emailById = new Map<string, string | null>();
  if (reporterIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", reporterIds);
    for (const p of profs ?? []) emailById.set(p.id, p.email);
  }

  const reportBugs: ReportBug[] = [];
  for (const bug of bugs) {
    const screenshots = await fetchScreenshots(supabase, bug.id);
    reportBugs.push({
      bug,
      reporterEmail: emailById.get(bug.reporter_id) ?? null,
      screenshots,
    });
  }

  const projectName = project.name ?? "Untitled project";
  const n = reportBugs.length;
  const scope = opts.severity ? ` (${opts.severity} severity)` : "";
  return {
    title: `${projectName} - Bug Report`,
    version: "1",
    date: today(),
    preparedBy: user.email ?? null,
    summary: `This report documents ${n} issue${n === 1 ? "" : "s"}${scope} identified in ${projectName}. Details, reproduction steps, and expected vs. actual behaviour are provided below for each issue.`,
    bugs: reportBugs,
  };
}
