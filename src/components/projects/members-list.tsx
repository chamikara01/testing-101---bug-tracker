"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ROLE_LABELS, type MemberRole, type ProjectInvite } from "@/lib/types";

interface MemberEntry {
  user_id: string;
  role: MemberRole;
  email: string | null;
  created_at: string;
}

const ROLE_BADGE: Record<MemberRole, string> = {
  owner: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  member: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export function MembersList({
  projectId,
  members,
  invites,
  isOwner,
  currentUserId,
}: {
  projectId: string;
  members: MemberEntry[];
  invites: ProjectInvite[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function removeMember(userId: string, label: string) {
    if (pendingId) return;
    if (
      !window.confirm(
        `Remove ${label} from this project? They will immediately lose access to its bugs and screenshots.`,
      )
    ) {
      return;
    }
    setPendingId(`member:${userId}`);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (deleteError) {
      setError(deleteError.message);
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  async function cancelInvite(inviteId: string, email: string) {
    if (pendingId) return;
    if (!window.confirm(`Cancel the invitation for ${email}?`)) {
      return;
    }
    setPendingId(`invite:${inviteId}`);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("project_invites")
      .delete()
      .eq("id", inviteId);

    if (deleteError) {
      setError(deleteError.message);
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-line">
            {members.map((member) => {
              const isSelf = member.user_id === currentUserId;
              const canRemove = isOwner && !isSelf && member.role !== "owner";
              return (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-charcoal">
                      {member.email ?? "Unknown user"}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-brand-slate">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-brand-slate">
                      Joined {format(new Date(member.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge className={ROLE_BADGE[member.role]}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                    {canRemove ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeMember(
                            member.user_id,
                            member.email ?? "this member",
                          )
                        }
                        disabled={pendingId === `member:${member.user_id}`}
                      >
                        {pendingId === `member:${member.user_id}`
                          ? "Removing..."
                          : "Remove"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {isOwner && invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-brand-slate" />
                    <span className="truncate text-sm text-brand-charcoal">
                      {invite.email}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge className={ROLE_BADGE[invite.role]}>
                      {ROLE_LABELS[invite.role]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Cancel invite for ${invite.email}`}
                      onClick={() => cancelInvite(invite.id, invite.email)}
                      disabled={pendingId === `invite:${invite.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
