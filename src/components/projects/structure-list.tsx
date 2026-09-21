"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Portals and the sections inside one portal are both flat, ordered name
 *  lists, so one component drives either table. Sections additionally need the
 *  portal they belong to, hence the discriminated props. */
export type StructureTable = "project_portals" | "project_sections";

export interface StructureItem {
  id: string;
  name: string;
  position: number;
}

interface BaseProps {
  projectId: string;
  items: StructureItem[];
  canEdit: boolean;
  title: string;
  description: string;
  addLabel: string;
  emptyText: string;
  /** What happens to bugs pointing here when an entry is removed. */
  deleteWarning: string;
  /** False while the list must keep its last entry (a project needs a portal). */
  allowDelete?: boolean;
}

type StructureListProps = BaseProps &
  ({ table: "project_portals" } | { table: "project_sections"; portalId: string });

function friendly(message: string, code?: string): string {
  if (code === "23505") return "That name is already used in this project.";
  return message;
}

export function StructureList(props: StructureListProps) {
  const {
    projectId,
    table,
    items,
    canEdit,
    title,
    description,
    addLabel,
    emptyText,
    deleteWarning,
    allowDelete = true,
  } = props;
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name || busy) return;

    setBusy(true);
    setError(null);
    const nextPosition =
      items.reduce((max, item) => Math.max(max, item.position), -1) + 1;

    const supabase = createClient();
    const { error: insertError } =
      props.table === "project_sections"
        ? await supabase.from("project_sections").insert({
            project_id: projectId,
            portal_id: props.portalId,
            name,
            position: nextPosition,
          })
        : await supabase.from("project_portals").insert({
            project_id: projectId,
            name,
            position: nextPosition,
          });

    setBusy(false);
    if (insertError) {
      setError(friendly(insertError.message, insertError.code));
      return;
    }
    setDraft("");
    router.refresh();
  }

  async function rename(id: string) {
    const name = editingName.trim();
    if (!name || busy) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from(table)
      .update({ name })
      .eq("id", id);

    setBusy(false);
    if (updateError) {
      setError(friendly(updateError.message, updateError.code));
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function remove(item: StructureItem) {
    if (busy) return;
    if (!window.confirm(`Delete “${item.name}”? ${deleteWarning}`)) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("id", item.id);

    setBusy(false);
    if (deleteError) {
      setError(friendly(deleteError.message, deleteError.code));
      return;
    }
    router.refresh();
  }

  /** Swap `position` with the neighbour in that direction. Positions are not
   *  unique, so the two writes can land in either order safely. */
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (busy || target < 0 || target >= items.length) return;

    const a = items[index];
    const b = items[target];
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const [{ error: errA }, { error: errB }] = await Promise.all([
      supabase.from(table).update({ position: b.position }).eq("id", a.id),
      supabase.from(table).update({ position: a.position }).eq("id", b.id),
    ]);

    setBusy(false);
    if (errA || errB) {
      setError((errA ?? errB)!.message);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-sm text-brand-slate">{description}</p>
      </CardHeader>

      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-5 py-4 text-sm italic text-brand-slate">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                {editingId === item.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void rename(item.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      aria-label={`Rename ${item.name}`}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Save name"
                      disabled={busy}
                      onClick={() => rename(item.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Cancel rename"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-brand-charcoal">
                      {item.name}
                    </span>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ${item.name} up`}
                          disabled={busy || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ${item.name} down`}
                          disabled={busy || index === items.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Rename ${item.name}`}
                          disabled={busy}
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingName(item.name);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${item.name}`}
                          disabled={busy || !allowDelete}
                          title={
                            allowDelete
                              ? undefined
                              : "A project must keep at least one portal"
                          }
                          onClick={() => remove(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <form
            onSubmit={add}
            className="flex items-center gap-2 border-t border-line px-5 py-4"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={addLabel}
              aria-label={addLabel}
              maxLength={120}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={busy || draft.trim() === ""}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        ) : null}

        {error ? (
          <p className="px-5 pb-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
