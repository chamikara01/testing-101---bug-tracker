// Hand-authored types matching supabase/migrations/0001_init.sql.
// Keep in sync with the migration. Used to type the Supabase clients so
// queries and results are fully typed (no `any`).

export type Severity = "critical" | "major" | "minor" | "trivial";
export type MemberRole = "owner" | "member";

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
        };
        Relationships: [];
      };
      bugs: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          steps_to_reproduce: string[];
          expected_result: string | null;
          actual_result: string | null;
          url: string | null;
          description: string | null;
          notes: string | null;
          severity: Severity;
          browser: string | null;
          os: string | null;
          reporter_id: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          steps_to_reproduce?: string[];
          expected_result?: string | null;
          actual_result?: string | null;
          url?: string | null;
          description?: string | null;
          notes?: string | null;
          severity?: Severity;
          browser?: string | null;
          os?: string | null;
          reporter_id: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          steps_to_reproduce?: string[];
          expected_result?: string | null;
          actual_result?: string | null;
          url?: string | null;
          description?: string | null;
          notes?: string | null;
          severity?: Severity;
          browser?: string | null;
          os?: string | null;
          reporter_id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      bug_screenshots: {
        Row: {
          id: string;
          bug_id: string;
          storage_path: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bug_id: string;
          storage_path: string;
          caption?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          bug_id?: string;
          storage_path?: string;
          caption?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      project_invites: {
        Row: {
          id: string;
          project_id: string;
          email: string;
          role: MemberRole;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          role?: MemberRole;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          email?: string;
          role?: MemberRole;
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_project_member: { Args: { pid: string }; Returns: boolean };
      is_project_owner: { Args: { pid: string }; Returns: boolean };
      can_access_bug: { Args: { bid: string }; Returns: boolean };
      shares_project: { Args: { target: string }; Returns: boolean };
      accept_invite: { Args: { pid: string }; Returns: undefined };
      my_invitations: {
        Args: Record<string, never>;
        Returns: {
          invite_id: string;
          project_id: string;
          project_name: string;
          role: MemberRole;
          created_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
