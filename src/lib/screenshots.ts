import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { BugScreenshot } from "@/lib/types";
import { SCREENSHOT_BUCKET } from "@/lib/types";

export interface SignedScreenshot extends BugScreenshot {
  /** Time-limited signed URL, or null if signing failed. */
  url: string | null;
}

/**
 * Resolve time-limited signed URLs for a set of screenshots in the private
 * bucket. Works with any Supabase client (server or browser) whose session is
 * allowed to read the objects (RLS enforces project membership).
 */
export async function signScreenshots(
  supabase: SupabaseClient<Database>,
  screenshots: BugScreenshot[],
  expiresIn = 60 * 60,
): Promise<SignedScreenshot[]> {
  if (screenshots.length === 0) return [];
  const paths = screenshots.map((s) => s.storage_path);
  const { data } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrls(paths, expiresIn);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return screenshots.map((s) => ({
    ...s,
    url: byPath.get(s.storage_path) ?? null,
  }));
}
