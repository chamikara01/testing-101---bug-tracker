import { buildSingleBugReport } from "@/lib/export/report-data";
import { buildReportPdf } from "@/lib/export/build-pdf";
import { PDF_MIME, fileResponse, slugify } from "@/lib/export/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bugId: string }> },
) {
  const { bugId } = await params;

  const data = await buildSingleBugReport(bugId);
  if (!data) return new Response("Not found", { status: 404 });

  const buffer = await buildReportPdf(data);
  const filename = `bug-${slugify(data.bugs[0].bug.title)}.pdf`;
  return fileResponse(buffer, PDF_MIME, filename);
}
