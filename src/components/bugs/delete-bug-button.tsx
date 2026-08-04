"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function DeleteBugButton({
  projectId,
  bugId,
}: {
  projectId: string;
  bugId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (pending) return;
    if (
      !window.confirm(
        "Move this bug to the recycle bin? You can restore it (or delete it for good) from the project's recycle bin.",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);

    // Soft delete: keep the row and its screenshots, just mark it deleted. The
    // recycle bin restores (deleted_at = null) or permanently deletes it.
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bugs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", bugId);

    if (updateError) {
      setError(updateError.message);
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
