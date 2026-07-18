import { cn } from "@/lib/utils";

export type MascotName =
  | "search" // magnifying glass - hunting for bugs
  | "shrug" // no results / not found
  | "clipboard" // starting out / no projects
  | "thumbsup" // all clear / success
  | "lean" // idle / nothing attached
  | "point"; // tip / welcome

/** Testing 101 line-figure mascot. Decorative - hidden from assistive tech. */
export function Mascot({
  name,
  className,
}: {
  name: MascotName;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative inline SVG illustration
    <img
      src={`/mascot-${name}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("h-40 w-auto select-none", className)}
    />
  );
}
