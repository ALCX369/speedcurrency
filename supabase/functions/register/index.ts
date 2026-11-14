// Sets the account's home country ONCE, from the location the account is created in.
// Uses the free country.is lookup (no key). The database refuses any later change.
import { admin, cors, currentUser, json } from "../_shared/common.ts";

const names = new Intl.DisplayNames(["en"], { type: "region" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await currentUser(req);
  if (!user) return json({ error: "Sign in first" }, 401);

  const db = admin();
  const { data: profile } = await db.from("profiles").select("home_country, home_country_code").eq("id", user.id).single();
  if (profile?.home_country) return json({ country: profile.home_country, code: profile.home_country_code, locked: true });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  let code = "";
  if (ip) {
    try {
      const r = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) code = String((await r.json()).country ?? "").toUpperCase();
    } catch { /* fall through */ }
  }
  if (!/^[A-Z]{2}$/.test(code)) return json({ error: "Could not detect your country. Try again in a moment." }, 503);

  const country = names.of(code) ?? code;
  const { error } = await db.from("profiles").update({ home_country: country, home_country_code: code }).eq("id", user.id);
  if (error) return json({ error: error.message }, 400);
  return json({ country, code, locked: true });
});
