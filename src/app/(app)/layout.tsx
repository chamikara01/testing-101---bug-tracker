import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { MainReveal } from "@/components/motion/main-reveal";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware should already have redirected, but never render the
  // authenticated shell without a user.
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <MainReveal>{children}</MainReveal>
      </main>
    </div>
  );
}
