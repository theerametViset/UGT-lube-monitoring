import { z } from "zod";

// Environment flags. Demo Mode lets the app run a local preview without a live
// Supabase project. It is strictly opt-in via DEMO_MODE and auto-disables the
// moment real Supabase values are present.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1") {
    return true;
  }
  // Safety: if DEMO_MODE is explicitly off but Supabase isn't configured, still
  // run demo so `npm run dev` never hard-crashes on a fresh clone. Disable by
  // providing real Supabase env OR setting DEMO_MODE=false.
  if (process.env.DEMO_MODE !== "false" && !isSupabaseConfigured()) {
    return true;
  }
  return false;
}

// Local Store: Demo Mode that really saves Data Entry readings + lab files to disk
// (lib/local-store.ts) as a bridge until Supabase / a company DB server is set up.
// Opt-in with LOCAL_STORE=true. Never on Vercel — its filesystem is read-only and
// wiped between requests, so "saved" data would silently vanish.
export function isLocalStore(): boolean {
  if (!isDemoMode()) return false;
  if (process.env.VERCEL) return false;
  return process.env.LOCAL_STORE === "true" || process.env.LOCAL_STORE === "1";
}

// Any of these vars that ARE present must be well-formed — catches a
// truncated/typo'd key at boot instead of a confusing failure deep inside a
// Supabase call later. Presence itself stays optional (Demo Mode has none).
const EnvShape = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional().or(z.literal("")),
});

// Called once from instrumentation.ts on server boot.
export function validateEnv(): void {
  const result = EnvShape.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`[env] Invalid environment variable(s) at startup:\n${issues}`);
  }
}
