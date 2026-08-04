import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { RecycleBinList, type TrashItem } from "@/components/bugs/recycle-bin-list";

export const metadata = { title: "Recycle bin" };

export default async function RecycleBinPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("bugs")
    .select("id,title,severity,deleted_at")
    .eq("project_id", projectId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const items: TrashItem[] = rows ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Recycle bin</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-brand-charcoal">
          Deleted bugs{" "}
          <span className="font-sans text-sm font-normal text-brand-slate">
            ({items.length})
          </span>
        </h2>
        <p className="mt-1 text-sm text-brand-slate">
          Restore a bug to put it back with the project, or delete it forever to
          remove it and its screenshots permanently.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          mascot="thumbsup"
          title="Recycle bin is empty"
          description="Deleted bugs land here. Nothing to restore right now."
        />
      ) : (
        <RecycleBinList items={items} />
      )}
    </div>
  );
}
