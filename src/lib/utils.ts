import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Guard against open-redirects: only accept same-origin relative paths.
 * Rejects absolute URLs ("https://host", "@host" appended to an origin),
 * protocol-relative ("//host"), and backslash tricks ("/\\host"). A valid
 * target must be a single-leading-slash relative path. Falls back to "/".
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\")
  ) {
    return "/";
  }
  return path;
}
