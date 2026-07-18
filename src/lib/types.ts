import type { Database, Severity, MemberRole } from "@/lib/database.types";

export type { Severity, MemberRole };

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"];
export type Bug = Database["public"]["Tables"]["bugs"]["Row"];
export type BugScreenshot = Database["public"]["Tables"]["bug_screenshots"]["Row"];
export type ProjectInvite = Database["public"]["Tables"]["project_invites"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type BugInsert = Database["public"]["Tables"]["bugs"]["Insert"];
export type BugUpdate = Database["public"]["Tables"]["bugs"]["Update"];

export const SEVERITIES: Severity[] = ["critical", "major", "minor", "trivial"];

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  trivial: "Trivial",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  member: "Member",
};

/** Name of the private Supabase Storage bucket that holds bug screenshots. */
export const SCREENSHOT_BUCKET = "bug-screenshots";
