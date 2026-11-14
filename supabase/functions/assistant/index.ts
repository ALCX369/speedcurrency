// SpeedCurrency assistant, powered by Claude, streamed live into the app.
// Free & Premium: Claude Haiku 5.5 · Pro: Claude Sonnet 5.5 · live web search with sources.
// Needs the secret ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
import { admin, cors, currentUser } from "../_shared/common.ts";

const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
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

async function liveRates(): Promise<string> {
  try {
    const r = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json", { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    const pick = ["nad", "zar", "eur", "gbp", "bwp", "zmw", "kes", "aed", "cny", "inr", "aud", "cad", "jpy", "tzs", "mur"];
    return `Rates on ${j.date} (1 USD =): ` + pick.filter((c) => j.usd[c]).map((c) => `${c.toUpperCase()} ${Number(j.usd[c]).toFixed(4)}`).join(", ");
  } catch { return "Live rates unavailable right now; say so if a conversion is asked."; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await currentUser(req);
  if (!user) return new Response(JSON.stringify({ error: "Sign in first" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const { chat_id, message, mode = "plan" } = await req.json();
  const text = String(message ?? "").trim().slice(0, 2000);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (obj: unknown) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const fail = (msg: string, extra: Record<string, unknown> = {}) => { send({ type: "error", error: msg, ...extra }); ctrl.close(); };
      try {
        if (!text) return fail("Type your question");
        if (!KEY) return fail("Claude isn't connected yet. Add the ANTHROPIC_API_KEY secret in Supabase.");
        const db = admin();
        const { data: p } = await db.from("profiles").select("*").eq("id", user.id).single();
        const paid = p && ["premium", "pro"].includes(p.plan) && p.premium_until && new Date(p.premium_until) > new Date();
        const tier = paid ? (p.plan as "premium" | "pro") : "free";
        const cfg = PLANS[tier];

        const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
        const { count } = await db.from("planner_messages").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).eq("role", "user").gte("created_at", monthStart.toISOString());
        let usedTokens = false;
        if ((count ?? 0) >= cfg.limit) {
          const { data: bal } = await db.from("token_ledger").select("delta").eq("user_id", user.id);
          const balance = (bal ?? []).reduce((a: number, r: { delta: number }) => a + r.delta, 0);
          if (balance < EXTRA_COST) {
            return fail(`You've used your ${cfg.limit} questions this month. Upgrade your plan or invite friends to earn tokens (${EXTRA_COST} tokens = 1 extra question).`, { upgrade: true });
          }
          usedTokens = true;
        }

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
        send({ type: "start", chat_id: chatId, model: cfg.model, tier });

        const { data: hist } = await db.from("planner_messages").select("role, content").eq("chat_id", chatId)
          .order("created_at", { ascending: false }).limit(10);
        const history = ((hist ?? []) as { role: string; content: string }[]).reverse()
          .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
        // the API needs alternating turns starting with the user
        while (history.length && history[0].role !== "user") history.shift();

        const today = new Date().toISOString().slice(0, 10);
        const passport = p?.passport_country || p?.home_country || "unknown";
        const expiry = p?.passport_expiry ? `Passport expires ${p.passport_expiry}.` : "Passport expiry not given.";
        const system = `You are the SpeedCurrency travel assistant, a premium travel companion. Today is ${today}.
Traveller: ${p?.display_name || "traveller"}; home country (where the account was created): ${p?.home_country || "unknown"}; passport issued by: ${passport}; ${expiry}
Lives in: ${p?.residential_address || "not given"}. Preferred currency: ${p?.preferred_currency || "not set"}. Plan: ${tier}.
${await liveRates()}
Task: ${MODES[mode] ?? MODES.plan}
Rules: search the web for anything current (entry rules, prices, opening times, reviews, agents). Never invent prices, reviews, phone numbers or rules; if you can't confirm something, say so and name the official source. Warn if the passport expires within 6 months of travel. Keep answers practical and skimmable: short intro, then sections with "## " headings (e.g. Documents, Recommended agents, Places & reviews, Costs, Next steps), bullet points with "- ", bold with **. No tables. Do not give legal or financial advice beyond general information.`;

        const body = {
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

        let answer = "";
        const sources: { title: string; url: string }[] = [];
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

        const data = { format: "markdown", sources: sources.slice(0, 15), model: cfg.model, mode };
        await db.from("planner_messages").insert([
          { chat_id: chatId, user_id: user.id, role: "user", content: text },
          { chat_id: chatId, user_id: user.id, role: "assistant", content: answer || "No answer.", data },
        ]);
        await db.from("planner_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
        if (usedTokens) await db.from("token_ledger").insert({ user_id: user.id, delta: -EXTRA_COST, reason: "Extra AI question", ref_id: chatId });
        send({ type: "done", chat_id: chatId, used: (count ?? 0) + 1, limit: cfg.limit, sources: data.sources });
        ctrl.close();
      } catch (e) {
        fail(e instanceof Error ? e.message : "Something went wrong");
      }
    },
  });

  return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
});
