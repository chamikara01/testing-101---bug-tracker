import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { WalkingMascot } from "@/components/brand/walking-mascot";
import { AuthForm } from "@/components/auth/auth-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; email?: string }>;
}) {
  const { redirect, email } = await searchParams;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-canvas px-4 py-10">
      <WalkingMascot name="point" />
      <div className="mt-3 flex w-full max-w-sm flex-col items-center gap-5">
        <Link href="/" aria-label="Testing 101 home">
          <Logo size={34} />
        </Link>
        <p className="eyebrow">Bug tracking for QA teams</p>
        <AuthForm mode="signup" redirectTo={redirect ?? "/"} initialEmail={email} />
      </div>
    </main>
  );
}
