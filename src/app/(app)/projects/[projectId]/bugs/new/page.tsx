import { BugForm } from "@/components/bugs/bug-form";

export default async function NewBugPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-brand-charcoal">Report a bug</h2>
      <BugForm projectId={projectId} mode="create" />
    </div>
  );
}
