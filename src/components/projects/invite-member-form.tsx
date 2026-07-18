"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, type MemberRole } from "@/lib/types";

const MEMBER_ROLES: MemberRole[] = ["member", "owner"];

interface InviteResponse {
  ok?: boolean;
  alreadyInvited?: boolean;
  emailSent?: boolean;
  emailError?: string;
  error?: string;
}

export function InviteMemberForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("member");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    let data: InviteResponse;
    try {
      const res = await fetch(`/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, role }),
      });
      data = (await res.json()) as InviteResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not send the invitation.");
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Network error - please try again.");
      setSubmitting(false);
      return;
    }

    const who = data.alreadyInvited ? `${trimmedEmail} was already invited` : `Invited ${trimmedEmail}`;
    setSuccess(
      data.emailSent
        ? `${who} - an invitation email is on its way. They can accept it after signing in.`
        : `${who}. No email was sent (no email provider configured), but they can accept the invitation after signing in with this address.`,
    );
    setEmail("");
    setRole("member");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            required
            disabled={submitting}
          />
        </div>
        <div className="space-y-1.5 sm:w-40">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            disabled={submitting}
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Inviting..." : "Invite"}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-brand-green" role="status">
          {success}
        </p>
      ) : null}

      <p className="text-xs text-brand-slate">
        We&apos;ll email them a join link. They&apos;ll be able to accept (or
        decline) the invitation after signing in with this email.
      </p>
    </form>
  );
}
