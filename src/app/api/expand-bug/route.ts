import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called cross-origin by the Testing 101 Bug Capture Chrome extension. It holds
// the Anthropic key (never shipped to the extension) and verifies the caller's
// Supabase access token before spending any tokens.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const SEVERITIES = ["critical", "major", "minor", "trivial"] as const;

const SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Short, specific bug title (max ~120 chars).",
    },
    steps_to_reproduce: {
      type: "array",
      items: { type: "string" },
      description: "Ordered, concrete steps. [] if none can be inferred.",
    },
    expected_result: { type: "string" },
    actual_result: { type: "string" },
    severity: { type: "string", enum: SEVERITIES },
  },
  required: [
    "title",
    "steps_to_reproduce",
    "expected_result",
    "actual_result",
    "severity",
  ],
  additionalProperties: false,
} as const;

function resolveAllowedOrigin(origin: string | null): string {
  const configured = process.env.EXTENSION_ORIGIN?.trim();
  if (configured) return configured; // production: lock to the pinned extension
  if (origin?.startsWith("chrome-extension://")) return origin; // dev
  return "*";
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveAllowedOrigin(origin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

interface ConsoleLine {
  level?: string;
  message?: string;
}

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: cors });

  // 1. Verify the caller's Supabase token (bearer, not cookies — cross-origin).
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!token) return json({ error: "Missing bearer token." }, 401);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json({ error: "Not authenticated." }, 401);
  }

  // 2. Parse the request body.
  let body: {
    note?: unknown;
    consoleErrors?: unknown;
    url?: unknown;
    browser?: unknown;
    os?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const note = String(body.note ?? "").trim();
  if (!note) return json({ error: "A note is required." }, 400);

  const consoleErrors = Array.isArray(body.consoleErrors)
    ? (body.consoleErrors as ConsoleLine[])
        .slice(-40)
        .map((e) => `[${e?.level ?? "log"}] ${String(e?.message ?? "")}`)
        .join("\n")
        .slice(0, 8000)
    : "";
  const url = String(body.url ?? "");
  const browser = String(body.browser ?? "");
  const os = String(body.os ?? "");

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "Server is missing ANTHROPIC_API_KEY." }, 500);
  }

  // 3. Ask Claude to expand the note into a structured report.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const system =
    "You turn a tester's rough note about a web bug into a clear, structured bug report. " +
    "Use ONLY the information provided — do not invent reproduction steps, stack traces, or behavior that isn't supported by the note or console output. " +
    "If steps can't be reasonably inferred, return an empty steps array. " +
    "Write concise, professional English. Choose a severity from critical/major/minor/trivial based on user impact (data loss/crash = critical; broken core feature = major; minor UX issue = minor; cosmetic = trivial).";

  const userContent =
    `Tester's note:\n${note}\n\n` +
    `Page URL: ${url || "(unknown)"}\n` +
    `Browser: ${browser || "(unknown)"}\n` +
    `OS: ${os || "(unknown)"}\n\n` +
    `Console output (may be empty):\n${consoleErrors || "(none captured)"}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: userContent }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return json({ error: "Model returned no content." }, 502);
    }
    const parsed = JSON.parse(text.text);
    return json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: `LLM request failed: ${msg}` }, 502);
  }
}
