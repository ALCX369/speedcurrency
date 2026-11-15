// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Chats in a WhatsApp-like layout: chat list, then a full-screen chat on phones,
// tailed bubbles with time and a sent tick, day dividers, and "Make it a story":
// AI rewrites a rough idea into a short story in the message box before you send it.

const svg = (path) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const SPARKLE = svg('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>');
const BACK = svg('<path d="M15 18l-6-6 6-6"/>');
const SEND = svg('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>');

const time = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = (d) => {
  const x = new Date(d); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  if (x.toDateString() === t.toDateString()) return 'Today';
  if (x.toDateString() === y.toDateString()) return 'Yesterday';
  return x.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};

export async function ChatPage(main, r, deps) {
  const { api, S, sb, esc, fmtDate, modal, reportFlow, toast, premium } = deps;
  const convs = await api.conversations();
  const others = convs.map((c) => (c.user_a === S.user.id ? c.user_b : c.user_a));
  let toId = r.q.get('to');
  const people = await api.profilesById([...others, toId].filter(Boolean));
  const active = r.id || (toId ? convs.find((c) => [c.user_a, c.user_b].includes(toId))?.id : null) || null;
  if (active) toId = null;
  const name = (id) => { const p = people[id]; return p ? (p.display_name || '@' + (p.username || 'traveller')) : 'Traveller'; };
  const initial = (id) => esc(name(id).replace('@', '')[0]?.toUpperCase() || '?');
  const conv = convs.find((c) => c.id === active);
  const otherId = conv ? (conv.user_a === S.user.id ? conv.user_b : conv.user_a) : toId;
  const when = (d) => (new Date(d).toDateString() === new Date().toDateString() ? time(d) : fmtDate(d));

  main.innerHTML = `
  <div class="wa${otherId ? ' has-chat' : ''}">
    <aside class="wa-list" aria-label="Chats">
      <header class="wa-list-head"><h1>Chats</h1><button class="btn small primary" id="newchat">New chat</button></header>
      <p class="wa-note">${premium() ? 'Messages are free on your plan.' : 'Each message uses 1 token. Messages are free on Premium and Pro.'}</p>
      ${convs.length ? `<ul class="wa-rows">${convs.map((c) => { const o = c.user_a === S.user.id ? c.user_b : c.user_a; return `<li><a class="wa-row" href="#/messages/${esc(c.id)}"${c.id === active ? ' aria-current="true"' : ''}>
        <span class="wa-av" aria-hidden="true">${initial(o)}</span><span class="wa-row-main"><b>${esc(name(o))}</b><small>${esc(when(c.last_at))}</small></span></a></li>`; }).join('')}</ul>`
        : '<p class="wa-empty">No chats yet. Tap New chat and type a traveller’s @username to start one.</p>'}
    </aside>
    <section class="wa-chat" aria-label="${otherId ? `Chat with ${esc(name(otherId))}` : 'Chat'}">${otherId ? `
      <header class="wa-chat-head"><a class="wa-back" href="#/messages" aria-label="Back to chats">${BACK}</a>
        <span class="wa-av" aria-hidden="true">${initial(otherId)}</span><b class="wa-who">${esc(name(otherId))}</b>
        <button class="btn small ghost" id="crep">Report or block</button></header>
      <div class="wa-msgs" id="dm" aria-live="polite"></div>
      <form class="wa-composer" id="dmf">
        <button type="button" class="wa-ai" id="polish" aria-label="Make it a story with AI" title="Make it a story">${SPARKLE}</button>
        <label class="sr" for="dmt">Message</label><textarea id="dmt" rows="1" maxlength="1000" placeholder="Message"></textarea>
        <button class="wa-send" aria-label="Send message">${SEND}</button>
      </form>
      <p class="wa-hint">Type a rough idea and tap the sparkle: AI turns it into a short story you can edit before sending. Uses 1 AI question.</p>`
      : '<div class="wa-pick"><p>Pick a chat on the left, or start a new one.</p></div>'}</section>
  </div>`;

  main.querySelector('#newchat').onclick = () => modal(`<h2>New chat</h2><form class="stack" id="ncf" style="margin-top:12px"><div class="field"><label for="ncu">Traveller’s username</label><input class="input" id="ncu" placeholder="@username" maxlength="21" required></div><button class="btn primary">Open chat</button></form>`, (p, close) => {
    p.querySelector('#ncf').onsubmit = async (e) => { e.preventDefault(); const f = await api.findTraveller(p.querySelector('#ncu').value.trim()); if (!f) return toast('No traveller with that username'); close(); location.hash = `#/messages?to=${f.id}`; };
  });
  if (!otherId) return null;

  main.querySelector('#crep').onclick = () => reportFlow('user', otherId, otherId);
  const dm = main.querySelector('#dm');
  const paint = (list) => {
    let last = ''; let html = '';
    for (const m of list) {
      const day = new Date(m.created_at).toDateString();
      if (day !== last) { html += `<div class="wa-day"><span>${esc(dayLabel(m.created_at))}</span></div>`; last = day; }
      const mine = m.sender_id === S.user.id;
      html += `<div class="wa-b ${mine ? 'out' : 'in'}">${esc(m.body)}<span class="wa-meta">${time(m.created_at)}${mine ? '<span class="wa-tick" aria-label="Sent">✓</span>' : ''}</span></div>`;
    }
    dm.innerHTML = html || '<div class="wa-day"><span>Say hello. Your first message starts the chat.</span></div>';
    dm.scrollTop = dm.scrollHeight; // open at the newest message, like WhatsApp
  };
  let list = active ? await api.messages(active) : [];
  paint(list);
  let ch = null;
  if (active) {
    ch = sb.channel('dm-' + active).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active}` }, (payload) => {
      if (!list.find((m) => m.id === payload.new.id)) { list.push(payload.new); paint(list); }
    }).subscribe();
  }

  const ta = main.querySelector('#dmt');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); main.querySelector('#dmf').requestSubmit(); } });
  main.querySelector('#dmf').onsubmit = async (e) => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) return;
    ta.value = ''; grow();
    try {
      const convId = await api.sendMessage(otherId, body);
      if (!active) { location.hash = `#/messages/${convId}`; return; }
      list = await api.messages(active); paint(list);
    } catch (err) { ta.value = body; grow(); toast(err.message); }
  };

  // Make it a story: the AI rewrites the draft in place; nothing is sent until you tap send.
  const pol = main.querySelector('#polish');
  pol.onclick = async () => {
    const draft = ta.value.trim();
    if (draft.length < 8) { toast('Type a few words about your trip first, then tap the sparkle.'); ta.focus(); return; }
    let chatId = null; try { chatId = localStorage.getItem('sc_polish_chat'); } catch { /* private mode */ }
    pol.disabled = true; pol.classList.add('busy'); ta.value = ''; ta.placeholder = 'Writing your story…';
    let out = '';
    try {
      await api.askStream(chatId, draft, 'polish', (ev) => {
        if (ev.type === 'start' && ev.chat_id) { try { localStorage.setItem('sc_polish_chat', ev.chat_id); } catch { /* ignore */ } }
        if (ev.type === 'text') { out += ev.text; ta.value = out; grow(); }
      });
      if (!out.trim()) { ta.value = draft; toast('No story came back. Your text is still there; try again.'); }
      else { ta.focus(); toast('Story ready. Edit it if you like, then send.'); }
    } catch (err) { ta.value = draft; toast(err.message); }
    finally { pol.disabled = false; pol.classList.remove('busy'); ta.placeholder = 'Message'; grow(); }
  };
  return () => { if (ch) sb.removeChannel(ch); };
}
