"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SCREENSHOT_BUCKET } from "@/lib/types";

export function DeleteBugButton({
  projectId,
  bugId,
  screenshotPaths,
}: {
  projectId: string;
  bugId: string;
  screenshotPaths: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (pending) return;
    if (
      !window.confirm(
        "Delete this bug permanently? Its screenshots and report data will be removed. This cannot be undone.",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);

    const supabase = createClient();

    // Remove screenshot files first. Storage access is granted via the bug's
    // project membership, so once the bug row (and its cascade) is gone the
    // objects can no longer be deleted - clean them while the bug still exists.
    if (screenshotPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .remove(screenshotPaths);
      if (storageError) {
        setError(storageError.message);
        setPending(false);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("bugs")
      .delete()
      .eq("id", bugId);
    if (deleteError) {
      setError(deleteError.message);
      setPending(false);
      return;
    }

    router.push(`/projects/${projectId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        className="text-red-600 ring-red-200 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "Deleting..." : "Delete"}
      </Button>
      {error ? (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
