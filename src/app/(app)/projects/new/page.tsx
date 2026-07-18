import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProjectForm } from "@/components/projects/new-project-form";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-brand-slate hover:text-brand-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          All projects
        </Link>
        <h1 className="text-2xl font-semibold text-brand-charcoal">New project</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
