export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_MIME = "application/pdf";

/** Safe, lowercase filename slug (used in Content-Disposition). */
export function slugify(text: string, fallback = "bug-report"): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept a query-string id only if it is a well-formed uuid, so a hand-edited
 *  URL becomes "no filter" instead of a Postgres type error. */
export function parseUuid(value: string | null): string | undefined {
  return value && UUID_RE.test(value) ? value : undefined;
}

/** Build a downloadable file response from a Node Buffer. */
export function fileResponse(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Response {
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
