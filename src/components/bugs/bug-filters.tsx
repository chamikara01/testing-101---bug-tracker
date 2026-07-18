"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SEVERITIES, SEVERITY_LABELS } from "@/lib/types";

export function BugFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setSeverity = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("severity", value);
      } else {
        params.delete("severity");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const severity = searchParams.get("severity") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-44">
        <Select
          aria-label="Filter by severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      {severity ? (
        <Button variant="ghost" size="sm" onClick={() => setSeverity("")}>
          <X className="h-4 w-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
