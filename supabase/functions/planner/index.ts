// AI trip planner: free Gemini model + free Tavily web search.
// 1) Gemini writes up to 2 search queries  2) Tavily searches the web  3) Gemini answers ONLY from those results.
// Every answer is saved to the user's planner history with its source links.
import { admin, cors, currentUser, isPremium, json } from "../_shared/common.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const FREE_LIMIT = Number(Deno.env.get("FREE_PLANS_PER_MONTH") ?? 3);
const PREMIUM_LIMIT = Number(Deno.env.get("PREMIUM_PLANS_PER_MONTH") ?? 40);

type Msg = { role: string; content: string };
type Result = { title: string; url: string; content: string };

async function gemini(system: string, contents: unknown[], schemaHint: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system + "\n\nReply with JSON only, in this shape:\n" + schemaHint }] },
      contents,
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (r.status === 429) throw new Error("The free AI quota is busy. Wait a minute and try again.");
  if (!r.ok) throw new Error(`AI error ${r.status}`);
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "{}";
  try { return JSON.parse(text); } catch { return JSON.parse(text.replace(/^```json|```$/g, "")); }
}

async function search(query: string): Promise<Result[]> {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_KEY}` },
    body: JSON.stringify({ query, max_results: 6, search_depth: "basic", include_answer: false }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.results ?? []).map((x: Result) => ({ title: x.title, url: x.url, content: String(x.content ?? "").slice(0, 900) }));
}

const ANSWER_SHAPE = `{
 "summary": "2-4 sentence answer in plain words",
 "itinerary": [{"day": "Day 1", "plan": "..."}],
 "documents": [{"item": "e.g. Visa / passport validity / yellow fever", "status": "required|not required|check", "detail": "...", "source": 1}],
 "agents": [{"name": "travel agent, tour operator or official office", "why": "...", "contact": "website or phone if found", "source": 2}],
 "places": [{"name": "...", "type": "stay|eat|see|car|other", "price": "if found", "reviews": "what reviewers say, short", "source": 3}],
 "costs": [{"item": "...", "amount": "with currency", "source": 4}],
 "next_steps": ["..."],
 "follow_up": "one short question to ask the traveller, or empty"
}
"source" is the number of the search result you used. Use [] for any section that does not apply.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!GEMINI_KEY || !TAVILY_KEY) return json({ error: "Planner keys are not set up yet." }, 503);
    const user = await currentUser(req);
    if (!user) return json({ error: "Sign in to use the planner" }, 401);

    const { chat_id, message } = await req.json();
    const text = String(message ?? "").trim().slice(0, 1200);
    if (!text) return json({ error: "Type your question" }, 400);

    const db = admin();
    const { data: profile } = await db.from("profiles").select("plan, premium_until, home_country").eq("id", user.id).single();
    const premium = isPremium(profile);
    const limit = premium ? PREMIUM_LIMIT : FREE_LIMIT;

    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { count } = await db.from("planner_messages").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("role", "user").gte("created_at", monthStart.toISOString());
    if ((count ?? 0) >= limit) {
      return json({ error: premium ? `You've used all ${limit} plans this month.` : `Free accounts get ${limit} plans a month. Go Premium for ${PREMIUM_LIMIT}.`, upgrade: !premium }, 402);
    }

    // Chat: reuse or create
    let chatId = chat_id as string | undefined;
    if (chatId) {
      const { data: c } = await db.from("planner_chats").select("id").eq("id", chatId).eq("user_id", user.id).single();
      if (!c) chatId = undefined;
    }
    if (!chatId) {
      const { data: c, error } = await db.from("planner_chats").insert({ user_id: user.id, title: text.slice(0, 60) }).select("id").single();
      if (error) throw error;
      chatId = c.id;
    }
    const { data: history } = await db.from("planner_messages").select("role, content").eq("chat_id", chatId)
      .order("created_at", { ascending: false }).limit(8);
    const past = ((history ?? []) as Msg[]).reverse();

    const home = profile?.home_country ?? "unknown";
    const today = new Date().toISOString().slice(0, 10);
    const convo = [...past, { role: "user", content: text }].map((m) => ({
      role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }],
    }));

    // 1) search queries
    const q = await gemini(
      `You plan web searches for a travel planner. Today is ${today}. The traveller's passport/home country is ${home}.`,
      convo, `{"queries": ["max 2 short web search queries that will find current facts: entry/visa rules for a ${home} passport when travel abroad is involved, prices, places and reviews, recommended agents"]}`,
    );
    const queries: string[] = (q.queries ?? []).slice(0, 2).map((s: string) => String(s).slice(0, 200));
    if (!queries.length) queries.push(text.slice(0, 200));

    // 2) search
    const results: Result[] = [];
    for (const query of queries) for (const r of await search(query)) if (!results.find((x) => x.url === r.url)) results.push(r);
    const numbered = results.slice(0, 10).map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join("\n\n");

    // 3) answer
    const answer = await gemini(
      `You are SpeedCurrency's travel planner. Today is ${today}. Traveller's passport/home country: ${home}.
Use ONLY the numbered search results below for facts, prices, reviews and agents. If the results don't cover something, say so and suggest the official source to check. Never invent prices, reviews, phone numbers or rules. Prices: keep the currency shown in the source. Be practical and short.

SEARCH RESULTS:
${numbered || "(no results found)"}`,
      convo, ANSWER_SHAPE,
    );

    const sources = results.slice(0, 10).map((r, i) => ({ n: i + 1, title: r.title, url: r.url }));
    const data = { ...answer, sources, queries };
    const content = String(answer.summary ?? "Here's what I found.");

    await db.from("planner_messages").insert([
      { chat_id: chatId, user_id: user.id, role: "user", content: text },
      { chat_id: chatId, user_id: user.id, role: "assistant", content, data },
    ]);
    await db.from("planner_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);

    return json({ chat_id: chatId, content, data, used: (count ?? 0) + 1, limit });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
