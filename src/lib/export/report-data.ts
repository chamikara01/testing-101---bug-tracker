import sharp from "sharp";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fetchProjectStructure } from "@/lib/structure";
import { SCREENSHOT_BUCKET } from "@/lib/types";
import type { Bug, Severity } from "@/lib/types";
import type { Database } from "@/lib/database.types";

/** Image formats we embed in both docx and pdf after normalisation. */
export type ExportImageExt = "png" | "jpg";

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
  /** Resolved names for bug.portal_id / bug.section_id; null when unset. */
  portalName: string | null;
  sectionName: string | null;
  screenshots: ExportScreenshot[];
}

/** Everything the docx/pdf builders need to render a report (1..N bugs). */
export interface ReportData {
  title: string;
  date: string;
  summary: string;
  bugs: ReportBug[];
}

type DB = SupabaseClient<Database>;
type ScreenshotRow = Database["public"]["Tables"]["bug_screenshots"]["Row"];

/** Max screenshot files downloaded/processed concurrently. Keeps large reports
 *  fast without opening an unbounded number of sockets to storage at once. */
const SCREENSHOT_CONCURRENCY = 8;

/** Screenshots are downscaled to fit this box before embedding. The document
 *  only ever displays them a few hundred points wide, so full-resolution phone
 *  or 4K captures just bloat the file and can stall the PDF renderer. */
const MAX_EMBED_WIDTH = 1200;
const MAX_EMBED_HEIGHT = 2400;

/** Run `fn` over `items` with at most `limit` running at once, preserving the
 *  input order in the returned array. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

/** Download one screenshot, then downscale + re-encode it with sharp. This both
 *  shrinks large captures (speed / file size) and normalises the bytes into a
 *  clean PNG/JPEG the renderers can always decode. Null on any failure so one
 *  bad image never aborts the whole report. */
async function downloadScreenshot(
  supabase: DB,
  row: ScreenshotRow,
): Promise<ExportScreenshot | null> {
  const { data: file } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .download(row.storage_path);
  if (!file) return null;

  try {
    const input = Buffer.from(await file.arrayBuffer());
    // Normalise to a baseline JPEG: bake EXIF orientation (.rotate()),
    // downscale, flatten any alpha onto white, strip metadata. Baseline JPEG
    // is the format the PDF renderer decodes most reliably - EXIF-rotated
    // captures and odd PNGs (16-bit, interlaced, palette/alpha) otherwise make
    // it compute a broken image scale and throw "unsupported number".
    const { data, info } = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_EMBED_WIDTH,
        height: MAX_EMBED_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, progressive: false })
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) return null;

    return {
      caption: row.caption,
      data,
      contentType: "image/jpeg",
      width: info.width,
      height: info.height,
      ext: "jpg",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch every screenshot for the given bugs, grouped by bug id. One query pulls
 * all the rows, then the files download + process in parallel (bounded) rather
 * than bug-by-bug and file-by-file - the dominant cost for reports with many
 * bugs.
 */
async function fetchScreenshotsByBug(
  supabase: DB,
  bugIds: string[],
): Promise<Map<string, ExportScreenshot[]>> {
  const byBug = new Map<string, ExportScreenshot[]>();
  if (bugIds.length === 0) return byBug;

  const { data: rows } = await supabase
    .from("bug_screenshots")
    .select("*")
    .in("bug_id", bugIds)
    .order("created_at", { ascending: true });

  const rowList = rows ?? [];
  const shots = await mapLimit(rowList, SCREENSHOT_CONCURRENCY, (row) =>
    downloadScreenshot(supabase, row),
  );

  rowList.forEach((row, i) => {
    const shot = shots[i];
    if (!shot) return;
    const list = byBug.get(row.bug_id);
    if (list) list.push(shot);
    else byBug.set(row.bug_id, [shot]);
  });
  return byBug;
}

/** Look up a portal/section name by id within one project's structure. */
function nameOf(
  items: { id: string; name: string }[],
  id: string | null,
): string | null {
  if (!id) return null;
  return items.find((item) => item.id === id)?.name ?? null;
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

  const [{ data: project }, { data: reporter }, screenshotsByBug, structure] =
    await Promise.all([
      supabase.from("projects").select("name").eq("id", bug.project_id).maybeSingle(),
      supabase.from("profiles").select("email").eq("id", bug.reporter_id).maybeSingle(),
      fetchScreenshotsByBug(supabase, [bug.id]),
      fetchProjectStructure(supabase, bug.project_id),
    ]);

  const projectName = project?.name ?? "Untitled project";
  return {
    title: `${projectName} - Bug Report`,
    date: today(),
    summary: `This report documents the issue “${bug.title}” identified in ${projectName}. Full details, reproduction steps, and expected vs. actual behaviour are provided below.`,
    bugs: [
      {
        bug,
        reporterEmail: reporter?.email ?? null,
        portalName:
          structure.portals.length > 1
            ? nameOf(structure.portals, bug.portal_id)
            : null,
        sectionName: nameOf(structure.sections, bug.section_id),
        screenshots: screenshotsByBug.get(bug.id) ?? [],
      },
    ],
  };
}

/**
 * A report for a whole project (optionally filtered by severity). Returns null
 * if the project is missing / not visible under RLS. Throws if unauthenticated.
 */
export async function buildProjectReport(
  projectId: string,
  opts: { severity?: Severity; sectionId?: string; portalId?: string } = {},
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
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (opts.severity) query = query.eq("severity", opts.severity);
  if (opts.sectionId) query = query.eq("section_id", opts.sectionId);
  if (opts.portalId) query = query.eq("portal_id", opts.portalId);
  const { data: bugRows } = await query;
  const bugs = bugRows ?? [];

  // Report order follows the project's own portal, then section order, with
  // unassigned bugs last. Sort is stable, so bugs keep their created_at order
  // within a section.
  const structure = await fetchProjectStructure(supabase, projectId);
  const portalRank = new Map(structure.portals.map((p, i) => [p.id, i]));
  const sectionRank = new Map(structure.sections.map((s, i) => [s.id, i]));
  const rankOf = (bug: Bug, ranks: Map<string, number>, id: string | null) =>
    id ? (ranks.get(id) ?? Infinity) : Infinity;
  bugs.sort(
    (a, b) =>
      rankOf(a, portalRank, a.portal_id) - rankOf(b, portalRank, b.portal_id) ||
      rankOf(a, sectionRank, a.section_id) -
        rankOf(b, sectionRank, b.section_id),
  );

  // A project with one portal does not use portals; naming it in the report
  // would only add noise.
  const showPortal = structure.portals.length > 1;

  const reporterIds = [...new Set(bugs.map((b) => b.reporter_id))];
  const emailById = new Map<string, string | null>();

  // Resolve reporter emails and download all screenshots concurrently.
  const [screenshotsByBug] = await Promise.all([
    fetchScreenshotsByBug(
      supabase,
      bugs.map((b) => b.id),
    ),
    (async () => {
      if (reporterIds.length === 0) return;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", reporterIds);
      for (const p of profs ?? []) emailById.set(p.id, p.email);
    })(),
  ]);

  const reportBugs: ReportBug[] = bugs.map((bug) => ({
    bug,
    reporterEmail: emailById.get(bug.reporter_id) ?? null,
    portalName: showPortal ? nameOf(structure.portals, bug.portal_id) : null,
    sectionName: nameOf(structure.sections, bug.section_id),
    screenshots: screenshotsByBug.get(bug.id) ?? [],
  }));

  const projectName = project.name ?? "Untitled project";
  const n = reportBugs.length;
  const scopeParts = [
    opts.severity && `${opts.severity} severity`,
    opts.sectionId && `section ${nameOf(structure.sections, opts.sectionId) ?? "?"}`,
    opts.portalId && `portal ${nameOf(structure.portals, opts.portalId) ?? "?"}`,
  ].filter(Boolean);
  const scope = scopeParts.length > 0 ? ` (${scopeParts.join(", ")})` : "";

  return {
    title: `${projectName} - Bug Report`,
    date: today(),
    summary: `This report documents ${n} issue${n === 1 ? "" : "s"}${scope} identified in ${projectName}. Details, reproduction steps, and expected vs. actual behaviour are provided below for each issue.`,
    bugs: reportBugs,
  };
}
