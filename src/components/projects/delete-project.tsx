"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SCREENSHOT_BUCKET } from "@/lib/types";

export function DeleteProject({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canDelete = confirmText.trim() === projectName && !pending;

  async function handleDelete() {
    if (!canDelete) return;
    setPending(true);
    setError(null);

    const supabase = createClient();

    // Deleting the project cascades to its bugs, screenshots rows, members and
    // invitations - but the screenshot FILES in storage do not cascade, and
    // storage RLS would deny removing them once the bugs are gone. So gather
    // and delete every screenshot file first, while the project still exists.
    const { data: bugRows, error: bugsError } = await supabase
      .from("bugs")
      .select("id")
      .eq("project_id", projectId);
    if (bugsError) {
      setError(bugsError.message);
      setPending(false);
      return;
    }

    const bugIds = (bugRows ?? []).map((b) => b.id);
    if (bugIds.length > 0) {
      const { data: shotRows, error: shotsError } = await supabase
        .from("bug_screenshots")
        .select("storage_path")
        .in("bug_id", bugIds);
      if (shotsError) {
        setError(shotsError.message);
        setPending(false);
        return;
      }
      const paths = (shotRows ?? []).map((s) => s.storage_path);
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(SCREENSHOT_BUCKET)
          .remove(paths);
        if (storageError) {
          setError(storageError.message);
          setPending(false);
          return;
        }
      }
    }

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);
    if (deleteError) {
      setError(deleteError.message);
      setPending(false);
      return;
    }

    router.push("/projects");
    router.refresh();
  }

  return (
    <Card className="border-red-200">
      <CardHeader className="border-b-red-100">
        <CardTitle className="text-red-700">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-brand-slate">
          Permanently delete{" "}
          <span className="font-medium text-brand-charcoal">{projectName}</span>{" "}
          and everything in it - all bugs, screenshots, members, and pending
          invitations. This cannot be undone.
        </p>
        <div className="space-y-1.5">
          <label
            htmlFor="confirm-project-name"
            className="block text-xs text-brand-slate"
          >
            Type{" "}
            <span className="font-mono font-medium text-brand-charcoal">
              {projectName}
            </span>{" "}
            to confirm.
          </label>
          <Input
            id="confirm-project-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={projectName}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            className="max-w-sm"
          />
        </div>
        <Button variant="danger" onClick={handleDelete} disabled={!canDelete}>
          <Trash2 className="h-4 w-4" />
          {pending ? "Deleting project..." : "Delete this project"}
        </Button>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
