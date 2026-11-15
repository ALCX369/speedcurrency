// Updates newspaper: recent news for a place, from Google News RSS (free, no key).
// Results are cached in the news_cache table so the same search is fetched at most every 2 hours.
import { admin, cors, currentUser, json } from "../_shared/common.ts";

const TOPICS: Record<string, string> = {
  all: "",
  travel: "(tourism OR travel OR lodge OR safari OR park OR festival)",
  events: "(event OR festival OR concert OR show OR expo OR market)",
  sport: "(sport OR football OR rugby OR cricket OR marathon OR cycling OR boxing)",
  business: "(business OR economy OR prices OR fuel OR investment OR jobs)",
  food: "(restaurant OR food OR cafe OR dining)",
  roads: "(road OR roads OR traffic OR border OR flights OR airport)",
  weather: "(weather OR rain OR flood OR drought OR heat)",
};
// Namibian newspapers, broadcasters and travel magazines (used by the "Namibian press" source)
const NA_SITES = [
  "namibian.com.na", "observer24.com.na", "neweralive.na", "nbcnews.na", "informante.web.na", "thebrief.com.na",
  "az.com.na", "republikein.com.na", "nampa.org", "travelnewsnamibia.com", "economist.com.na", "futuremedia.com.na",
];
const CACHE_MS = 2 * 60 * 60 * 1000;
const GKEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GMODELS = (Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash,gemini-3.5-flash-lite,gemini-2.5-flash").split(",").map((x) => x.trim()).filter(Boolean);

// Premium/Pro: a short, friendly AI summary of the headlines (free Gemini), cached with the news.
async function makeBrief(place: string, items: { title: string; source: string; published: string }[]): Promise<string> {
  if (!GKEY || !items.length) return "";
  const prompt = `Write a warm, upbeat "Quick brief" for a traveller interested in ${place}, in a friendly local-guide tone, in 3 to 4 short bullet points starting with "- " and one fitting emoji each. Only use facts from these headlines; don't invent details. Finish with one line starting "Tip:" with a practical suggestion.\n\n` +
    items.slice(0, 12).map((x) => `- ${x.title} (${x.source}, ${x.published.slice(0, 10)})`).join("\n");
  for (const m of GMODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": GKEY },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 600, temperature: 0.7 } }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404 || r.status === 400) continue;
      if (!r.ok) return "";
      const j = await r.json();
      return (j.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string; thought?: boolean }) => (x.thought ? "" : x.text ?? "")).join("").trim().slice(0, 1500);
    } catch { return ""; }
  }
  return "";
}

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
const tag = (xml: string, t: string) => decode((xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) ?? [])[1] ?? "");

function parse(xml: string) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const source = tag(it, "source");
    let title = tag(it, "title");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    const link = tag(it, "link");
    const sourceUrl = (it.match(/<source[^>]*url="([^"]+)"/) ?? [])[1] ?? "";
    return { title, link, source, sourceUrl, published: new Date(tag(it, "pubDate")).toISOString() };
  }).filter((x) => x.title && /^https:\/\//.test(x.link) && !Number.isNaN(Date.parse(x.published)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const user = await currentUser(req);
  if (!user) return json({ error: "Sign in first" }, 401);

  const body = await req.json().catch(() => ({}));
  const place = String(body.place ?? "").replace(/[^\p{L}\p{N} ,.'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const topic = TOPICS[body.topic] !== undefined ? String(body.topic) : "all";
  const days = Math.min(Math.max(Math.round(Number(body.days) || 30), 1), 3650);
  const source = body.source === "namibia" ? "namibia" : "all";
  const country = /^[A-Z]{2}$/.test(String(body.country ?? "")) ? String(body.country) : "NA";
  if (place.length < 2) return json({ error: "Type a place" }, 400);

  const parts = [`"${place}"`];
  if (TOPICS[topic]) parts.push(TOPICS[topic]);
  if (source === "namibia") parts.push("(" + NA_SITES.map((s) => "site:" + s).join(" OR ") + ")");
  if (days <= 365) parts.push(`when:${days}d`);
  else parts.push("after:" + new Date(Date.now() - days * 864e5).toISOString().slice(0, 10));
  const q = parts.join(" ");
  const key = `${country}|${q}`;

  const db = admin();
  const wantBrief = body.brief === true;
  let paid = false;
  if (wantBrief) {
    const { data: p } = await db.from("profiles").select("plan, premium_until").eq("id", user.id).single();
    paid = !!p && ["premium", "pro"].includes(p.plan) && !!p.premium_until && new Date(p.premium_until) > new Date();
  }
  const withBrief = async (items: { title: string; source: string; published: string }[], fresh: boolean) => {
    if (!wantBrief || !paid) return {};
    const bkey = "brief|" + key;
    const { data: b } = await db.from("news_cache").select("data, fetched_at").eq("key", bkey).maybeSingle();
    if (b && !fresh && Date.now() - Date.parse(b.fetched_at) < CACHE_MS) return { brief: (b.data as { text?: string })?.text ?? "" };
    const text = await makeBrief(place, items);
    if (text) await db.from("news_cache").upsert({ key: bkey, data: { text }, fetched_at: new Date().toISOString() });
    return { brief: text };
  };
  const { data: cached } = await db.from("news_cache").select("data, fetched_at").eq("key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_MS) return json({ items: cached.data, fetched_at: cached.fetched_at, cached: true, ...(await withBrief(cached.data, false)) });

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-${country}&gl=${country}&ceid=${country}:en`;
  let items: ReturnType<typeof parse> = [];
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 SpeedCurrency/1.0" }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error(String(r.status));
    items = parse(await r.text());
  } catch (_e) {
    if (cached) return json({ items: cached.data, fetched_at: cached.fetched_at, cached: true, stale: true });
    return json({ error: "News is not reachable right now. Try again in a minute." }, 502);
  }
  const since = Date.now() - days * 864e5 - 864e5;
  const seen = new Set<string>();
  items = items.filter((x) => Date.parse(x.published) >= since)
    .filter((x) => { const k = x.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).slice(0, 40);
  const fetched_at = new Date().toISOString();
  await db.from("news_cache").upsert({ key, data: items, fetched_at });
  return json({ items, fetched_at, cached: false, ...(await withBrief(items, true)) });
});
