import Image from "next/image";
import { cn } from "@/lib/utils";

/** Testing 101 mark + wordmark. `tone="dark"` for placement on dark surfaces. */
export function Logo({
  size = 30,
  withWordmark = true,
  tone = "light",
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/testing101-mark.svg"
        alt="Testing 101"
        width={size}
        height={size}
        className="rounded-lg"
        priority
      />
      {withWordmark ? (
        <span className="font-display text-lg font-bold leading-none tracking-tight">
          <span className={dark ? "text-blue-400" : "text-brand-blue"}>
            Testing
          </span>{" "}
          <span className={dark ? "text-white" : "text-brand-charcoal"}>101</span>
        </span>
      ) : null}
    </span>
  );
}
