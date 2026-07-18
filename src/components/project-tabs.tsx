"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const onMembers = pathname.startsWith(`${base}/members`);

  const tabs = [
    { href: base, label: "Bugs", active: !onMembers },
    { href: `${base}/members`, label: "Members", active: onMembers },
  ];

  return (
    <div className="flex gap-6 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-1 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors duration-150",
            t.active
              ? "border-brand-blue text-brand-blue"
              : "border-transparent text-brand-slate hover:border-line hover:text-brand-charcoal",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
