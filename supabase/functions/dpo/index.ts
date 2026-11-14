// Premium payments through DPO Pay (API v6).
//   POST {action:"start", plan:"monthly"|"yearly"} -> {url}   (sends the user to DPO's secure payment page)
//   POST {action:"verify", token}                  -> {premium_until}
// Needs DPO_COMPANY_TOKEN and DPO_SERVICE_TYPE from your DPO merchant account.
import { admin, cors, currentUser, json } from "../_shared/common.ts";

const COMPANY = Deno.env.get("DPO_COMPANY_TOKEN") ?? "";
const SERVICE = Deno.env.get("DPO_SERVICE_TYPE") ?? "";
const API = Deno.env.get("DPO_API_URL") ?? "https://secure.3gdirectpay.com/API/v6/";
const PAY_PAGE = Deno.env.get("DPO_PAY_URL") ?? "https://secure.3gdirectpay.com/payv2.php?ID=";
const APP_URL = Deno.env.get("APP_URL") ?? "https://alcx369.github.io/speedcurrency/app/";
const PRICES: Record<string, { amount: number; days: number; label: string }> = {
  monthly: { amount: Number(Deno.env.get("PRICE_MONTHLY") ?? 129), days: 31, label: "SpeedCurrency Premium – 1 month" },
  yearly: { amount: Number(Deno.env.get("PRICE_YEARLY") ?? 1099), days: 366, label: "SpeedCurrency Premium – 1 year" },
};

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? "";

async function call(xml: string) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/xml" }, body: xml, signal: AbortSignal.timeout(30000) });
  return await r.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!COMPANY || !SERVICE) return json({ error: "Payments open as soon as DPO approves the merchant account." }, 503);
  const user = await currentUser(req);
  if (!user) return json({ error: "Sign in first" }, 401);
  const db = admin();
  const body = await req.json();

  if (body.action === "start") {
    const p = PRICES[body.plan];
    if (!p) return json({ error: "Unknown plan" }, 400);
    const { data: pay, error } = await db.from("payments")
      .insert({ user_id: user.id, plan: body.plan, amount: p.amount, currency: "NAD" }).select("id").single();
    if (error) return json({ error: error.message }, 400);
    const now = new Date();
    const date = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const xml = `<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${esc(COMPANY)}</CompanyToken><Request>createToken</Request>
<Transaction><PaymentAmount>${p.amount.toFixed(2)}</PaymentAmount><PaymentCurrency>NAD</PaymentCurrency><CompanyRef>${pay.id}</CompanyRef>
<RedirectURL>${esc(APP_URL + "?paid=1")}</RedirectURL><BackURL>${esc(APP_URL + "?cancelled=1")}</BackURL>
<customerEmail>${esc(user.email ?? "")}</customerEmail></Transaction>
<Services><Service><ServiceType>${esc(SERVICE)}</ServiceType><ServiceDescription>${esc(p.label)}</ServiceDescription><ServiceDate>${date}</ServiceDate></Service></Services></API3G>`;
    const res = await call(xml);
    const token = tag(res, "TransToken");
    if (tag(res, "Result") !== "000" || !token) return json({ error: tag(res, "ResultExplanation") || "DPO could not start the payment" }, 502);
    await db.from("payments").update({ trans_token: token }).eq("id", pay.id);
    return json({ url: PAY_PAGE + encodeURIComponent(token) });
  }

  if (body.action === "verify") {
    const token = String(body.token ?? "");
    const { data: pay } = await db.from("payments").select("*").eq("trans_token", token).eq("user_id", user.id).single();
    if (!pay) return json({ error: "Payment not found" }, 404);
    if (pay.status === "paid") return json({ ok: true });
    const res = await call(`<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${esc(COMPANY)}</CompanyToken><Request>verifyToken</Request><TransactionToken>${esc(token)}</TransactionToken></API3G>`);
    if (tag(res, "Result") !== "000") return json({ ok: false, status: tag(res, "ResultExplanation") || "Not paid yet" });
    const { data: prof } = await db.from("profiles").select("premium_until").eq("id", user.id).single();
    const base = prof?.premium_until && new Date(prof.premium_until) > new Date() ? new Date(prof.premium_until) : new Date();
    base.setUTCDate(base.getUTCDate() + PRICES[pay.plan].days);
    await db.from("payments").update({ status: "paid" }).eq("id", pay.id);
    await db.from("profiles").update({ plan: "premium", premium_until: base.toISOString() }).eq("id", user.id);
    return json({ ok: true, premium_until: base.toISOString() });
  }
  return json({ error: "Unknown action" }, 400);
});
