"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SeverityBadge } from "@/components/bugs/severity-badge";
import { SCREENSHOT_BUCKET, type Severity } from "@/lib/types";

export interface TrashItem {
  id: string;
  title: string;
  severity: Severity;
  deleted_at: string | null;
}

export function RecycleBinList({
  items,
}: {
  items: TrashItem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function restore(id: string) {
    if (pendingId) return;
    setPendingId(`restore:${id}`);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bugs")
      .update({ deleted_at: null })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  async function purge(id: string, title: string) {
    if (pendingId) return;
    if (
      !window.confirm(
        `Permanently delete "${title}"? This removes the bug and its screenshots for good and cannot be undone.`,
      )
    ) {
      return;
    }
    setPendingId(`purge:${id}`);
    setError(null);

    const supabase = createClient();

    // Remove screenshot files first - storage access is granted via the bug's
    // project membership, so the row must still exist when the files are
    // deleted; then remove the row itself (screenshot rows cascade).
    const { data: shots } = await supabase
      .from("bug_screenshots")
      .select("storage_path")
      .eq("bug_id", id);
    const paths = (shots ?? []).map((s) => s.storage_path);
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .remove(paths);
      if (storageError) {
        setError(storageError.message);
        setPendingId(null);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("bugs")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Card className="divide-y divide-line p-0">
        {items.map((bug) => (
          <div
            key={bug.id}
            className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-brand-charcoal">
                {bug.title}
              </p>
              <p className="mt-0.5 font-mono text-xs text-brand-slate">
                #{bug.id.slice(0, 6)}
                {bug.deleted_at
                  ? ` - deleted ${format(new Date(bug.deleted_at), "MMM d, yyyy")}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SeverityBadge severity={bug.severity} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => restore(bug.id)}
                disabled={pendingId !== null}
              >
                <RotateCcw className="h-4 w-4" />
                {pendingId === `restore:${bug.id}` ? "Restoring..." : "Restore"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => purge(bug.id, bug.title)}
                disabled={pendingId !== null}
                className="text-red-600 ring-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                {pendingId === `purge:${bug.id}` ? "Deleting..." : "Delete forever"}
              </Button>
            </div>
          </div>
        ))}
      </Card>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
