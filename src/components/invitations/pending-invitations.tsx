"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type MemberRole } from "@/lib/types";

export interface Invitation {
  invite_id: string;
  project_id: string;
  project_name: string;
  role: MemberRole;
  created_at: string;
}

export function PendingInvitations({ invites }: { invites: Invitation[] }) {
  const router = useRouter();
  const [list, setList] = useState<Invitation[]>(invites);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (list.length === 0) return null;

  async function accept(inv: Invitation) {
    if (pendingId) return;
    setPendingId(inv.invite_id);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("accept_invite", {
      pid: inv.project_id,
    });
    if (rpcError) {
      setError(rpcError.message);
      setPendingId(null);
      return;
    }
    router.push(`/projects/${inv.project_id}`);
    router.refresh();
  }

  async function decline(inv: Invitation) {
    if (pendingId) return;
    setPendingId(inv.invite_id);
    setError(null);
    const supabase = createClient();
    const { error: delError } = await supabase
      .from("project_invites")
      .delete()
      .eq("id", inv.invite_id);
    if (delError) {
      setError(delError.message);
      setPendingId(null);
      return;
    }
    setList((prev) => prev.filter((i) => i.invite_id !== inv.invite_id));
    setPendingId(null);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-brand-blue/30 bg-brand-blue-soft/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-brand-blue" />
        <h2 className="text-sm font-semibold text-brand-charcoal">
          Pending invitations
        </h2>
      </div>
      <ul className="space-y-2">
        {list.map((inv) => {
          const busy = pendingId === inv.invite_id;
          return (
            <li
              key={inv.invite_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 ring-1 ring-line"
            >
              <p className="text-sm text-brand-charcoal">
                You&apos;ve been invited to{" "}
                <span className="font-semibold">{inv.project_name}</span> as{" "}
                {ROLE_LABELS[inv.role].toLowerCase()}.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => accept(inv)}
                >
                  <Check className="h-4 w-4" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => decline(inv)}
                >
                  <X className="h-4 w-4" />
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
