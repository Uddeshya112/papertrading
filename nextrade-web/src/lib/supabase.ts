/**
 * @module lib/supabase
 * @description Dual-mode Supabase browser client supporting both Vercel environment variables and in-app runtime keys.
 *
 * Security Guardrails:
 * - Automatically reads `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `ANON_KEY`.
 * - Allows optional in-app runtime key configuration stored in `localStorage` while explicitly blocking
 *   privileged `service_role` keys from ever being saved in browser storage.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type RuntimeSupabaseConfig = {
  url: string;
  publishableKey: string;
};

const RUNTIME_CONFIG_KEY = "tradeguru_supabase_runtime_v1";

let client: SupabaseClient | undefined;
let recoverySessionDetected = false;

export function getSavedSupabaseConfig(): RuntimeSupabaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RUNTIME_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeSupabaseConfig>;
    if (typeof parsed.url === "string" && typeof parsed.publishableKey === "string" && parsed.url.trim() && parsed.publishableKey.trim()) {
      return { url: parsed.url.trim().replace(/\/$/, ""), publishableKey: parsed.publishableKey.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSupabaseConfig(url: string, publishableKey: string): void {
  if (typeof window === "undefined") return;
  const cleanUrl = url.trim().replace(/\/$/, "");
  const cleanKey = publishableKey.trim();
  if (!cleanUrl.startsWith("https://")) {
    throw new Error("Supabase URL must start with https://");
  }
  if (!cleanKey) {
    throw new Error("Supabase Publishable/Anon key is required.");
  }
  if (cleanKey.toLowerCase().includes("service_role")) {
    throw new Error("Never paste a service_role key in the browser. Use the public Publishable / Anon key only.");
  }
  window.localStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify({ url: cleanUrl, publishableKey: cleanKey }));
  client = undefined;
}

export function clearSupabaseConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RUNTIME_CONFIG_KEY);
  client = undefined;
}

export function isSupabaseConfigured(): boolean {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && envKey) return true;
  return Boolean(getSavedSupabaseConfig());
}

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const saved = getSavedSupabaseConfig();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || saved?.url;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    saved?.publishableKey;

  if (!url || !publishableKey) {
    throw new Error("Supabase is not connected yet. Open Settings → Connect Supabase Cloud and paste your Project URL and Publishable/Anon Key.");
  }

  client = createClient(url, publishableKey, {
    auth: { flowType: "pkce", autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") recoverySessionDetected = true;
  });
  return client;
}

export function isRecoverySessionDetected() {
  return recoverySessionDetected;
}

export function authRedirect(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}
