// Shared helpers for SpeedCurrency server functions (Supabase Edge Functions, Deno).
import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Returns the signed-in user from the request's Authorization header, or null. */
export async function currentUser(req: Request): Promise<User | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const { data, error } = await admin().auth.getUser(auth.slice(7));
  if (error) return null;
  return data.user;
}

export function isPremium(p: { plan?: string; premium_until?: string | null } | null) {
  return !!p && p.plan === "premium" && !!p.premium_until && new Date(p.premium_until) > new Date();
}
