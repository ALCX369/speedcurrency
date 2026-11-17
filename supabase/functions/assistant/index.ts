// SpeedCurrency assistant, streamed live into the app.
// With ANTHROPIC_API_KEY: Claude (Haiku 5.5 / Sonnet 5.5 on Pro) with live web search.
// Otherwise with GEMINI_API_KEY: Google Gemini free tier, plus recent news headlines and Wikipedia as live context.
import { admin, cors, currentUser } from "../_shared/common.ts";

const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GKEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GMODELS = (Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite,gemini-2.5-flash,gemini-3.8-flash").split(",").map((x) => x.trim()).filter(Boolean);

// Recent headlines for the question (free Bing News RSS) so Gemini answers can cite current links.
async function newsContext(q: string): Promise<{ title: string; url: string; source: string; date: string }[]> {
  const words = q.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 7).join(" ");
  if (!words) return [];
  try {
    // Bing News RSS answers quickly from our servers (Google News times out there).
    const r = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(words)}&format=rss&cc=NA&setlang=en`, { headers: { "User-Agent": "Mozilla/5.0 SpeedCurrency/1.0" }, signal: AbortSignal.timeout(3500) });
    if (!r.ok) return [];
    const xml = await r.text();
    const dec = (x: string) => x.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    const tag = (it: string, t: string) => dec((it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) ?? [])[1] ?? "");
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map(([, it]) => {
      const link = tag(it, "link"); const real = (link.match(/[?&]url=([^&]+)/) ?? [])[1];
      const url = real ? decodeURIComponent(real) : link;
      let source = tag(it, "News:Source"); if (!source) { try { source = new URL(url).hostname.replace(/^www\./, ""); } catch { source = "News"; } }
      return { title: tag(it, "title"), url, source, date: tag(it, "pubDate").slice(5, 16) };
    }).filter((x) => x.title && x.url.startsWith("https://"));
  } catch { return []; }
}
// Free encyclopedia background for the place in the question (Wikipedia, no key).
async function wikiContext(q: string): Promise<{ title: string; extract: string; url: string } | null> {
  try {
    const words = q.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 6).join(" ");
    if (!words) return null;
    const s = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(words)}&srlimit=1&format=json`, { headers: { "User-Agent": "SpeedCurrency/1.0 (gmega.url@gmail.com)" }, signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    const title = s?.query?.search?.[0]?.title;
    if (!title) return null;
    const p = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { "User-Agent": "SpeedCurrency/1.0 (gmega.url@gmail.com)" }, signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    if (!p?.extract) return null;
    return { title, extract: String(p.extract).slice(0, 1400), url: p.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
  } catch { return null; }
}
const PLANS = {
  free: { model: Deno.env.get("MODEL_FREE") ?? "claude-haiku-5-5", limit: Number(Deno.env.get("LIMIT_FREE") ?? 3), searches: 2, maxTokens: 1500 },
  premium: { model: Deno.env.get("MODEL_PREMIUM") ?? "claude-haiku-5-5", limit: Number(Deno.env.get("LIMIT_PREMIUM") ?? 60), searches: 3, maxTokens: 2000 },
  pro: { model: Deno.env.get("MODEL_PRO") ?? "claude-sonnet-5-5", limit: Number(Deno.env.get("LIMIT_PRO") ?? 120), searches: 5, maxTokens: 3000 },
};
const EXTRA_COST = Number(Deno.env.get("TOKENS_PER_EXTRA_QUESTION") ?? 5);

const MODES: Record<string, string> = {
  plan: "Help plan the traveller's next move: where to go, what it costs, the entry documents their passport needs, recommended travel agents or official offices, places to stay/eat/see with what reviewers say, and a short day plan.",
  money: "Help with money abroad: currency conversion using the live rates given, typical daily costs at the destination, cash vs card, fees, and budgeting. Show calculations clearly.",
  journal: "Help the traveller journal: turn their notes into a vivid story of at most 528 characters, suggest a title, captions for photos, and a short packing or memory checklist if useful.",
};
// Chat "Make it a story": rewrite a rough chat message, no web search, plain text only.
const POLISH_SYSTEM = "Rewrite the traveller's rough chat message into a short, warm, vivid travel story they will send to a friend in a chat. Keep every fact, name and place they gave; invent nothing. First person, plain text, no headings, no lists, no hashtags, at most 400 characters. Reply with the rewritten message only.";

let ratesCache = { at: 0, text: "" };
async function liveRates(): Promise<string> {
  if (ratesCache.text && Date.now() - ratesCache.at < 3600_000) return ratesCache.text;
  try {
    const r = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json", { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    const pick = ["nad", "zar", "eur", "gbp", "bwp", "zmw", "kes", "aed", "cny", "inr", "aud", "cad", "jpy", "tzs", "mur"];
    const text = `Rates on ${j.date} (1 USD =): ` + pick.filter((c) => j.usd[c]).map((c) => `${c.toUpperCase()} ${Number(j.usd[c]).toFixed(4)}`).join(", ");
    ratesCache = { at: Date.now(), text };
    return text;
  } catch { return "Live rates unavailable right now; say so if a conversion is asked."; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await currentUser(req);
  if (!user) return new Response(JSON.stringify({ error: "Sign in first" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const { chat_id, message, mode = "plan" } = await req.json().catch(() => ({}));
  const polish = mode === "polish";
  const text = String(message ?? "").trim().slice(0, polish ? 1000 : 2000);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      let sentText = false; // once answer text has reached the user, a failure no longer refunds
      const send = (obj: { type: string; [k: string]: unknown }) => { if (obj.type === "text") sentText = true; ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)); };
      let spent = false; // tokens already taken for this question
      const fail = (msg: string, extra: Record<string, unknown> = {}) => {
        // give the tokens back if the answer failed after we took them
        if (spent && !sentText) { spent = false; admin().from("token_ledger").insert({ user_id: user.id, delta: EXTRA_COST, reason: "Refund: question failed" }).then(() => {}, () => {}); }
        send({ type: "error", error: msg, ...extra }); ctrl.close();
      };
      try {
        if (!text) return fail("Type your question");
        if (!KEY && !GKEY) return fail("The assistant isn't connected yet. Add the GEMINI_API_KEY or ANTHROPIC_API_KEY secret in Supabase.");
        const db = admin();
        const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
        const [{ data: p }, { count }, { data: adminRow }] = await Promise.all([
          db.from("profiles").select("*").eq("id", user.id).single(),
          db.from("planner_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").gte("created_at", monthStart.toISOString()),
          db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
        ]);
        const unlimited = !!adminRow; // the owner's admin account has no monthly question limit
        const paid = p && ["premium", "pro"].includes(p.plan) && p.premium_until && new Date(p.premium_until) > new Date();
        const tier = unlimited ? "pro" : paid ? (p.plan as "premium" | "pro") : "free";
        const cfg = PLANS[tier];

        if (!unlimited && (count ?? 0) >= cfg.limit) {
          // Take the tokens now, under a database lock, so two questions at once can't spend the same tokens.
          const { error: spendErr } = await db.rpc("_spend_tokens", { uid: user.id, amount: EXTRA_COST, why: "Extra AI question", ref: null });
          if (spendErr) {
            return fail(`You've used your ${cfg.limit} questions this month. Upgrade your plan or invite friends to earn tokens (${EXTRA_COST} tokens = 1 extra question).`, { upgrade: true });
          }
          spent = true;
        }

        let chatId = chat_id as string | undefined;
        if (chatId) {
          const { data: c } = await db.from("planner_chats").select("id").eq("id", chatId).eq("user_id", user.id).single();
          if (!c) chatId = undefined;
        }
        if (!chatId && polish) {
          const { data: c } = await db.from("planner_chats").select("id").eq("user_id", user.id).eq("title", "Story helper").limit(1).maybeSingle();
          if (c) chatId = c.id;
        }
        if (!chatId) {
          const { data: c, error } = await db.from("planner_chats").insert({ user_id: user.id, title: polish ? "Story helper" : text.slice(0, 60) }).select("id").single();
          if (error) throw error;
          chatId = c.id;
        }
        // Paid members get Claude with live web search (billed to the owner's Anthropic account, never shown to users).
        // Free members use free Gemini with a research step. If only one key exists, everyone uses that one.
        const useGemini = !KEY || (tier === "free" && !!GKEY);
        send({ type: "start", chat_id: chatId, model: useGemini ? GMODELS[0] : cfg.model, tier });

        // Story helper needs no history or live rates: skip both lookups to answer faster.
        const { data: hist } = polish ? { data: [] } : await db.from("planner_messages").select("role, content").eq("chat_id", chatId)
          .order("created_at", { ascending: false }).limit(10);
        const history = ((hist ?? []) as { role: string; content: string }[]).reverse()
          .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
        // the API needs alternating turns starting with the user
        while (history.length && history[0].role !== "user") history.shift();

        const today = new Date().toISOString().slice(0, 10);
        const nationality = p?.nationality || p?.home_country || "unknown";
        const system = `You are the SpeedCurrency travel assistant, a premium travel companion. Today is ${today}.
Traveller: ${p?.display_name || "traveller"}; home country (where the account was created): ${p?.home_country || "unknown"}; nationality: ${nationality}.
Lives in: ${p?.residential_address || "not given"}. Preferred currency: ${p?.preferred_currency || "not set"}. Plan: ${tier}.
${polish ? "" : await liveRates()}
Task: ${MODES[mode] ?? MODES.plan}
Coverage: SpeedCurrency covers travel in Namibia and South Africa. Keep places, plans and recommendations inside these two countries; if asked about another destination, say the app currently covers Namibia and South Africa and give only brief general pointers. Currency questions may involve any currency in the world.
Rules: search the web for anything current (entry rules, prices, opening times, reviews, agents). Never invent prices, reviews, phone numbers or rules; if you can't confirm something, say so and name the official source. Remind the traveller that many countries require a passport valid for 6 months after arrival. Keep answers practical and skimmable: short intro, then sections with "## " headings (e.g. Documents, Recommended agents, Places & reviews, Costs, Next steps), bullet points with "- ", bold with **. No tables. Do not give legal or financial advice beyond general information.`;

        let answer = "";
        const sources: { title: string; url: string }[] = [];
        let usedModel = cfg.model;

        if (useGemini) {
          if (!polish) send({ type: "search", query: text.slice(0, 80) });
          const [news, wiki] = polish ? [[], null] : await Promise.all([newsContext(text), wikiContext(text)]);
          for (const n of news) sources.push({ title: `${n.title} (${n.source}, ${n.date})`, url: n.url });
          if (wiki) sources.push({ title: `${wiki.title} – Wikipedia`, url: wiki.url });
          if (sources.length) send({ type: "sources", sources });
          const gsystem = polish ? POLISH_SYSTEM : system.replace("Rules: search the web for anything current", "Rules: you cannot browse; use the recent headlines below when relevant and cite them as [1], [2]. For anything current")
            + (news.length ? "\nRecent headlines (last 60 days):\n" + news.map((n, i) => `[${i + 1}] ${n.title} – ${n.source}, ${n.date}`).join("\n") : "\nNo recent headlines were found for this question.")
            + (wiki ? `\nBackground (Wikipedia: ${wiki.title}) [${news.length + 1}]: ${wiki.extract}` : "")
            + "\nWrite warmly and personally, like a friendly local guide, but stay factual."
            + "\nAlways end with an 'Official sources to check' section naming the embassy, immigration, park or tourism office the traveller should confirm with.";
          const contents = [...(polish ? [] : history), { role: "user", content: text }].map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
          // Try each model; if one is busy (429/500/503), unknown (404/400) or too slow, move on to the next.
          let gr: Response | null = null;
          for (const m of GMODELS) {
            send({ type: "search", query: "Writing your answer…" });
            // Give each model 15 s to start answering; once it starts, let the full answer stream.
            const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 15000);
            try {
              gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`, {
                method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": GKEY },
                body: JSON.stringify({ systemInstruction: { parts: [{ text: gsystem }] }, contents, generationConfig: { maxOutputTokens: cfg.maxTokens * 2, temperature: 0.6 } }),
                signal: ac.signal,
              });
            } catch (_e) { gr = null; continue; } finally { clearTimeout(timer); }
            if (gr.ok) { usedModel = m; break; }
            if (![400, 404, 429, 500, 503].includes(gr.status)) break;
          }
          if (!gr || !gr.ok || !gr.body) {
            const st = gr?.status ?? 0; const err = gr ? await gr.text() : "";
            return fail(st === 429 ? "The free AI is very busy or today's free limit is used up. Please try again in a few minutes." : st === 403 || st === 401 ? "The Gemini key was refused. Check the GEMINI_API_KEY secret." : st === 503 || st === 500 || st === 0 ? "The AI is busy right now. Please try again in a minute." : `AI error ${st}`, { detail: err.slice(0, 300) });
          }
          const reader = gr.body.getReader(); const dec = new TextDecoder(); let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
              if (!line.startsWith("data: ")) continue;
              let ev; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
              const t = (ev.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string; thought?: boolean }) => (x.thought ? "" : x.text ?? "")).join("");
              if (t) { answer += t; send({ type: "text", text: t }); }
            }
          }
        } else {
        const body = polish
          ? { model: cfg.model, max_tokens: 500, stream: true, system: POLISH_SYSTEM, messages: [{ role: "user", content: text }] }
          : {
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          stream: true,
          system,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: cfg.searches,
            ...(p?.home_country_code ? { user_location: { type: "approximate", country: p.home_country_code } } : {}) }],
          messages: [...history, { role: "user", content: text }],
        };
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify(body),
        });
        if (!r.ok || !r.body) {
          const err = await r.text();
          return fail(r.status === 429 || r.status === 529 ? "Claude is busy right now. Try again in a moment." : `Claude error ${r.status}`, { detail: err.slice(0, 300) });
        }

        const blocks: Record<number, { type: string; json: string }> = {};
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let ev; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
            if (ev.type === "content_block_start") {
              const cb = ev.content_block;
              blocks[ev.index] = { type: cb.type, json: "" };
              if (cb.type === "web_search_tool_result" && Array.isArray(cb.content)) {
                for (const s of cb.content) if (s.url && !sources.find((x) => x.url === s.url)) sources.push({ title: s.title || s.url, url: s.url });
                send({ type: "sources", sources });
              }
            } else if (ev.type === "content_block_delta") {
              const d = ev.delta;
              if (d.type === "text_delta") { answer += d.text; send({ type: "text", text: d.text }); }
              else if (d.type === "input_json_delta" && blocks[ev.index]) blocks[ev.index].json += d.partial_json;
              else if (d.type === "citations_delta" && d.citation?.url && !sources.find((x) => x.url === d.citation.url)) {
                sources.push({ title: d.citation.title || d.citation.url, url: d.citation.url }); send({ type: "sources", sources });
              }
            } else if (ev.type === "content_block_stop" && blocks[ev.index]?.type === "server_tool_use") {
              try { send({ type: "search", query: JSON.parse(blocks[ev.index].json || "{}").query }); } catch { /* ignore */ }
            } else if (ev.type === "error") {
              return fail("Claude stopped unexpectedly. Try again.");
            }
          }
        }

        }

        const data = { format: "markdown", sources: sources.slice(0, 15), model: usedModel, mode };
        await db.from("planner_messages").insert([
          { chat_id: chatId, user_id: user.id, role: "user", content: text },
          { chat_id: chatId, user_id: user.id, role: "assistant", content: answer || "No answer.", data },
        ]);
        await db.from("planner_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
        spent = false; // answer delivered: the tokens stay spent
        send({ type: "done", chat_id: chatId, used: (count ?? 0) + 1, limit: cfg.limit, sources: data.sources });
        ctrl.close();
      } catch (e) {
        fail(e instanceof Error ? e.message : "Something went wrong");
      }
    },
  });

  return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
});
