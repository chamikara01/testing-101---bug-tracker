import { buildSingleBugReport } from "@/lib/export/report-data";
import { buildReportDocx } from "@/lib/export/build-docx";
import { DOCX_MIME, fileResponse, slugify } from "@/lib/export/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bugId: string }> },
) {
  const { bugId } = await params;

  try {
    const data = await buildSingleBugReport(bugId);
    if (!data) return new Response("Not found", { status: 404 });

    const buffer = await buildReportDocx(data);
    const filename = `bug-${slugify(data.bugs[0].bug.title)}.docx`;
    return fileResponse(buffer, DOCX_MIME, filename);
  } catch (err) {
    console.error("Bug DOCX export failed", err);
    return new Response("Export failed", { status: 500 });
  }
}
