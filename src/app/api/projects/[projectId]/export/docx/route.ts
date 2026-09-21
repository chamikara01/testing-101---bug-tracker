import { buildProjectReport } from "@/lib/export/report-data";
import { buildReportDocx } from "@/lib/export/build-docx";
import {
  DOCX_MIME,
  fileResponse,
  parseUuid,
  slugify,
} from "@/lib/export/http";
import { SEVERITIES, type Severity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseSeverity(value: string | null): Severity | undefined {
  return value && (SEVERITIES as string[]).includes(value)
    ? (value as Severity)
    : undefined;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const search = new URL(req.url).searchParams;
  const severity = parseSeverity(search.get("severity"));
  const sectionId = parseUuid(search.get("section"));
  const portalId = parseUuid(search.get("portal"));

  try {
    const data = await buildProjectReport(projectId, {
      severity,
      sectionId,
      portalId,
    });
    if (!data) return new Response("Not found", { status: 404 });

    const buffer = await buildReportDocx(data);
    return fileResponse(buffer, DOCX_MIME, `${slugify(data.title)}.docx`);
  } catch (err) {
    console.error("Project DOCX export failed", err);
    return new Response("Export failed", { status: 500 });
  }
}
