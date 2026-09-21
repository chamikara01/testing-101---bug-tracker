"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SEVERITIES,
  SEVERITY_LABELS,
  SCREENSHOT_BUCKET,
  type Bug,
  type BugScreenshot,
  type Severity,
  type SectionOption,
  type StructureOption,
} from "@/lib/types";

type Signed = BugScreenshot & { url: string | null };

interface PendingFile {
  id: string;
  file: File;
  caption: string;
  previewUrl: string;
}

interface Step {
  id: string;
  text: string;
}

interface BugFormProps {
  projectId: string;
  mode: "create" | "edit";
  bug?: Bug;
  screenshots?: Signed[];
  /** Sections across the project's portals, in display order. */
  sections?: SectionOption[];
  /** Portals of the project, in display order. One = the project does not use
   *  portals and the picker stays hidden. */
  portals?: StructureOption[];
}

function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_");
}

function nullify(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function BugForm({
  projectId,
  mode,
  bug,
  screenshots,
  sections = [],
  portals = [],
}: BugFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const reduce = useReducedMotion();

  const [title, setTitle] = useState(bug?.title ?? "");
  const [steps, setSteps] = useState<Step[]>(() =>
    bug && bug.steps_to_reproduce.length > 0
      ? bug.steps_to_reproduce.map((text) => ({ id: crypto.randomUUID(), text }))
      : [{ id: crypto.randomUUID(), text: "" }],
  );
  const [description, setDescription] = useState(bug?.description ?? "");
  const [expected, setExpected] = useState(bug?.expected_result ?? "");
  const [actual, setActual] = useState(bug?.actual_result ?? "");
  const [url, setUrl] = useState(bug?.url ?? "");
  const [severity, setSeverity] = useState<Severity>(bug?.severity ?? "major");
  // With a single portal there is nothing to choose: it is implied, so the bug
  // still records it and the picker never appears.
  const [portalId, setPortalId] = useState(
    bug?.portal_id ?? (portals.length === 1 ? portals[0].id : ""),
  );
  const [sectionId, setSectionId] = useState(bug?.section_id ?? "");

  const showPortalPicker = portals.length > 1;
  const portalSections = portalId
    ? sections.filter((section) => section.portal_id === portalId)
    : [];

  // Sections belong to one portal, so switching portal invalidates the choice.
  const changePortal = (value: string) => {
    setPortalId(value);
    setSectionId("");
  };
  const [browser, setBrowser] = useState(bug?.browser ?? "");
  const [os, setOs] = useState(bug?.os ?? "");
  const [notes, setNotes] = useState(bug?.notes ?? "");

  const [existing, setExisting] = useState<Signed[]>(screenshots ?? []);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingFile[]>([]);
  // In create mode, remember the bug row once it is inserted so a retry after a
  // mid-submit failure updates that bug instead of creating a duplicate.
  const [createdBugId, setCreatedBugId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest pending list so the unmount cleanup can revoke every
  // object URL without re-subscribing the effect on each change.
  const pendingRef = useRef<PendingFile[]>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Revoke any outstanding object URLs on unmount.
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  // --- Steps handlers ---
  const updateStep = (id: string, value: string) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text: value } : s)));

  const addStep = () =>
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), text: "" }]);

  const removeStep = (id: string) =>
    setSteps((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.length > 0 ? next : [{ id: crypto.randomUUID(), text: "" }];
    });

  const moveStep = (index: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // --- Screenshot handlers ---
  const onFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const added: PendingFile[] = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        caption: "",
        previewUrl: URL.createObjectURL(file),
      }));
      setPending((prev) => [...prev, ...added]);
    },
    [],
  );

  const removePending = (id: string) =>
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });

  const updatePendingCaption = (id: string, caption: string) =>
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p)),
    );

  const removeExisting = (id: string) => {
    setExisting((prev) => prev.filter((s) => s.id !== id));
    setRemovedIds((prev) => [...prev, id]);
  };

  async function uploadPending(bugId: string): Promise<void> {
    // Iterate a snapshot and drop each item from `pending` once it has been
    // fully persisted, so a retry after a mid-way failure neither re-uploads
    // completed items nor creates duplicates.
    const items = [...pending];
    for (const item of items) {
      const key = `${bugId}/${crypto.randomUUID()}-${sanitize(item.file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .upload(key, item.file);
      if (uploadError) {
        throw new Error(`Failed to upload ${item.file.name}: ${uploadError.message}`);
      }
      const caption = nullify(item.caption);
      const { error: insertError } = await supabase
        .from("bug_screenshots")
        .insert({ bug_id: bugId, storage_path: key, caption });
      if (insertError) {
        // Compensate so the just-uploaded object isn't orphaned in Storage.
        await supabase.storage.from(SCREENSHOT_BUCKET).remove([key]);
        throw new Error(insertError.message);
      }
      // Persisted: release the preview and remove from the pending queue.
      URL.revokeObjectURL(item.previewUrl);
      setPending((prev) => prev.filter((p) => p.id !== item.id));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    try {
      const cleanedSteps = steps
        .map((s) => s.text.trim())
        .filter((s) => s !== "");
      const fields = {
        title: title.trim(),
        description: nullify(description),
        steps_to_reproduce: cleanedSteps,
        expected_result: nullify(expected),
        actual_result: nullify(actual),
        url: nullify(url),
        severity,
        section_id: sectionId || null,
        portal_id: portalId || null,
        browser: nullify(browser),
        os: nullify(os),
        notes: nullify(notes),
      };

      if (mode === "create") {
        let bugId = createdBugId;

        if (!bugId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            throw new Error("You must be signed in to report a bug.");
          }

          const { data: inserted, error: insertError } = await supabase
            .from("bugs")
            .insert({
              project_id: projectId,
              reporter_id: user.id,
              ...fields,
            })
            .select("id")
            .single();

          if (insertError || !inserted) {
            throw new Error(insertError?.message ?? "Failed to create bug.");
          }
          bugId = inserted.id;
          setCreatedBugId(bugId);
        } else {
          // Retry after a partial failure: sync any field edits to the bug we
          // already created before finishing the screenshot uploads.
          const { error: updateError } = await supabase
            .from("bugs")
            .update(fields)
            .eq("id", bugId);
          if (updateError) {
            throw new Error(updateError.message);
          }
        }

        await uploadPending(bugId);
        router.push(`/projects/${projectId}/bugs/${bugId}`);
        router.refresh();
        return;
      }

      // edit
      if (!bug) throw new Error("Missing bug to edit.");

      const { error: updateError } = await supabase
        .from("bugs")
        .update(fields)
        .eq("id", bug.id);
      if (updateError) {
        throw new Error(updateError.message);
      }

      // Delete removed screenshots (storage object + row).
      if (removedIds.length > 0) {
        const removedRows = (screenshots ?? []).filter((s) =>
          removedIds.includes(s.id),
        );
        const paths = removedRows.map((s) => s.storage_path);
        if (paths.length > 0) {
          const { error: removeError } = await supabase.storage
            .from(SCREENSHOT_BUCKET)
            .remove(paths);
          if (removeError) {
            throw new Error(
              `Failed to remove screenshot files: ${removeError.message}`,
            );
          }
        }
        const { error: deleteError } = await supabase
          .from("bug_screenshots")
          .delete()
          .in("id", removedIds);
        if (deleteError) {
          throw new Error(deleteError.message);
        }
      }

      await uploadPending(bug.id);
      router.push(`/projects/${projectId}/bugs/${bug.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title & description */}
      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Title <span className="text-red-600">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the bug"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short summary of the issue"
            />
          </div>
        </CardContent>
      </Card>

      {/* Steps to Reproduce - the hero interaction */}
      <Card className="overflow-hidden border-brand-blue/40 ring-1 ring-brand-blue/10">
        <CardHeader className="border-b-brand-blue/20 bg-brand-blue-soft/40">
          <p className="eyebrow text-brand-blue/80">Steps to Reproduce</p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2.5">
            <AnimatePresence initial={false}>
              {steps.map((step, index) => (
                <motion.li
                  key={step.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: -4 }}
                  animate={reduce ? {} : { opacity: 1, y: 0 }}
                  exit={reduce ? {} : { opacity: 0, x: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex items-center gap-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue font-mono text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <Input
                    value={step.text}
                    onChange={(e) => updateStep(step.id, e.target.value)}
                    placeholder={`Step ${index + 1}`}
                    aria-label={`Step ${index + 1}`}
                  />
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move step up"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move step down"
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove step"
                      onClick={() => removeStep(step.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <Button
            variant="secondary"
            size="sm"
            onClick={addStep}
            className="mt-3"
          >
            <Plus className="h-4 w-4" />
            Add step
          </Button>
        </CardContent>
      </Card>

      {/* Expected / Actual */}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="expected">Expected result</Label>
            <Textarea
              id="expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="What should happen"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="actual">Actual result</Label>
            <Textarea
              id="actual"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder="What actually happens"
            />
          </div>
        </CardContent>
      </Card>

      {/* Classification & environment */}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {showPortalPicker ? (
            <div className="space-y-1.5">
              <Label htmlFor="portal">Portal</Label>
              <Select
                id="portal"
                value={portalId}
                onChange={(e) => changePortal(e.target.value)}
              >
                <option value="">Unspecified</option>
                {portals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {sections.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="section">Section</Label>
              <Select
                id="section"
                value={sectionId}
                disabled={showPortalPicker && !portalId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <option value="">
                  {showPortalPicker && !portalId
                    ? "Choose a portal first"
                    : "Unspecified"}
                </option>
                {portalSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="severity">Severity</Label>
            <Select
              id="severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/where-it-happens"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="browser">Browser</Label>
            <Input
              id="browser"
              value={browser}
              onChange={(e) => setBrowser(e.target.value)}
              placeholder="e.g. Chrome 120"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="os">OS</Label>
            <Input
              id="os"
              value={os}
              onChange={(e) => setOs(e.target.value)}
              placeholder="e.g. macOS 14"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Recommendations, extra context, or anything reviewers should know"
          />
        </CardContent>
      </Card>

      {/* Screenshots */}
      <Card>
        <CardHeader>
          <CardTitle>Screenshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {existing.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-slate">
                Existing
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {existing.map((shot) => (
                  <div
                    key={shot.id}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-line bg-slate-50"
                  >
                    {shot.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shot.url}
                        alt={shot.caption ?? "Screenshot"}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeExisting(shot.id)}
                      aria-label="Remove screenshot"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {pending.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-slate">
                To upload
              </p>
              {pending.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="truncate text-xs text-brand-slate">
                      {item.file.name}
                    </p>
                    <Input
                      value={item.caption}
                      onChange={(e) =>
                        updatePendingCaption(item.id, e.target.value)
                      }
                      placeholder="Caption (optional)"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove pending upload"
                    onClick={() => removePending(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="screenshot-upload"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-brand-charcoal ring-1 ring-line transition-colors hover:bg-slate-50"
            >
              <ImagePlus className="h-4 w-4" />
              Add screenshots
            </label>
            <input
              id="screenshot-upload"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                onFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : mode === "create" ? (
            "Report bug"
          ) : (
            "Save changes"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
