import { buildProjectReport } from "@/lib/export/report-data";
import { buildReportPdf } from "@/lib/export/build-pdf";
import { PDF_MIME, fileResponse, slugify } from "@/lib/export/http";
import { SEVERITIES, type Severity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const severity = parseSeverity(new URL(req.url).searchParams.get("severity"));

  const data = await buildProjectReport(projectId, { severity });
  if (!data) return new Response("Not found", { status: 404 });

  const buffer = await buildReportPdf(data);
  return fileResponse(buffer, PDF_MIME, `${slugify(data.title)}.pdf`);
}
