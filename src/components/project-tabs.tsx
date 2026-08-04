"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({
  projectId,
  trashCount = 0,
}: {
  projectId: string;
  trashCount?: number;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const onMembers = pathname.startsWith(`${base}/members`);
  const onTrash = pathname.startsWith(`${base}/trash`);

  const tabs = [
    { href: base, label: "Bugs", active: !onMembers && !onTrash, count: 0 },
    { href: `${base}/members`, label: "Members", active: onMembers, count: 0 },
    {
      href: `${base}/trash`,
      label: "Recycle bin",
      active: onTrash,
      count: trashCount,
    },
  ];

  return (
    <div className="flex gap-6 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-1 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors duration-150",
            t.active
              ? "border-brand-blue text-brand-blue"
              : "border-transparent text-brand-slate hover:border-line hover:text-brand-charcoal",
          )}
        >
          {t.label}
          {t.count > 0 ? (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-brand-charcoal">
              {t.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
