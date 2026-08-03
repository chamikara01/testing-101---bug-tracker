import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MembersList } from "@/components/projects/members-list";
import { InviteMemberForm } from "@/components/projects/invite-member-form";
import { DeleteProject } from "@/components/projects/delete-project";
import type { MemberRole, ProjectInvite } from "@/lib/types";

export interface MemberEntry {
  user_id: string;
  role: MemberRole;
  email: string | null;
  created_at: string;
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: isOwner } = await supabase.rpc("is_project_owner", {
    pid: projectId,
  });

  // Only the project's creator (owner_id) may delete it - this mirrors the
  // projects_delete RLS policy exactly, so the danger zone never appears for
  // someone whose delete would be rejected.
  const { data: project } = await supabase
    .from("projects")
    .select("name, owner_id")
    .eq("id", projectId)
    .maybeSingle();
  const isCreator = !!user && project?.owner_id === user.id;

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("user_id,role,created_at")
    .eq("project_id", projectId)
    .order("created_at");

  const rows = memberRows ?? [];
  const memberIds = rows.map((row) => row.user_id);

  const emailById = new Map<string, string | null>();
  if (memberIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email")
      .in("id", memberIds);
    for (const profile of profiles ?? []) {
      emailById.set(profile.id, profile.email);
    }
  }

  const members: MemberEntry[] = rows.map((row) => ({
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    email: emailById.get(row.user_id) ?? null,
  }));

  const { data: inviteRows } = await supabase
    .from("project_invites")
    .select("*")
    .eq("project_id", projectId);

  const invites: ProjectInvite[] = inviteRows ?? [];

  return (
    <div className="space-y-6">
      <MembersList
        projectId={projectId}
        members={members}
        invites={invites}
        isOwner={isOwner ?? false}
        currentUserId={user?.id ?? ""}
      />

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite by email</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteMemberForm projectId={projectId} />
          </CardContent>
        </Card>
      ) : null}

      {isCreator && project ? (
        <DeleteProject projectId={projectId} projectName={project.name} />
      ) : null}
    </div>
  );
}
