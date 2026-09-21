"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  SEVERITIES,
  SEVERITY_LABELS,
  type StructureOption,
} from "@/lib/types";

const FILTER_KEYS = ["severity", "section", "portal"] as const;

export function BugFilters({
  sections = [],
  portals = [],
}: {
  sections?: StructureOption[];
  portals?: StructureOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const severity = searchParams.get("severity") ?? "";
  const section = searchParams.get("section") ?? "";
  const portal = searchParams.get("portal") ?? "";
  const anyActive = severity !== "" || section !== "" || portal !== "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-44">
        <Select
          aria-label="Filter by severity"
          value={severity}
          onChange={(e) => setFilter("severity", e.target.value)}
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {sections.length > 0 ? (
        <div className="w-48">
          <Select
            aria-label="Filter by section"
            value={section}
            onChange={(e) => setFilter("section", e.target.value)}
          >
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {portals.length > 0 ? (
        <div className="w-48">
          <Select
            aria-label="Filter by portal"
            value={portal}
            onChange={(e) => setFilter("portal", e.target.value)}
          >
            <option value="">All portals</option>
            {portals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {anyActive ? (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="h-4 w-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
