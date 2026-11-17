// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Nami: the floating travel buddy. A gold chat button on every screen opens a chat that remembers
// the conversation (same chat on the server + saved on this device), answers clearly and warmly,
// and adds preview chips: in-app links (town guides, converter, safety, news) and the web sources it used.
// Any code can open it with a question: window.scAsk('...').
// Also turns news links into an in-app story sheet: our cover, headline, Listen (read aloud), Explain.
import { newsCover } from './news-cover.js';

export const BOT = 'Nami'; // the assistant's name: change here only
const STYLE = `

(You are ${BOT}, the SpeedCurrency travel assistant for Namibia and South Africa, serving a customer inside the app. Before answering, work out what the traveller really wants: read past spelling mistakes, slang and mixed languages (English, Afrikaans, Oshiwambo, German), and use the earlier messages for context. If the message is unclear or could mean two different things, ask one short clarifying question with two or three options instead of guessing. Sound like a real, friendly person who works at a good hotel front desk: warm, calm and respectful, natural everyday English with contractions, never robotic or scripted. Keep it SHORT: usually 1 to 3 sentences, at most 3 short bullets, under 80 words, unless the traveller asks for detail. Remember what we already talked about and build on it. Give specific names, prices, distances and times. Lead with the answer. Offer more help only when it is genuinely useful. No slang, no emojis, no jokes. Never praise the question or re-introduce yourself, and don't repeat the question. Avoid brochure words (nestled, breathtaking, vibrant, stunning, hidden gem, must-visit, rich culture), filler (it's important to note, in order to, additionally) and closers like "I hope this helps" or "let me know". If you're not sure, say so plainly and suggest how to check. Name towns exactly.)`;
const QUICK = ['Best things to do this weekend', 'Is it safe to drive at night?', 'How much is N$1000 in rand?', 'Where to stay in Swakopmund?'];
const TOWNS = ['Windhoek', 'Swakopmund', 'Walvis Bay', 'Ondangwa', 'Oshakati', 'Rundu', 'Katima Mulilo', 'Lüderitz', 'Keetmanshoop', 'Otjiwarongo', 'Tsumeb', 'Opuwo', 'Sossusvlei', 'Etosha', 'Fish River Canyon',
  'Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Gqeberha', 'Port Elizabeth', 'Stellenbosch', 'Franschhoek', 'Knysna', 'Hermanus', 'Plettenberg Bay', 'George', 'Bloemfontein', 'East London', 'Kruger', 'Addo'];
const APP_LINKS = [ // keywords in the question/answer -> a chip that opens part of the app
  [/currency|convert|exchange|rand|n\$|dollar|zar|nad/i, '💱 Converter', '#/'],
  [/safe|crime|danger|night|police|emergency/i, '🛡 Safety tips', '#/trends'],
  [/trend|popular|summer|december|hot spot|invest|economy/i, '🔥 What’s popping', '#/trends'],
  [/news|event|festival|concert/i, '📰 Local news', '#/updates'],
  [/trip|itinerar|plan /i, '🧳 My trips', '#/trips'],
  [/document|visa|permit|checklist|pack/i, '✅ Ready to go', '#/ready'],
];

// Greetings, thanks and goodbyes get an instant, polite reply (no AI question used).
const GREET = /^(hi+|hello|hey|hallo|howzit|heita|good (morning|afternoon|evening|day)|morning|afternoon|evening|greetings|yo)\b[\s!.,]*(nami|there|sir|madam)?[\s!.,]*$/i;
const THANKS = /^(thanks?( you)?|thank u|thx|cheers|great,? thanks?|ok(ay)?,? thanks?)[\s!.,]*$/i;
const BYE = /^(bye|goodbye|see you|later|that'?s all|no thanks?|nothing else)[\s!.,]*$/i;
const IDLE_MS = 3 * 60 * 1000; // the chat closes after 3 minutes without activity
const smallTalk = (s) => GREET.test(s) || THANKS.test(s) || BYE.test(s);

export function mountFab({ api, esc, md, DEMO, uid, name = '', profileMemory = '' }) {
  document.getElementById('scfab')?.remove(); document.querySelector('.fab-sheet')?.remove(); // a new account gets a fresh Nami
  const KEY = `sc_nami_${uid || 'guest'}`; window.scAskUid = uid;
  const store = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })();
  let chatId = store.chatId || null, log = store.log || [], busy = false;
  let memory = store.memory || profileMemory || ''; // short summary of earlier chats: towns + topics
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ chatId, log: log.slice(-40), memory })); } catch { /* private mode */ } };
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const daypart = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

  // simplified memory: the towns and the last few questions, kept short and saved on the account
  const remember = () => {
    const towns = [...new Set(log.map((m) => m.town).filter(Boolean))].slice(-4);
    const topics = log.filter((m) => m.who === 'me' && !smallTalk(m.text)).slice(-4).map((m) => m.text.replace(/\s+/g, ' ').slice(0, 70));
    if (!towns.length && !topics.length) return;
    const next = `${towns.length ? `Towns: ${towns.join(', ')}. ` : ''}${topics.length ? `Recent questions: ${topics.join(' | ')}.` : ''} (as of ${new Date().toISOString().slice(0, 10)})`.slice(0, 600);
    if (next === memory) return; // nothing new: no save, no server write
    memory = next; save();
    if (!DEMO && uid) api.update('profiles', uid, { nami_memory: memory }).catch(() => {}); // works once update 016 is in
  };
  const welcome = () => { const town = memory.match(/Towns: ([^,.]+)/)?.[1];
    return `${daypart()}${first ? `, ${esc(first)}` : ''}! I'm ${BOT} from SpeedCurrency.` + (town ? ` Good to see you again. Still thinking about ${esc(town)}?` : ' How can I help with your trip today?'); };

  let idle = 0;
  const touch = () => { clearTimeout(idle); idle = setTimeout(() => { if (sheet.hidden) return; bubble('bot', '<span class="muted">This chat was closed after 3 minutes without activity. Your conversation is saved, so you can pick up where you left off any time.</span>'); remember(); setTimeout(close, 1800); }, IDLE_MS); };

  const fab = document.createElement('button');
  fab.id = 'scfab'; fab.type = 'button'; fab.className = 'fab'; fab.setAttribute('aria-label', `Chat with ${BOT}`);
  fab.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
  const sheet = document.createElement('section');
  sheet.className = 'fab-sheet'; sheet.hidden = true; sheet.setAttribute('aria-label', `${BOT}, your travel buddy`);
  sheet.innerHTML = `<div class="fab-top"><span class="fab-who"><span class="fab-av" aria-hidden="true">${BOT[0]}</span><span><b>${BOT}</b><small>Travel assistant · remembers you</small></span></span>
      <span class="row" style="gap:6px"><button type="button" class="fab-new" title="Start a new chat">New</button><button type="button" class="fab-x" aria-label="Close">✕</button></span></div>
    <div class="fab-msgs" aria-live="polite"></div>
    <form class="fab-send"><label class="sr" for="fabin">Message ${BOT}</label><input id="fabin" maxlength="500" placeholder="Ask ${BOT} anything about your trip…" autocomplete="off"><button class="btn small primary">Send</button></form>`;
  document.body.append(fab, sheet);
  const msgs = sheet.querySelector('.fab-msgs'); const inp = sheet.querySelector('#fabin');

  const chipsFor = (q, answer, sources) => {
    const text = q + ' ' + answer; const out = []; const seen = new Set();
    for (const t of TOWNS) if (new RegExp(`\\b${t}\\b`, 'i').test(answer) && out.length < 4) { const name = t === 'Port Elizabeth' ? 'Gqeberha' : t; if (!seen.has(name)) { seen.add(name); out.push(`<a class="fab-chip" href="#/town/${encodeURIComponent(name)}">📖 ${esc(name)} guide</a>`); } }
    for (const [re, label, href] of APP_LINKS) if (re.test(text) && !seen.has(label)) { seen.add(label); out.push(`<a class="fab-chip" href="${href}">${label}</a>`); }
    for (const s of (sources || []).slice(0, 3)) { try { const h = new URL(s.url).hostname.replace(/^www\./, ''); out.push(`<a class="fab-chip web" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || h)}">🔎 ${esc(h)}</a>`); } catch { /* skip bad url */ } }
    if (!sources?.length && answer) out.push(`<a class="fab-chip web" href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer">🔎 Search the web</a>`);
    return out.length ? `<div class="fab-chips">${out.join('')}</div>` : '';
  };
  const bubble = (who, html) => { const d = document.createElement('div'); d.className = 'fab-msg ' + who; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
  const paintLog = () => {
    msgs.innerHTML = '';
    if (!log.length) {
      bubble('bot', welcome());
      msgs.insertAdjacentHTML('beforeend', `<div class="fab-quick">${QUICK.map((q) => `<button type="button" class="chip">${esc(q)}</button>`).join('')}</div>`);
    }
    for (const m of log) bubble(m.who, m.who === 'me' ? esc(m.text) : md(m.text, m.sources || []) + chipsFor(m.q || '', m.text, m.sources));
  };

  const open = () => { if (!msgs.childElementCount) paintLog(); sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open')); fab.setAttribute('aria-expanded', 'true'); setTimeout(() => inp.focus(), 50); touch(); };
  const close = () => { clearTimeout(idle); remember(); sheet.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); setTimeout(() => { sheet.hidden = true; }, 220); };

  const ask = async (q) => {
    if (!q || busy) return; busy = true; touch();
    sheet.querySelector('.fab-quick')?.remove();
    bubble('me', esc(q)); log.push({ who: 'me', text: q });
    // polite instant replies for greetings, thanks and goodbyes
    const quick = GREET.test(q) ? welcome() : THANKS.test(q) ? `You're welcome${first ? `, ${esc(first)}` : ''}. Is there anything else I can help you with?`
      : BYE.test(q) ? `Thank you for chatting with ${BOT}. Have a safe and wonderful trip${first ? `, ${esc(first)}` : ''}. I'm here whenever you need me.` : '';
    if (quick) {
      bubble('bot', quick); log.push({ who: 'bot', text: quick.replace(/<[^>]+>/g, ''), q, local: true });
      busy = false; save(); if (BYE.test(q)) setTimeout(close, 2500); return;
    }
    const out = bubble('bot', '<span class="fab-dots" aria-label="' + BOT + ' is typing"><i></i><i></i><i></i></span>');
    let acc = '', sources = [], raf = 0;
    // 1) the app's own knowledge first: FAQ + town guides (nami-faq.js). 2) live assistant + web for anything current.
    try {
      const faq = await import('./nami-faq.js');
      const lastTown = [...log].reverse().find((m) => m.town)?.town || null;
      const loc = await faq.answerLocal(q, lastTown);
      if (loc) {
        const srcChip = loc.url ? `<a class="fab-chip web" href="${esc(loc.url)}" target="_blank" rel="noopener noreferrer">📚 ${esc(loc.src)}</a>` : `<span class="fab-chip web">📚 ${esc(loc.src)}</span>`;
        const chips = chipsFor(q, loc.text + (loc.town ? ' ' + loc.town : ''), []).replace(/<a class="fab-chip web" href="https:\/\/www\.google[^>]*>[^<]*<\/a>/, '');
        out.innerHTML = md(loc.text, []) + (chips ? chips.replace('<div class="fab-chips">', `<div class="fab-chips">${srcChip}`) : `<div class="fab-chips">${srcChip}</div>`);
        log.push({ who: 'bot', text: loc.text, q, town: loc.town, local: true, src: loc.src });
        busy = false; save(); msgs.scrollTop = msgs.scrollHeight; return;
      }
    } catch { /* fall through to the live assistant */ }
    const paint = () => { raf = 0; out.innerHTML = md(acc, sources); msgs.scrollTop = msgs.scrollHeight; };
    try {
      if (DEMO) throw new Error(`${BOT} chats once you are signed in online.`);
      const H = await import('./here.js').then((m) => m.here()).catch(() => ({}));
      const where = H.town ? `\n(The traveller is near ${H.town}${H.country ? ', ' + H.country : ''} right now.)` : H.country ? `\n(The traveller is in ${H.country} right now.)` : '';
      const mem = memory ? `\n(What you remember about this traveller from earlier chats: ${memory})` : '';
      await api.askStream(chatId, q + where + mem + STYLE, 'plan', (ev) => {
        if (ev.type === 'start') { chatId = ev.chat_id; save(); }
        if (ev.type === 'search') out.innerHTML = `<span class="muted">🔎 Looking up ${esc(ev.query || 'the web')}…</span>`;
        if (ev.type === 'text') { acc += ev.text; if (!raf) raf = requestAnimationFrame(paint); }
        if (ev.type === 'sources') sources = ev.sources || [];
        if (ev.type === 'done' && ev.data?.sources) sources = ev.data.sources;
      });
      if (!acc) acc = 'Hmm, I couldn’t find a good answer to that one. Try asking it another way?';
      out.innerHTML = md(acc, sources) + chipsFor(q, acc, sources);
      log.push({ who: 'bot', text: acc, q, sources: sources.slice(0, 5), town: (await import('./nami-faq.js').then((m) => m.townIn(q + ' ' + acc)).catch(() => null)) });
      if (sources.length || acc) out.insertAdjacentHTML('afterbegin', '<span class="fab-live">🌐 Live web</span>');
    } catch (err) {
      out.innerHTML = err.upgrade ? 'You’ve used your free questions this month. <a href="#/account?tab=plans">Premium</a> gives you more.' : esc(err.message);
      log.pop();
    } finally { busy = false; save(); touch(); msgs.scrollTop = msgs.scrollHeight; }
  };
  inp.addEventListener('input', touch); // typing counts as activity
  fab.onclick = () => (sheet.hidden ? open() : close());
  sheet.querySelector('.fab-x').onclick = close;
  sheet.querySelector('.fab-new').onclick = () => { chatId = null; log = []; save(); paintLog(); inp.focus(); };
  sheet.querySelector('form').onsubmit = (e) => { e.preventDefault(); const q = inp.value.trim(); inp.value = ''; ask(q); };
  msgs.addEventListener('click', (e) => { const b = e.target.closest('.fab-quick .chip'); if (b) ask(b.textContent); if (e.target.closest('a.fab-chip[href^="#"]')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });
  window.addEventListener('hashchange', () => { if (!sheet.hidden && /^#\/planner/.test(location.hash)) close(); });
  window.scAsk = (q) => { open(); ask(q); };
  if (!window.scAskHook) window.scAskHook = true, document.addEventListener('click', (e) => { const b = e.target.closest('[data-ask]'); if (b) { e.preventDefault(); window.scAsk(b.dataset.ask); } }); // any "Ask Nami" button

  /* ---------- news stays in the app: a story sheet instead of leaving to the browser ---------- */
  if (!window.scNewsHook) window.scNewsHook = true, document.addEventListener('click', (e) => {
    const a = e.target.closest('.story a[href^="http"], .lead a[href^="http"], a.tg-news'); if (!a) return;
    e.preventDefault();
    const box = a.closest('.story, .lead') || a;
    const title = (box.querySelector('h2, h3, b')?.textContent || a.textContent).trim();
    const kicker = (box.querySelector('.kicker, small')?.textContent || '').trim();
    const source = kicker.split('·')[0].trim();
    const place = (box.querySelector('.nc-place')?.textContent || '').trim();
    storySheet({ title, source, kicker, link: a.href, place });
  }, true);

  function storySheet(x) {
    document.querySelector('.news-sheet')?.remove();
    const s = document.createElement('div'); s.className = 'modal news-sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
    s.innerHTML = `<div class="panel">${newsCover({ title: x.title, source: x.source }, x.place, esc, true)}
      <span class="kicker">${esc(x.kicker)}</span><h2>${esc(x.title)}</h2>
      <div class="row wrap" style="gap:8px"><button type="button" class="btn small primary" data-act="explain">✨ ${BOT}, explain it</button><button type="button" class="btn small ghost" data-act="listen">🔊 Listen</button><button type="button" class="btn small ghost" data-act="close">Close</button></div>
      <a class="small" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">Full story at ${esc(x.source || 'the source')} ↗</a></div>`;
    document.body.appendChild(s);
    const shut = () => { window.speechSynthesis?.cancel(); s.remove(); document.removeEventListener('keydown', k); };
    const k = (e) => { if (e.key === 'Escape') shut(); };
    document.addEventListener('keydown', k);
    s.addEventListener('click', (e) => {
      if (e.target === s) return shut();
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') shut();
      if (act === 'listen' && 'speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`${x.title}. From ${x.source}.`); u.lang = 'en-ZA'; speechSynthesis.speak(u); }
      if (act === 'explain') { shut(); window.scAsk(`Explain this news in 3 short, catchy sentences and what it means for travellers: "${x.title}" (${x.source})`); }
    });
    s.querySelector('[data-act="explain"]').focus();
  }
}
