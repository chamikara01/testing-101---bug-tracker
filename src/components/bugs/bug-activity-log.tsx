import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export interface ActivityEntry {
  id: string;
  action: "created" | "updated" | "deleted" | "restored";
  actorEmail: string | null;
  changed_fields: string[] | null;
  created_at: string;
}

const DOT: Record<ActivityEntry["action"], string> = {
  created: "bg-brand-blue",
  updated: "bg-amber-500",
  deleted: "bg-red-500",
  restored: "bg-brand-green",
};

function describe(entry: ActivityEntry): string {
  switch (entry.action) {
    case "created":
      return "reported this bug";
    case "updated":
      return entry.changed_fields && entry.changed_fields.length > 0
        ? `updated ${entry.changed_fields.join(", ")}`
        : "updated this bug";
    case "deleted":
      return "moved this bug to the recycle bin";
    case "restored":
      return "restored this bug";
  }
}

/** Newest-first history of who changed a bug and when. */
export function BugActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm italic text-brand-slate">No activity recorded yet.</p>
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span
            className={cn(
              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
              DOT[entry.action],
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-brand-charcoal">
              <span className="font-medium">
                {entry.actorEmail ?? "Someone"}
              </span>{" "}
              {describe(entry)}
            </p>
            <p className="mt-0.5 font-mono text-xs text-brand-slate">
              {formatDistanceToNow(new Date(entry.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
