import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email";
import type { MemberRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRole(role: unknown): MemberRole {
  return role === "owner" ? "owner" : "member";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  let body: { email?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const role = normalizeRole(body.role);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // RLS enforces owner-only insert. A duplicate (already invited) is fine - we
  // still (re)send the email below.
  const { error: insertError } = await supabase
    .from("project_invites")
    .insert({ project_id: projectId, email, role });

  let alreadyInvited = false;
  if (insertError) {
    if (insertError.code === "23505") {
      alreadyInvited = true;
    } else if (insertError.code === "42501") {
      return NextResponse.json(
        { error: "Only the project owner can invite members." },
        { status: 403 },
      );
    } else {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  const projectName = project?.name ?? "a project";

  // Land on the dashboard after signing in - that's where the pending
  // invitation appears with Accept / Decline (they aren't a member yet, so we
  // can't send them straight to the project).
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const joinUrl = `${origin}/login?redirect=${encodeURIComponent("/")}&email=${encodeURIComponent(email)}`;

  const { sent, error: emailError } = await sendInviteEmail({
    to: email,
    projectName,
    inviterEmail: user.email ?? null,
    role,
    joinUrl,
  });

  return NextResponse.json({
    ok: true,
    alreadyInvited,
    emailSent: sent,
    emailError: sent ? undefined : emailError,
  });
}
