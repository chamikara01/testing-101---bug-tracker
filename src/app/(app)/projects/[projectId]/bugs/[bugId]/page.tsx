import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft, Pencil, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signScreenshots } from "@/lib/screenshots";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScreenshotGallery } from "@/components/bugs/screenshot-gallery";
import { ExportButtons } from "@/components/bugs/export-buttons";
import { SeverityBadge } from "@/components/bugs/severity-badge";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm text-brand-charcoal">{children}</dd>
    </div>
  );
}

export default async function BugDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; bugId: string }>;
}) {
  const { projectId, bugId } = await params;
  const supabase = await createClient();

  const { data: bug } = await supabase
    .from("bugs")
    .select("*")
    .eq("id", bugId)
    .maybeSingle();
  if (!bug) notFound();

  const { data: screenshotRows } = await supabase
    .from("bug_screenshots")
    .select("*")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: true });
  const signed = await signScreenshots(supabase, screenshotRows ?? []);

  const { data: reporter } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", bug.reporter_id)
    .maybeSingle();

  const muted = <span className="italic text-brand-slate">Not specified</span>;
  const fieldBox =
    "rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-charcoal";

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-brand-slate transition-colors hover:text-brand-charcoal"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to bugs
      </Link>

      {/* Header: ref + severity, and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-brand-slate">
            #{bug.id.slice(0, 6)}
          </span>
          <SeverityBadge severity={bug.severity} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/projects/${projectId}/bugs/${bug.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <ExportButtons
            docxHref={`/api/bugs/${bug.id}/export/docx`}
            pdfHref={`/api/bugs/${bug.id}/export/pdf`}
            context="bug report"
          />
        </div>
      </div>

      {/* Title & description — boxed, matching the create/edit form */}
      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <div className={`${fieldBox} font-medium`}>{bug.title}</div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <div className={`${fieldBox} min-h-24 whitespace-pre-wrap`}>
              {bug.description || (
                <span className="italic text-brand-slate">
                  No description provided.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps to Reproduce - the hero: a test-script rail */}
      <Card className="overflow-hidden border-brand-blue/30">
        <CardHeader className="border-b-brand-blue/20 bg-brand-blue-soft/40">
          <p className="eyebrow text-brand-blue/80">Steps to Reproduce</p>
        </CardHeader>
        <CardContent>
          {bug.steps_to_reproduce.length > 0 ? (
            <ol className="relative">
              {bug.steps_to_reproduce.map((step, i) => {
                const last = i === bug.steps_to_reproduce.length - 1;
                return (
                  <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                    {!last ? (
                      <span
                        className="absolute bottom-1 left-4 top-9 w-px -translate-x-1/2 bg-brand-blue/25"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue font-mono text-sm font-semibold text-white ring-4 ring-brand-blue-soft">
                      {i + 1}
                    </span>
                    <p className="pt-1.5 text-[15px] leading-relaxed text-brand-charcoal">
                      {step}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm italic text-brand-slate">No steps provided.</p>
          )}
        </CardContent>
      </Card>

      {/* Expected / Actual */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="eyebrow">Expected result</p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-brand-charcoal">
              {bug.expected_result || muted}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="eyebrow">Actual result</p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-brand-charcoal">
              {bug.actual_result || muted}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Screenshots */}
      <Card>
        <CardHeader>
          <p className="eyebrow">Screenshots</p>
        </CardHeader>
        <CardContent>
          {signed.length > 0 ? (
            <ScreenshotGallery screenshots={signed} />
          ) : (
            <p className="text-sm italic text-brand-slate">
              No screenshots attached.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <p className="eyebrow">Environment &amp; details</p>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Field label="URL">
              {bug.url ? (
                <a
                  href={bug.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1 font-mono text-brand-blue hover:underline"
                >
                  <span className="min-w-0 break-all">{bug.url}</span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                </a>
              ) : (
                muted
              )}
            </Field>
            <Field label="Reporter">
              <span className="font-mono">{reporter?.email ?? "-"}</span>
            </Field>
            <Field label="Browser">
              {bug.browser ? (
                <span className="font-mono">{bug.browser}</span>
              ) : (
                muted
              )}
            </Field>
            <Field label="OS">
              {bug.os ? <span className="font-mono">{bug.os}</span> : muted}
            </Field>
            <Field label="Created">
              <span className="font-mono">
                {format(new Date(bug.created_at), "PPp")}
              </span>
            </Field>
            <Field label="Updated">
              <span className="font-mono">
                {format(new Date(bug.updated_at), "PPp")}
              </span>
            </Field>
          </dl>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <p className="eyebrow">Notes</p>
        </CardHeader>
        <CardContent>
          {bug.notes ? (
            <p className="whitespace-pre-wrap text-sm text-brand-charcoal">
              {bug.notes}
            </p>
          ) : (
            <p className="text-sm italic text-brand-slate">No notes provided.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
