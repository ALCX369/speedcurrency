// SpeedCurrency web app (MVP). Plain JavaScript, no build step.
// Backend: Supabase (auth, database, photo storage, server functions). Without settings it runs in demo mode.
const C = window.SC_CONFIG || {};
const DEMO = !C.SUPABASE_URL || !C.SUPABASE_ANON_KEY;
let sb = null;
if (!DEMO) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
}

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const money = (n, dp = 2) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '#');
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); }
const I = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  planner: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  trips: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  journal: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  money: '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.5"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  agent: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  place: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  cost: '<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  steps: '<path d="M4 7h10M4 12h16M4 17h7"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  album: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1 6 2 6-1-4-3-6 1"/>',
  token: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5h4.5a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5H15"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>',
};
const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

/* ---------- demo store (device only) ---------- */
const DS = {
  load() { try { return JSON.parse(localStorage.getItem('sc_demo')) || {}; } catch { return {}; } },
  save(d) { try { localStorage.setItem('sc_demo', JSON.stringify(d)); } catch { toast('This device is out of space for demo data'); } },
  get(k) { return this.load()[k] || []; },
  set(k, v) { const d = this.load(); d[k] = v; this.save(d); },
};
function guessCountry() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const byTz = { 'Africa/Windhoek': 'NA', 'Africa/Johannesburg': 'ZA', 'Africa/Gaborone': 'BW', 'Africa/Lusaka': 'ZM', 'Africa/Harare': 'ZW', 'Africa/Luanda': 'AO', 'Africa/Nairobi': 'KE', 'Africa/Lagos': 'NG', 'Europe/London': 'GB', 'America/New_York': 'US' };
  const code = byTz[tz] || (navigator.language.split('-')[1] || 'US').toUpperCase();
  return { code, name: new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code };
}

/* ---------- data API ---------- */
const CACHE = new Map();
const OWNED = ['trips', 'journal_entries', 'pins', 'planner_chats', 'planner_messages'];
const bust = (table) => { for (const k of [...CACHE.keys()]) if (k.includes(`"${table}"`)) CACHE.delete(k); };
const api = {
  async user() {
    if (DEMO) return DS.load().user || null;
    const { data } = await sb.auth.getSession();
    return data.session?.user || null;
  },
  async signUp(email, password, name) {
    if (DEMO) {
      const g = guessCountry();
      const d = DS.load();
      d.user = { id: 'demo', email };
      d.profile = { id: 'demo', display_name: name, username: null, home_country: g.name, home_country_code: g.code, plan: 'free', premium_until: null, public_journal: false, allow_tags: true };
      DS.save(d); return;
    }
    let ref = ''; try { ref = localStorage.getItem('sc_ref') || ''; } catch { /* private mode */ }
    const { error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name, ref }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
  },
  async signIn(email, password) {
    if (DEMO) { if (!DS.load().user) throw new Error('No demo account on this device yet. Create one first.'); return; }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async resetPassword(email) {
    if (DEMO) throw new Error('Not available in demo mode');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/account' });
    if (error) throw error;
  },
  async signOut() { if (DEMO) { const d = DS.load(); delete d.user; DS.save(d); return; } await sb.auth.signOut(); },
  async profile() {
    if (DEMO) return DS.load().profile;
    const u = await this.user();
    const { data } = await sb.from('profiles').select('*').eq('id', u.id).single();
    return data;
  },
  async updateProfile(patch) {
    if (DEMO) { const d = DS.load(); Object.assign(d.profile, patch); DS.save(d); return; }
    const u = await this.user();
    const { error } = await sb.from('profiles').update(patch).eq('id', u.id);
    if (error) throw new Error(error.message.includes('duplicate') ? 'That username is taken' : error.message);
  },
  async register() {
    if (DEMO) return;
    const { data, error } = await sb.functions.invoke('register', { body: {} });
    if (error) throw error;
    return data;
  },
  async list(table, { order = 'created_at', asc = false, eq, all = false, fresh = false } = {}) {
    if (DEMO) {
      let rows = DS.get(table);
      if (eq) rows = rows.filter((r) => r[eq[0]] === eq[1]);
      return rows.sort((a, b) => (a[order] > b[order] ? 1 : -1) * (asc ? 1 : -1));
    }
    const key = JSON.stringify([table, order, asc, eq, all]);
    const hit = CACHE.get(key);
    if (!fresh && hit && Date.now() - hit.at < 20000) return hit.rows;
    let q = sb.from(table).select('*').order(order, { ascending: asc });
    if (eq) q = q.eq(eq[0], eq[1]);
    if (!all && OWNED.includes(table) && S.user) q = q.eq('user_id', S.user.id);
    const { data, error } = await q;
    if (error) throw error;
    CACHE.set(key, { at: Date.now(), rows: data });
    return data;
  },
  async get(table, id) {
    if (DEMO) return DS.get(table).find((r) => r.id === id) || null;
    const { data } = await sb.from(table).select('*').eq('id', id).single();
    return data;
  },
  async insert(table, row) {
    bust(table);
    if (DEMO) { const r = { id: uid(), created_at: new Date().toISOString(), ...row }; DS.set(table, [...DS.get(table), r]); return r; }
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async update(table, id, patch) {
    bust(table);
    if (DEMO) { DS.set(table, DS.get(table).map((r) => (r.id === id ? { ...r, ...patch } : r))); return; }
    const { error } = await sb.from(table).update(patch).eq('id', id);
    if (error) throw error;
  },
  async remove(table, id) {
    bust(table);
    if (DEMO) { DS.set(table, DS.get(table).filter((r) => r.id !== id)); return; }
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw error;
  },
  async uploadPhoto(blob) {
    if (DEMO) return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    const u = await this.user();
    const path = `${u.id}/${uid()}.jpg`;
    const { error } = await sb.storage.from('journal').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  },
  async photoUrls(paths) {
    if (!paths?.length) return [];
    if (DEMO || paths[0].startsWith('data:')) return paths;
    const { data } = await sb.storage.from('journal').createSignedUrls(paths, 3600);
    return (data || []).map((d) => d.signedUrl);
  },
  async plannerUsage() {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    if (DEMO) return DS.get('planner_messages').filter((m) => m.role === 'user' && new Date(m.created_at) >= start).length;
    const { count } = await sb.from('planner_messages').select('id', { count: 'exact', head: true }).eq('role', 'user').gte('created_at', start.toISOString());
    return count || 0;
  },
  async askStream(chatId, message, mode, on) {
    if (DEMO) { const r = demoPlanner(chatId, message); on({ type: 'start', chat_id: r.chat_id }); on({ type: 'demo', data: r.data }); on({ type: 'done', chat_id: r.chat_id }); return; }
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${C.SUPABASE_URL}/functions/v1/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ chat_id: chatId, message, mode }),
    });
    if (!res.ok || !res.body) { let m = 'The assistant could not answer.'; try { m = (await res.json()).error || m; } catch { /* keep */ } throw new Error(m); }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (!line.startsWith('data: ')) continue;
        let ev; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
        if (ev.type === 'error') throw Object.assign(new Error(ev.error), { upgrade: ev.upgrade });
        on(ev);
      }
    }
    bust('planner_chats'); bust('planner_messages');
  },
  async balance() {
    if (DEMO) return 20;
    const { data } = await sb.rpc('token_balance');
    return data ?? 0;
  },
  async ledger() {
    if (DEMO) return [{ delta: 20, reason: 'Welcome bonus', created_at: new Date().toISOString() }];
    const { data } = await sb.from('token_ledger').select('delta, reason, created_at').order('created_at', { ascending: false }).limit(20);
    return data || [];
  },
  async profilesById(ids) {
    ids = [...new Set(ids.filter(Boolean))];
    if (!ids.length || DEMO) return {};
    const { data } = await sb.rpc('get_profiles', { ids });
    return Object.fromEntries((data || []).map((p) => [p.id, p]));
  },
  async feed() {
    if (DEMO) return [];
    const { data, error } = await sb.from('journal_entries').select('*').eq('is_public', true).neq('user_id', S.user.id).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    return data;
  },
  async comments(entryId) {
    if (DEMO) return [];
    const { data } = await sb.from('journal_comments').select('*').eq('entry_id', entryId).order('created_at');
    return data || [];
  },
  async addComment(entryId, body) {
    if (DEMO) throw new Error('Comments work once you are signed in online.');
    const { error } = await sb.rpc('add_comment', { entry: entryId, body });
    if (error) throw new Error(error.message);
  },
  async conversations() {
    if (DEMO) return [];
    const { data } = await sb.from('conversations').select('*').order('last_at', { ascending: false });
    return data || [];
  },
  async messages(convId) {
    const { data } = await sb.from('messages').select('*').eq('conversation_id', convId).order('created_at').limit(200);
    return data || [];
  },
  async sendMessage(toUser, body) {
    if (DEMO) throw new Error('Messages work once you are signed in online.');
    const { data, error } = await sb.rpc('send_message', { to_user: toUser, body });
    if (error) throw new Error(error.message);
    return data;
  },
  async block(userId) { const { error } = await sb.from('blocks').insert({ blocker: S.user.id, blocked: userId }); if (error && !/duplicate/.test(error.message)) throw error; },
  async report(type, id, reason) { const { error } = await sb.from('reports').insert({ target_type: type, target_id: id, reason }); if (error) throw error; },
  async pay(plan) {
    if (DEMO) throw new Error('Payments work once the app is connected to DPO.');
    const { data, error } = await sb.functions.invoke('dpo', { body: { action: 'start', plan } });
    if (error) { let m = 'Payment could not start'; try { m = (await error.context.json()).error || m; } catch { /* keep */ } throw new Error(m); }
    return data.url;
  },
  async verifyPayment(token) {
    const { data, error } = await sb.functions.invoke('dpo', { body: { action: 'verify', token } });
    if (error) throw error;
    return data;
  },
  async findTraveller(handle) {
    if (DEMO) return null;
    const { data } = await sb.rpc('find_traveller', { handle: handle.replace(/^@/, '') });
    return data?.[0] || null;
  },
};

/* ---------- demo planner: shows the answer layout until the AI is connected ---------- */
function demoPlanner(chatId, message) {
  let chat = chatId && DS.get('planner_chats').find((c) => c.id === chatId);
  if (!chat) { chat = { id: uid(), title: message.slice(0, 60), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; DS.set('planner_chats', [...DS.get('planner_chats'), chat]); }
  const data = {
    demo: true,
    summary: 'Demo mode: live Claude answers appear once you are signed in online. Here is a sample Etosha answer.',
    itinerary: [{ day: 'Day 1', plan: 'Drive to Okaukuejo, evening at the floodlit waterhole.' }, { day: 'Day 2–3', plan: 'Game drives, stay at Halali.' }, { day: 'Day 4–5', plan: 'Namutoni and Fischer’s Pan, drive home.' }],
    documents: [{ item: 'Visa', status: 'check', detail: 'The live planner checks the rules for your passport and links the official source.', source: 1 }],
    agents: [{ name: 'Namibia Wildlife Resorts (NWR)', why: 'Runs the rest camps inside Etosha', contact: 'nwr.com.na', source: 1 }],
    places: [{ name: 'Okaukuejo Rest Camp', type: 'stay', price: 'Camping from N$460 pp/night (Nov–Jun season)', reviews: 'Known for its floodlit waterhole; rooms described as basic.', source: 1 }],
    costs: [{ item: 'Camping, per person per night', amount: 'N$460–560', source: 1 }],
    next_steps: ['Check dates on the NWR website', 'Add the trip and set a reminder for when you arrive'],
    follow_up: 'What dates are you thinking of?',
    sources: [{ n: 1, title: 'Okaukuejo Resort – Namibia Wildlife Resorts', url: 'https://www.nwr.com.na/resorts/okaukuejo-resort/' }],
  };
  const now = new Date().toISOString();
  DS.set('planner_messages', [...DS.get('planner_messages'),
    { id: uid(), chat_id: chat.id, role: 'user', content: message, created_at: now },
    { id: uid(), chat_id: chat.id, role: 'assistant', content: data.summary, data, created_at: new Date(Date.now() + 1).toISOString() }]);
  return { chat_id: chat.id, content: data.summary, data };
}

/* ---------- free services: rates, places search ---------- */
const rates = { base: null, at: 0, table: {}, names: {} };
async function loadRates(base = 'usd') {
  base = base.toLowerCase();
  if (rates.base === base && Date.now() - rates.at < 30 * 60e3) return rates;
  const urls = [`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.min.json`, `https://latest.currency-api.pages.dev/v1/currencies/${base}.min.json`];
  for (const u of urls) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(8000) }); if (r.ok) { const j = await r.json(); rates.table = j[base]; rates.base = base; rates.at = Date.now(); rates.date = j.date; return rates; } } catch { /* next */ }
  }
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${base.toUpperCase()}`); const j = await r.json();
    rates.table = Object.fromEntries(Object.entries(j.rates).map(([k, v]) => [k.toLowerCase(), v])); rates.base = base; rates.at = Date.now(); rates.date = j.time_last_update_utc;
  } catch { throw new Error('Rates are offline right now'); }
  return rates;
}
const CUR = { NA: 'NAD', ZA: 'ZAR', BW: 'BWP', ZM: 'ZMW', ZW: 'USD', AO: 'AOA', KE: 'KES', NG: 'NGN', GH: 'GHS', TZ: 'TZS', UG: 'UGX', RW: 'RWF', MW: 'MWK', MZ: 'MZN', LS: 'LSL', SZ: 'SZL', EG: 'EGP', MA: 'MAD', ET: 'ETB', GB: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', CN: 'CNY', JP: 'JPY', AE: 'AED', SA: 'SAR', BR: 'BRL', MX: 'MXN', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', SG: 'SGD', HK: 'HKD', KR: 'KRW', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP' };
const EURO = 'AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES'.split(' ');
const homeCurrency = (code) => (EURO.includes(code) ? 'EUR' : CUR[code] || 'USD');

async function placeSearch(q) {
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Place search is busy, try again');
  const j = await r.json();
  return (j.features || []).map((f) => {
    const p = f.properties;
    return { name: p.name || p.street || q, detail: [p.city, p.state, p.country].filter(Boolean).filter((x) => x !== p.name).join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], kind: p.osm_value };
  });
}

/* ---------- photos: shrink before upload ---------- */
async function shrink(file, max = DEMO ? 720 : 1440, q = DEMO ? 0.7 : 0.82) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
}

/* ---------- state ---------- */
const S = { user: null, profile: null };
const tier = () => (S.profile && ['premium', 'pro'].includes(S.profile.plan) && S.profile.premium_until && new Date(S.profile.premium_until) > new Date() ? S.profile.plan : 'free');
const premium = () => tier() !== 'free';
const planLimit = () => ({ free: C.FREE_PLANS_PER_MONTH, premium: C.PREMIUM_PLANS_PER_MONTH, pro: C.PRO_PLANS_PER_MONTH }[tier()]);

/* ---------- ads (free users only) ---------- */
let adsenseLoaded = false;
function adBlock(where = 'main') {
  if (premium()) return '';
  const google = C.ADSENSE_SLOT ? `<ins class="adsbygoogle" style="display:block;min-height:90px" data-ad-client="${esc(C.ADSENSE_CLIENT)}" data-ad-slot="${esc(C.ADSENSE_SLOT)}" data-ad-format="auto" data-full-width-responsive="true"></ins>` : '';
  return `<div class="stack ${where}">
    <a class="ad" href="${esc(C.SHOP_URL)}" target="_blank" rel="noopener sponsored"><span class="tag">AD · ALCX369</span>
      <img src="https://cdn.shopify.com/s/files/1/1031/8771/0269/files/alcx369-hero-minimal.jpg?v=1794604513" alt="ALCX369 Christmas gift shop – smart gifts and gadgets" loading="lazy"></a>
    ${google}<span class="small muted">Ads are hidden on Premium.</span></div>`;
}
function activateAds() {
  if (!C.ADSENSE_SLOT || premium()) return;
  if (!adsenseLoaded) {
    const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(C.ADSENSE_CLIENT)}`;
    document.head.appendChild(s); adsenseLoaded = true;
  }
  $$('ins.adsbygoogle:not([data-done])').forEach((el) => { el.dataset.done = '1'; try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ad blockers */ } });
}

/* ---------- navigation ---------- */
const NAV = [['', 'Home', 'home'], ['planner', 'Assistant', 'planner'], ['trips', 'Trips', 'trips'], ['map', 'Map', 'map'], ['journal', 'Journal', 'journal'], ['explore', 'Explore', 'explore'], ['messages', 'Chats', 'chat'], ['account', 'Account', 'account']];
const TABS = ['', 'planner', 'journal', 'messages', 'account'];
function renderNav(active) {
  const link = ([r, l, ic]) => `<a href="#/${r}" ${active === r ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`;
  $('#nav').innerHTML = S.user ? NAV.map(link).join('') : '';
  $('#tabbar').innerHTML = S.user ? NAV.filter((n) => TABS.includes(n[0])).map(link).join('') : '';
  $('#tabbar').style.display = S.user ? '' : 'none';
  $('#side-ad').innerHTML = S.user ? adBlock('side') : '';
}
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const [name = '', id] = path.split('/');
  return { name, id, q: new URLSearchParams(query || '') };
}
let cleanup = null;
async function render() {
  const r = route();
  const main = $('#main');
  if (!S.user && r.name !== 'auth') { location.hash = '#/auth'; return; }
  if (S.user && r.name === 'auth') { location.hash = '#/'; return; }
  renderNav(r.name === 'auth' ? null : r.name);
  const views = { '': Home, planner: Planner, trips: Trips, map: MapView, journal: Journal, album: Album, explore: Explore, messages: Messages, account: Account, auth: Auth };
  const view = views[r.name] || Home;
  try { cleanup?.(); } catch { /* ignore */ } cleanup = null;
  main.innerHTML = '<div class="skeleton"><span></span><span></span><span></span></div>';
  try { await view(main, r); } catch (e) { console.error(e); main.innerHTML = `<div class="notice">Something went wrong: ${esc(e.message)}</div>`; }
  activateAds();
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

/* ---------- modal ---------- */
function modal(html, onMount) {
  const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="panel">${html}</div>`;
  const close = () => { m.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(m);
  onMount?.(m.firstElementChild, close);
  $('input,textarea,select,button', m)?.focus();
  return close;
}
function placePicker(container, onPick) {
  container.innerHTML = `<input class="input" type="search" placeholder="Search a place, town or address" aria-label="Search a place"><div class="results" hidden></div>`;
  const inp = $('input', container), res = $('.results', container);
  let t;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    if (inp.value.trim().length < 3) { res.hidden = true; return; }
    t = setTimeout(async () => {
      try {
        const list = await placeSearch(inp.value.trim());
        res.hidden = !list.length;
        res.innerHTML = list.map((p, i) => `<button type="button" data-i="${i}"><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.detail)}</span></button>`).join('');
        $$('button', res).forEach((b) => b.addEventListener('click', () => { const p = list[+b.dataset.i]; inp.value = p.name + (p.detail ? ', ' + p.detail : ''); res.hidden = true; onPick(p); }));
      } catch (e) { toast(e.message); }
    }, 350);
  });
}

/* =========================================================
   AUTH (landing)
   ========================================================= */
async function Auth(main) {
  main.innerHTML = `
  <div class="grid g2" style="align-items:start;margin-top:12px">
    <section class="stack" style="gap:18px">
      <span class="eyebrow">speed.currency</span>
      <h1>Plan your next move with real, current information.</h1>
      <p class="muted" style="font-size:18px;margin:0">Ask the Claude-powered assistant where to go and what it costs. It researches the documents your passport needs, recommended agents, places with reviews and prices, and keeps every plan in your history. Journal your trips, pin places on your map and convert money anywhere.</p>
      <div class="grid g3">
        <div class="card"><h3>${icon('doc')} Documents</h3><p class="small muted" style="margin:6px 0 0">Entry rules for your passport, with official links.</p></div>
        <div class="card"><h3>${icon('agent')} Agents</h3><p class="small muted" style="margin:6px 0 0">Recommended tour operators and offices.</p></div>
        <div class="card"><h3>${icon('place')} Places</h3><p class="small muted" style="margin:6px 0 0">Stays and food with review summaries.</p></div>
      </div>
      ${DEMO ? '<div class="notice"><b>Demo mode.</b> Data stays on this device until the app is connected to its server.</div>' : ''}
    </section>
    <section class="card stack" aria-label="Sign in">
      <div class="row" role="tablist"><button class="chip" role="tab" aria-pressed="true" data-mode="up">Create account</button><button class="chip" role="tab" aria-pressed="false" data-mode="in">Sign in</button></div>
      <form id="authf" class="stack">
        <div class="field" id="namef"><label for="aname">Your name</label><input class="input" id="aname" autocomplete="name" maxlength="60"></div>
        ${(() => { try { return localStorage.getItem('sc_ref') ? `<div class="notice">${icon('gift', 16)} You were invited. You'll get <b>40 tokens</b> when you join.</div>` : ''; } catch { return ''; } })()}
        <div class="field"><label for="aemail">Email</label><input class="input" id="aemail" type="email" autocomplete="email" required></div>
        <div class="field"><label for="apass">Password</label><input class="input" id="apass" type="password" autocomplete="new-password" minlength="8" required></div>
        <p class="small muted" id="countrynote" style="margin:0">${icon('lock', 14)} Your home country is set from where you create the account and can’t be changed later. It decides which travel documents the planner checks for you.</p>
        <button class="btn primary block" id="asubmit">Create account</button>
        <button type="button" class="btn ghost small" id="aforgot" hidden>Forgot password?</button>
      </form>
    </section>
  </div>`;
  let mode = 'up';
  const setMode = (m) => {
    mode = m;
    $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    $('#namef').hidden = m === 'in'; $('#countrynote').hidden = m === 'in'; $('#aforgot').hidden = m === 'up';
    $('#apass').autocomplete = m === 'in' ? 'current-password' : 'new-password';
    $('#asubmit').textContent = m === 'in' ? 'Sign in' : 'Create account';
  };
  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#aforgot').addEventListener('click', async () => {
    try { await api.resetPassword($('#aemail').value); toast('Check your email for a reset link'); } catch (e) { toast(e.message); }
  });
  $('#authf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#asubmit'); btn.disabled = true;
    try {
      if (mode === 'up') {
        await api.signUp($('#aemail').value.trim(), $('#apass').value, $('#aname').value.trim());
        if (!DEMO && !(await api.user())) { toast('Account created. Sign in to continue.'); setMode('in'); return; }
      } else await api.signIn($('#aemail').value.trim(), $('#apass').value);
      await boot();
      location.hash = '#/';
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
}

/* =========================================================
   HOME
   ========================================================= */
async function Home(main) {
  const [trips, chats] = await Promise.all([api.list('trips', { order: 'start_date', asc: true }), api.list('planner_chats', { order: 'updated_at' })]);
  const today = new Date().toISOString().slice(0, 10);
  const next = trips.find((t) => !t.end_date || t.end_date >= today);
  const homeCur = homeCurrency(S.profile.home_country_code);
  const first = (S.profile.display_name || '').split(' ')[0];
  const bal = await api.balance();
  const exp = S.profile.passport_expiry ? new Date(S.profile.passport_expiry) : null;
  const months = exp ? (exp - new Date()) / (30.44 * 864e5) : null;
  const tripEnd = next?.end_date ? new Date(next.end_date) : null;
  const passportNote = !exp
    ? `<a class="notice row" href="#/account" style="text-decoration:none">${icon('passport', 18)}<span>Add your passport country and expiry date so the assistant checks the right rules.</span></a>`
    : months < 0 ? `<div class="notice row">${icon('passport', 18)}<span><b>Your passport has expired.</b> Renew it before you travel.</span></div>`
    : (months < 6 || (tripEnd && (exp - tripEnd) / (30.44 * 864e5) < 6)) ? `<div class="notice row">${icon('passport', 18)}<span><b>Passport expires ${fmtDate(exp)}.</b> Many countries need 6 months' validity after you arrive.</span></div>` : '';
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">${esc(S.profile.home_country || '')}${tier() !== 'free' ? ' · ' + tier().toUpperCase() : ''}</span><h1>${first ? `Hi ${esc(first)}, where to next?` : 'Where to next?'}</h1></div>
    <div class="row wrap"><a class="badge" href="#/account?tab=tokens" style="text-decoration:none">${icon('token', 14)} ${bal} tokens</a><a class="btn primary" href="#/planner">${icon('planner')} Ask the assistant</a></div></div>
  ${passportNote}
  <div class="hero">
    <section class="card dark stack" aria-label="Quick convert">
      <div class="row between"><h2 style="color:var(--on-dark)">Convert</h2><span class="small muted" id="ratedate"></span></div>
      <form class="convert" id="conv">
        <div class="field"><label for="camt" style="color:var(--on-dark-muted)">Amount</label><input class="input" id="camt" inputmode="decimal" value="100"></div>
        <span></span><span></span>
        <div class="field"><label for="cfrom" style="color:var(--on-dark-muted)">From</label><input class="input" id="cfrom" value="USD" maxlength="3" autocapitalize="characters" list="curlist"></div>
        <button type="button" class="btn small" id="cswap" style="border-color:#3A3F45;color:var(--on-dark);margin-bottom:5px" aria-label="Swap currencies">⇄</button>
        <div class="field"><label for="cto" style="color:var(--on-dark-muted)">To</label><input class="input" id="cto" value="${esc(homeCur === 'USD' ? 'EUR' : homeCur)}" maxlength="3" autocapitalize="characters" list="curlist"></div>
        <datalist id="curlist"></datalist>
      </form>
      <div class="big" id="cout" aria-live="polite">–</div>
      <span class="small muted" id="crate"></span>
    </section>
    <section class="stack">
      ${next ? `<a class="card stack" href="#/trips/${next.id}" style="text-decoration:none;color:inherit">
          <span class="eyebrow">Next trip</span><h2>${esc(next.destination)}</h2>
          <span class="muted">${next.start_date ? fmtDate(next.start_date) : 'Dates not set'}${next.end_date ? ' – ' + fmtDate(next.end_date) : ''}</span>
          ${next.reminder?.on ? `<span class="badge ok">Reminder on · ${esc(next.reminder.place || '')}</span>` : ''}</a>`
        : `<div class="card stack"><span class="eyebrow">Next trip</span><h2>No trip yet</h2><p class="muted" style="margin:0">Ask the planner, then save the plan as a trip.</p><a class="btn small" href="#/trips?new=1">Add a trip</a></div>`}
      <div class="grid g2">
        <a class="shortcut" href="#/journal?new=1">${icon('journal')}New journal</a>
        <a class="shortcut" href="#/map">${icon('map')}My map</a>
        <a class="shortcut" href="#/album">${icon('album')}Album</a>
        <a class="shortcut" href="#/explore">${icon('explore')}Explore</a>
      </div>
    </section>
  </div>
  <section class="section"><div class="row between"><h2>Recent plans</h2><a href="#/planner">All plans</a></div>
    ${chats.length ? `<div class="card list">${chats.slice(0, 4).map((c) => `<a href="#/planner/${c.id}" class="row between" style="text-decoration:none;color:inherit"><span><b>${esc(c.title)}</b><br><span class="small muted">${fmtDate(c.updated_at)}</span></span>${icon('send', 18)}</a>`).join('')}</div>`
      : `<div class="empty">Your planner history appears here. <a href="#/planner">Start your first plan</a>.</div>`}
  </section>
  <section class="section">${adBlock()}</section>`;

  const run = async () => {
    const amt = parseFloat($('#camt').value.replace(/[\s,]/g, '')) || 0;
    const from = $('#cfrom').value.trim().toLowerCase(), to = $('#cto').value.trim().toLowerCase();
    if (from.length !== 3 || to.length !== 3) return;
    try {
      const r = await loadRates(from);
      const rate = r.table[to];
      if (!rate) { $('#cout').textContent = 'Unknown currency'; return; }
      $('#cout').textContent = `${money(amt * rate)} ${to.toUpperCase()}`;
      $('#crate').textContent = `1 ${from.toUpperCase()} = ${money(rate, 4)} ${to.toUpperCase()}`;
      $('#ratedate').textContent = r.date ? `Rates ${r.date}` : '';
      if (!$('#curlist').children.length) $('#curlist').innerHTML = Object.keys(r.table).filter((k) => k.length === 3).map((k) => `<option value="${k.toUpperCase()}">`).join('');
    } catch (e) { $('#cout').textContent = 'Rates offline'; }
  };
  ['camt', 'cfrom', 'cto'].forEach((id) => $('#' + id).addEventListener('input', run));
  $('#cswap').addEventListener('click', () => { const a = $('#cfrom').value; $('#cfrom').value = $('#cto').value; $('#cto').value = a; run(); });
  $('#conv').addEventListener('submit', (e) => { e.preventDefault(); run(); });
  run();
}

/* =========================================================
   PLANNER (AI research + history)
   ========================================================= */
function renderAnswer(d) {
  if (!d) return '';
  const src = (n) => { const s = (d.sources || []).find((x) => x.n === n); return s ? ` <a class="src" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener" title="${esc(s.title)}">[${n}]</a>` : ''; };
  const block = (title, ic, rows) => (rows?.length ? `<div class="block"><h3>${icon(ic, 18)} ${title}</h3>${rows.join('')}</div>` : '');
  const statusBadge = (s) => { const v = String(s || '').toLowerCase(); return `<span class="badge ${v.startsWith('required') ? 'warn' : v.startsWith('not') ? 'ok' : ''}">${esc(s || 'check')}</span>`; };
  return `<div class="answer">
    ${d.demo ? '<span class="badge dark" style="align-self:flex-start">SAMPLE · DEMO MODE</span>' : ''}
    <div class="summary">${esc(d.summary)}</div>
    ${block('Plan', 'steps', (d.itinerary || []).map((x) => `<div class="item"><span class="t" style="min-width:70px;color:var(--accent-dark)">${esc(x.day)}</span><span>${esc(x.plan)}</span></div>`))}
    ${block('Documents you need', 'doc', (d.documents || []).map((x) => `<div class="item"><div class="stack" style="gap:4px"><div class="row wrap"><span class="t">${esc(x.item)}</span>${statusBadge(x.status)}</div><span class="small">${esc(x.detail)}${src(x.source)}</span></div></div>`))}
    ${block('Recommended agents', 'agent', (d.agents || []).map((x) => `<div class="item"><div class="stack" style="gap:2px"><span class="t">${esc(x.name)}</span><span class="small">${esc(x.why)}${src(x.source)}</span>${x.contact ? `<span class="small muted">${esc(x.contact)}</span>` : ''}</div></div>`))}
    ${block('Places & reviews', 'place', (d.places || []).map((x) => `<div class="item"><div class="stack" style="gap:2px"><div class="row wrap"><span class="t">${esc(x.name)}</span>${x.type ? `<span class="badge">${esc(x.type)}</span>` : ''}</div>${x.price ? `<span class="small"><b>${esc(x.price)}</b></span>` : ''}${x.reviews ? `<span class="small">“${esc(x.reviews)}”${src(x.source)}</span>` : ''}
        <span><button class="btn small ghost" data-pin="${esc(x.name)}">Pin on my map</button></span></div></div>`))}
    ${block('Costs', 'cost', (d.costs || []).map((x) => `<div class="item"><span style="flex:1">${esc(x.item)}${src(x.source)}</span><span class="t">${esc(x.amount)}</span></div>`))}
    ${block('Next steps', 'steps', (d.next_steps || []).map((x) => `<div class="item"><span>${esc(x)}</span></div>`))}
    ${d.sources?.length ? `<details class="block"><summary><b>Sources (${d.sources.length})</b></summary><div class="sources" style="margin-top:10px">${d.sources.map((s) => `<span>[${s.n}] <a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a></span>`).join('')}</div></details>` : ''}
    ${d.follow_up ? `<div class="small muted">${esc(d.follow_up)}</div>` : ''}
    <div class="row wrap"><button class="btn small" data-save-trip>Save as trip</button></div>
    <p class="small muted" style="margin:0">Information comes from the linked sources and can change. Confirm with the official source before you book or travel.</p>
  </div>`;
}

/* simple, safe markdown for assistant answers */
function md(text, sources = []) {
  const lines = esc(text).split('\n');
  let html = '', list = false;
  const inline = (t) => t
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (m, sp, u) => `${sp}<a href="${u}" target="_blank" rel="noopener">${u.length > 40 ? u.slice(0, 40) + '…' : u}</a>`);
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^#{1,4}\s/.test(l)) { if (list) { html += '</ul>'; list = false; } html += `<h3 class="md-h">${inline(l.replace(/^#+\s/, ''))}</h3>`; continue; }
    if (/^\s*[-*•]\s/.test(l)) { if (!list) { html += '<ul class="md-ul">'; list = true; } html += `<li>${inline(l.replace(/^\s*[-*•]\s/, ''))}</li>`; continue; }
    if (/^\s*\d+[.)]\s/.test(l)) { if (!list) { html += '<ul class="md-ul">'; list = true; } html += `<li>${inline(l.replace(/^\s*\d+[.)]\s/, ''))}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  if (list) html += '</ul>';
  return html;
}
function sourcesBlock(sources) {
  if (!sources?.length) return '';
  return `<details class="block"><summary><b>Sources (${sources.length})</b></summary><div class="sources" style="margin-top:10px">${sources.map((s, i) => `<span>[${i + 1}] <a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a></span>`).join('')}</div></details>`;
}
function answerHtml(m) {
  const d = m.data || {};
  if (d.format === 'markdown') return `<div class="answer"><div class="summary md">${md(m.content)}</div>${sourcesBlock(d.sources)}${answerTools()}</div>`;
  return renderAnswer(Object.keys(d).length ? d : { summary: m.content });
}
const answerTools = () => `<div class="row wrap"><button class="btn small" data-save-trip>Save as trip</button><span class="small muted">Answers come from the linked sources and can change. Confirm before you book.</span></div>`;

async function Planner(main, r) {
  const chats = await api.list('planner_chats', { order: 'updated_at' });
  let chatId = r.id || null;
  let mode = r.q.get('mode') || 'plan';
  const used = await api.plannerUsage();
  const limit = planLimit();
  const home = S.profile.passport_country || S.profile.home_country || 'your country';
  const t = tier();
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Assistant · Claude ${t === 'pro' ? 'Sonnet' : 'Haiku'}${t !== 'free' ? ' · ' + t[0].toUpperCase() + t.slice(1) : ''}</span><h1>Plan your next move</h1>
    <p>Live answers with sources: documents for a ${esc(home)} passport, recommended agents, places and reviews, prices, money and journaling help.</p></div>
    <div class="row wrap"><span class="badge" id="usage">${used} of ${limit} questions this month</span><a class="btn small" href="#/planner">${icon('plus', 16)} New chat</a></div></div>
  <div class="planner" id="pl">
    <aside class="history" aria-label="Chat history">
      ${chats.length ? chats.map((c) => `<a href="#/planner/${c.id}" ${c.id === chatId ? 'aria-current="true"' : ''}><b>${esc(c.title)}</b><br><span class="date">${fmtDate(c.updated_at)}</span></a>`).join('') : '<p class="small muted">Your chats appear here.</p>'}
    </aside>
    <section class="chat">
      <div class="row wrap" role="group" aria-label="What do you need?">
        ${[['plan', 'Plan a trip'], ['money', 'Money & exchange'], ['journal', 'Journal help']].map(([k, l]) => `<button class="chip" data-mode="${k}" aria-pressed="${k === mode}">${l}</button>`).join('')}
        ${chats.length ? `<button class="chip" id="showhist">History (${chats.length})</button>` : ''}
      </div>
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <form class="composer" id="ask">
        <label class="sr" for="q">Ask the assistant</label>
        <textarea class="input" id="q" rows="1" maxlength="2000" placeholder="Where to next? Ask anything: visas, costs, agents, places…"></textarea>
        <button class="btn dark" id="qsend" aria-label="Send">${icon('send')}</button>
      </form>
    </section>
  </div>`;
  const sh = $('#showhist'); if (sh) sh.onclick = () => $('#pl').classList.toggle('show-history');
  $$('[data-mode]').forEach((b) => b.onclick = () => { mode = b.dataset.mode; $$('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $('#q').focus(); });
  const msgs = $('#msgs');
  const SUGGEST = {
    plan: [`What documents do I need to travel from ${home} to Zanzibar?`, 'Plan 5 days in Etosha for two under N$15,000', 'Best tour agents for Victoria Falls, with reviews'],
    money: ['Convert N$5,000 to Tanzanian shillings and tell me daily costs in Zanzibar', 'Cash or card in Cape Town? Fees for a Namibian card'],
    journal: ['Turn these notes into a 528-character story: sunrise at Dune 45, cold sand, met Anna from Germany'],
  };
  const showEmpty = () => {
    msgs.innerHTML = `<div class="card stack"><h2>What’s your next move?</h2><div class="suggest">${Object.values(SUGGEST).flat().map((x) => `<button class="chip" type="button" data-s="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
    $$('[data-s]', msgs).forEach((b) => b.onclick = () => { $('#q').value = b.dataset.s; $('#ask').requestSubmit(); });
  };
  const bind = () => {
    $$('[data-save-trip]', msgs).forEach((b) => b.onclick = async () => {
      const chat = chats.find((c) => c.id === chatId);
      const dest = prompt('Destination for this trip?', chat?.title?.slice(0, 80) || '');
      if (!dest) return;
      const tr = await api.insert('trips', { destination: dest.slice(0, 120), notes: `From the assistant: ${chat?.title || ''}`.slice(0, 2000) });
      location.hash = `#/trips/${tr.id}`;
    });
    $$('[data-pin]', msgs).forEach((b) => b.onclick = async () => {
      try { const [p] = await placeSearch(b.dataset.pin); if (!p) return toast('Could not find that place');
        await api.insert('pins', { kind: 'saved', name: b.dataset.pin.slice(0, 120), lat: p.lat, lng: p.lng, note: 'Saved from the assistant' }); toast('Pinned on your map'); b.disabled = true; } catch (e) { toast(e.message); }
    });
  };
  if (chatId) {
    const list = await api.list('planner_messages', { order: 'created_at', asc: true, eq: ['chat_id', chatId] });
    msgs.innerHTML = list.map((m) => (m.role === 'user' ? `<div class="bubble-user">${esc(m.content)}</div>` : answerHtml(m))).join('');
    bind();
    msgs.lastElementChild?.scrollIntoView({ block: 'end' });
  } else showEmpty();
  if (r.q.get('q')) $('#q').value = r.q.get('q');
  const q = $('#q');
  q.addEventListener('input', () => { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 180) + 'px'; });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ask').requestSubmit(); } });
  $('#ask').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = q.value.trim(); if (!text) return;
    if (!chatId) msgs.innerHTML = '';
    msgs.insertAdjacentHTML('beforeend', `<div class="bubble-user">${esc(text)}</div>
      <div class="answer live"><div class="thinking"><i></i><i></i><i></i> <span>Thinking…</span></div><div class="summary md" hidden></div><div class="srcs"></div></div>`);
    const box = msgs.lastElementChild, sum = $('.summary', box), think = $('.thinking span', box);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    q.value = ''; q.style.height = ''; $('#qsend').disabled = true;
    let acc = '', srcs = [], raf = 0;
    const paint = () => { raf = 0; sum.innerHTML = md(acc); };
    try {
      await api.askStream(chatId, text, mode, (ev) => {
        if (ev.type === 'start' && !chatId) { chatId = ev.chat_id; history.replaceState(null, '', `#/planner/${chatId}`); chats.unshift({ id: chatId, title: text.slice(0, 60), updated_at: new Date().toISOString() }); }
        else if (ev.type === 'search') think.textContent = `Searching: ${ev.query || 'the web'}…`;
        else if (ev.type === 'text') { if (sum.hidden) { sum.hidden = false; $('.thinking', box).remove(); } acc += ev.text; if (!raf) raf = requestAnimationFrame(paint); }
        else if (ev.type === 'sources') srcs = ev.sources;
        else if (ev.type === 'demo') { box.outerHTML = renderAnswer(ev.data); }
        else if (ev.type === 'done') {
          if (ev.used != null) $('#usage').textContent = `${ev.used} of ${ev.limit} questions this month`;
          if (box.isConnected) { cancelAnimationFrame(raf); paint(); $('.srcs', box).outerHTML = sourcesBlock(ev.sources || srcs) + answerTools(); box.classList.remove('live'); }
        }
      });
      bind();
    } catch (err) {
      box.innerHTML = `<div class="notice">${esc(err.message)} ${err.upgrade ? '<a href="#/account">See plans & tokens</a>' : ''}</div>`;
    } finally { $('#qsend').disabled = false; }
  });
}

/* =========================================================
   TRIPS (plans, budget, location reminder)
   ========================================================= */
async function Trips(main, r) {
  if (r.id) return TripDetail(main, r.id);
  const trips = await api.list('trips', { order: 'start_date', asc: true });
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Trips</span><h1>Your trips</h1><p>Dates, budget and a reminder that pops up when you arrive.</p></div>
    <button class="btn primary" id="newtrip">${icon('plus', 18)} New trip</button></div>
  ${trips.length ? `<div class="grid g3">${trips.map((t) => `<a class="card stack" href="#/trips/${t.id}" style="text-decoration:none;color:inherit">
      <h2>${esc(t.destination)}</h2><span class="muted">${t.start_date ? fmtDate(t.start_date) : 'Dates not set'}${t.end_date ? ' – ' + fmtDate(t.end_date) : ''}</span>
      <div class="row wrap">${t.budget?.total ? `<span class="badge">Budget N$ ${money(t.budget.total, 0)}</span>` : ''}${t.reminder?.on ? '<span class="badge ok">Reminder on</span>' : ''}</div></a>`).join('')}</div>`
    : '<div class="empty">No trips yet. Add one, or save a plan from the planner.</div>'}`;
  const open = () => modal(`
    <h2>New trip</h2>
    <form class="stack" id="tf" style="margin-top:14px">
      <div class="field"><label for="td">Destination</label><input class="input" id="td" required maxlength="120" placeholder="e.g. Zanzibar, Tanzania"></div>
      <div class="grid g2"><div class="field"><label for="ts">From</label><input class="input" id="ts" type="date"></div><div class="field"><label for="te">To</label><input class="input" id="te" type="date"></div></div>
      <div class="row"><button class="btn primary" style="flex:1">Create trip</button><button type="button" class="btn ghost" data-close>Cancel</button></div>
    </form>`, (p, close) => {
    $('#tf', p).addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = await api.insert('trips', { destination: $('#td', p).value.trim(), start_date: $('#ts', p).value || null, end_date: $('#te', p).value || null });
      close(); location.hash = `#/trips/${t.id}`;
    });
  });
  $('#newtrip').addEventListener('click', open);
  if (r.q.get('new')) open();
}

async function TripDetail(main, id) {
  const t = await api.get('trips', id);
  if (!t) { main.innerHTML = '<div class="empty">Trip not found. <a href="#/trips">Back to trips</a></div>'; return; }
  const b = { days: 5, people: 2, fly: 0, stay: 1200, food: 250, move: 2500, docs: 600, buf: 10, ...(t.budget || {}) };
  const rem = t.reminder || {};
  main.innerHTML = `
  <div class="page-head"><div><a href="#/trips" class="small">← Trips</a><h1>${esc(t.destination)}</h1>
    <p>${t.start_date ? fmtDate(t.start_date) : 'Dates not set'}${t.end_date ? ' – ' + fmtDate(t.end_date) : ''}</p></div>
    <div class="row wrap"><a class="btn dark" href="#/planner?q=${encodeURIComponent(`What documents, costs and recommended agents do I need for a trip to ${t.destination}?`)}">${icon('planner', 18)} Research this trip</a>
    <button class="btn ghost" id="tdel">Delete</button></div></div>
  <div class="grid g2" style="align-items:start">
    <section class="card stack" aria-label="Budget">
      <div class="row between"><h2>Budget</h2><span class="small muted">All amounts in N$</span></div>
      <div class="grid g2" id="bf">
        ${[['days', 'Days'], ['people', 'People'], ['fly', 'Flight per person'], ['stay', 'Stay per night'], ['food', 'Food per person/day'], ['move', 'Fuel, car, taxis (total)'], ['docs', 'Visa, insurance, extras'], ['buf', 'Buffer %']]
          .map(([k, l]) => `<div class="field"><label for="b_${k}">${l}</label><input class="input" id="b_${k}" data-k="${k}" inputmode="decimal" value="${esc(b[k])}"></div>`).join('')}
      </div>
      <div class="card dark stack" style="padding:16px"><span class="muted small">Total</span><span class="big" id="btotal" aria-live="polite"></span><span class="muted small" id="bper"></span></div>
      <div class="list" id="bbreak"></div>
      <button class="btn primary" id="bsave">Save budget</button>
      <p class="small muted" style="margin:0">Need flight prices? <a href="#/planner?q=${encodeURIComponent(`Cheapest flights to ${t.destination}${t.start_date ? ' around ' + t.start_date : ''} from my nearest airport, with links`)}">Ask the planner for current fares</a>.</p>
    </section>
    <section class="stack">
      <div class="card stack" aria-label="Location reminder">
        <div class="row between"><div><h2>Arrival reminder</h2><p class="small muted" style="margin:4px 0 0">Get a note when you reach a place.</p></div>
          <button class="switch" role="switch" aria-checked="${rem.on ? 'true' : 'false'}" aria-label="Arrival reminder" id="rsw"></button></div>
        <div class="field"><label>Place</label><div id="rpick"></div>${rem.place ? `<span class="small muted">Current: ${esc(rem.place)}</span>` : ''}</div>
        <div class="field"><label for="rnote">Reminder note</label><input class="input" id="rnote" maxlength="200" value="${esc(rem.note || '')}" placeholder="e.g. Exchange cash, check in, visit the market"></div>
        <button class="btn" id="rsave">Save reminder</button>
        <p class="small muted" style="margin:0">Works while SpeedCurrency is open on your phone (add it to your home screen). Background reminders come with the phone app.</p>
      </div>
      <div class="card stack"><h2>Notes</h2><textarea class="input" id="tnotes" maxlength="2000">${esc(t.notes || '')}</textarea><button class="btn ghost small" id="nsave">Save notes</button></div>
    </section>
  </div>`;
  const num = (v) => Math.max(0, parseFloat(String(v).replace(/[\s,]/g, '')) || 0);
  const calc = () => {
    const v = Object.fromEntries($$('#bf input').map((i) => [i.dataset.k, num(i.value)]));
    const days = Math.max(v.days, 1), ppl = Math.max(v.people, 1);
    const parts = [['Flights', v.fly * ppl], ['Stay', v.stay * Math.max(days - 1, 1)], ['Food', v.food * ppl * days], ['Getting around', v.move], ['Visa, insurance, extras', v.docs]];
    const sub = parts.reduce((a, p) => a + p[1], 0), buf = sub * v.buf / 100, total = sub + buf;
    $('#btotal').textContent = `N$ ${money(total, 0)}`;
    $('#bper').textContent = `N$ ${money(total / days, 0)} per day · N$ ${money(total / ppl, 0)} per person`;
    $('#bbreak').innerHTML = [...parts, [`Buffer (${v.buf}%)`, buf]].map(([l, a]) => `<div class="row between"><span>${l}</span><b>N$ ${money(a, 0)}</b></div>`).join('');
    return { ...v, total };
  };
  $$('#bf input').forEach((i) => i.addEventListener('input', calc)); calc();
  $('#bsave').onclick = async () => { await api.update('trips', id, { budget: calc() }); toast('Budget saved'); };
  let picked = rem.lat ? { lat: rem.lat, lng: rem.lng, name: rem.place } : null;
  placePicker($('#rpick'), (p) => { picked = p; });
  const sw = $('#rsw');
  sw.onclick = () => sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
  $('#rsave').onclick = async () => {
    const on = sw.getAttribute('aria-checked') === 'true';
    if (on && !picked) { toast('Pick a place first'); return; }
    if (on && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    await api.update('trips', id, { reminder: { on, lat: picked?.lat, lng: picked?.lng, place: picked?.name, note: $('#rnote').value.trim(), radius_m: 1500, fired: false } });
    toast(on ? 'Reminder on' : 'Reminder off'); startReminders();
  };
  $('#nsave').onclick = async () => { await api.update('trips', id, { notes: $('#tnotes').value }); toast('Notes saved'); };
  $('#tdel').onclick = async () => { if (confirm('Delete this trip? This can’t be undone.')) { await api.remove('trips', id); location.hash = '#/trips'; } };
}

/* location reminders: checks position while the app is open */
let watchId = null;
async function startReminders() {
  if (!('geolocation' in navigator) || !S.user) return;
  const trips = (await api.list('trips')).filter((t) => t.reminder?.on && !t.reminder?.fired && t.reminder.lat);
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (!trips.length) return;
  const dist = (a, b, c, d) => { const R = 6371e3, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  watchId = navigator.geolocation.watchPosition(async (pos) => {
    for (const t of trips) {
      if (t.reminder.fired) continue;
      if (dist(pos.coords.latitude, pos.coords.longitude, t.reminder.lat, t.reminder.lng) <= (t.reminder.radius_m || 1500)) {
        t.reminder.fired = true;
        const msg = `${t.reminder.place || t.destination}: ${t.reminder.note || 'You have arrived'}`;
        toast(msg);
        if ('Notification' in window && Notification.permission === 'granted') new Notification('SpeedCurrency', { body: msg, icon: 'icon.svg' });
        await api.update('trips', t.id, { reminder: { ...t.reminder, fired: true } });
      }
    }
  }, () => {}, { enableHighAccuracy: false, maximumAge: 60000 });
}

/* =========================================================
   MAP (free OpenStreetMap tiles)
   ========================================================= */
let mapObj = null;
function loadMapLib() {
  if (window.maplibregl) return Promise.resolve();
  return new Promise((res) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4/dist/maplibre-gl.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4/dist/maplibre-gl.js'; js.onload = res; js.onerror = res; document.head.appendChild(js);
  });
}
async function MapView(main) {
  const [pins, entries] = await Promise.all([api.list('pins'), api.list('journal_entries')]);
  const all = [...pins, ...entries.filter((e) => e.lat != null).map((e) => ({ id: 'j' + e.id, kind: 'visited', name: e.title, lat: e.lat, lng: e.lng, note: e.story, journal: e.id }))];
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Map</span><h1>Your places</h1><p>Home, garage, places you visited and places you plan to go. Tap the map to add a pin.</p></div>
    <div class="row"><span class="badge">${all.filter((p) => p.kind === 'visited').length} visited</span><span class="badge">${all.length} pins</span></div></div>
  <div class="mapwrap">
    <div id="map" role="application" aria-label="Map of your places"></div>
    <div class="map-top"><div id="msearch"></div></div>
    <div class="legend" aria-hidden="true"><span><i style="background:#F3F2EE"></i>Home</span><span><i style="background:#9EA1A6"></i>Garage</span><span><i style="background:#FF5A1F"></i>Visited</span><span><i style="background:#fff;outline:1px dashed #FF5A1F"></i>Planned</span><span><i style="background:#FF8A5C"></i>Saved</span></div>
    <div id="sheet"></div>
  </div>
  <p class="small muted">Map © OpenStreetMap contributors, tiles by OpenFreeMap. Place search by Photon.</p>`;
  await loadMapLib();
  if (!window.maplibregl) { $('#map').innerHTML = '<p class="muted" style="padding:20px;color:#fff">The map could not load. Check your connection.</p>'; return; }
  mapObj?.remove();
  const center = all.length ? [all[0].lng, all[0].lat] : [17.08, -22.56];
  const map = mapObj = new maplibregl.Map({ container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center, zoom: all.length ? 5 : 4, pitch: 40, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'top-right');
  const letter = { home: 'H', garage: 'G', visited: '★', planned: '+', saved: '•' };
  const sheet = $('#sheet');
  const show = (p) => {
    sheet.innerHTML = `<div class="sheet stack"><div class="row between"><span class="badge">${esc(p.kind)}</span><button class="btn small ghost" data-x aria-label="Close">✕</button></div>
      <h2>${esc(p.name)}</h2>${p.note ? `<p style="margin:0">${esc(p.note)}</p>` : ''}
      <div class="row wrap">
        <a class="btn small dark" target="_blank" rel="noopener" href="https://www.openstreetmap.org/directions?to=${p.lat}%2C${p.lng}">Directions</a>
        <a class="btn small" href="#/planner?q=${encodeURIComponent(`Tell me about ${p.name}: reviews, prices and tips`)}">Ask planner</a>
        ${p.journal ? `<a class="btn small" href="#/journal/${p.journal}">Open journal</a>` : `<button class="btn small ghost" data-del>Delete pin</button>`}
      </div></div>`;
    $('[data-x]', sheet).onclick = () => { sheet.innerHTML = ''; };
    const d = $('[data-del]', sheet);
    if (d) d.onclick = async () => { await api.remove('pins', p.id); toast('Pin removed'); render(); };
  };
  for (const p of all) {
    const el = document.createElement('button'); el.className = `pin ${p.kind}`; el.textContent = letter[p.kind] || '•'; el.setAttribute('aria-label', `${p.kind}: ${p.name}`);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); show(p); });
    new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
  }
  if (all.length > 1) { const bb = new maplibregl.LngLatBounds(); all.forEach((p) => bb.extend([p.lng, p.lat])); map.fitBounds(bb, { padding: 80, maxZoom: 12 }); }
  const addPin = (lat, lng, name = '') => modal(`
    <h2>Add a pin</h2>
    <form class="stack" id="pf" style="margin-top:14px">
      <div class="field"><label for="pn">Name</label><input class="input" id="pn" required maxlength="120" value="${esc(name)}"></div>
      <div class="field"><label for="pk">Type</label><select class="input" id="pk"><option value="visited">Visited</option><option value="planned">Planning to go</option><option value="saved">Saved</option><option value="home">Home</option><option value="garage">Garage / mechanic</option></select></div>
      <div class="field"><label for="pnote">Your note</label><textarea class="input" id="pnote" maxlength="528"></textarea><span class="counter" id="pc">0 / 528</span></div>
      <div class="row"><button class="btn primary" style="flex:1">Save pin</button><button type="button" class="btn ghost" data-close>Cancel</button></div>
    </form>`, (pnl, close) => {
    $('#pnote', pnl).addEventListener('input', (e) => { $('#pc', pnl).textContent = `${e.target.value.length} / 528`; });
    $('#pf', pnl).addEventListener('submit', async (e) => {
      e.preventDefault();
      await api.insert('pins', { kind: $('#pk', pnl).value, name: $('#pn', pnl).value.trim(), lat, lng, note: $('#pnote', pnl).value.trim() || null });
      close(); toast('Pin saved'); render();
    });
  });
  map.on('click', (e) => addPin(e.lngLat.lat, e.lngLat.lng));
  placePicker($('#msearch'), (p) => { map.flyTo({ center: [p.lng, p.lat], zoom: 14 }); setTimeout(() => addPin(p.lat, p.lng, p.name), 900); });
}

/* =========================================================
   JOURNAL
   ========================================================= */
async function Journal(main, r) {
  if (r.id) return JournalEntry(main, r.id);
  const entries = await api.list('journal_entries', { order: 'visited_on' });
  const covers = await api.photoUrls(entries.map((e) => e.photos?.[0]).filter(Boolean));
  let ci = 0;
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Journal</span><h1>Your travel journal</h1><p>Up to 6 photos, the place, your rating, a 528-character story and the people you met.</p></div>
    <div class="row wrap"><a class="btn ghost" href="#/album">${icon('album', 18)} Album</a><button class="btn primary" id="newj">${icon('plus', 18)} New entry</button></div></div>
  ${entries.length ? `<div class="grid g2">${entries.map((e) => `<a class="card entry" href="#/journal/${e.id}" style="text-decoration:none;color:inherit">
      <div class="cover" style="${e.photos?.length ? `background-image:url('${esc(covers[ci++])}')` : ''}"></div>
      <div class="stack" style="gap:4px"><h2>${esc(e.title)}</h2><span class="small muted">${esc(e.place_name || '')}${e.visited_on ? ' · ' + fmtDate(e.visited_on) : ''}</span>
        ${e.rating ? `<span style="color:var(--accent)">${'★'.repeat(e.rating)}<span style="color:#D6D2CA">${'★'.repeat(5 - e.rating)}</span></span>` : ''}
        <span class="small">${esc((e.story || '').slice(0, 120))}${(e.story || '').length > 120 ? '…' : ''}</span>
        ${e.people?.length ? `<span class="small muted">Met ${e.people.length} ${e.people.length === 1 ? 'person' : 'people'}</span>` : ''}</div></a>`).join('')}</div>`
    : '<div class="empty">No journal entries yet. Your first trip story starts here.</div>'}`;
  $('#newj').onclick = () => editEntry();
  if (r.q.get('new')) editEntry();
}

async function JournalEntry(main, id) {
  const e = await api.get('journal_entries', id);
  if (!e) { main.innerHTML = '<div class="empty">Entry not found. <a href="#/journal">Back</a></div>'; return; }
  const mine = e.user_id === S.user.id || DEMO;
  const [urls, comments] = await Promise.all([api.photoUrls(e.photos), api.comments(id)]);
  const people = await api.profilesById([e.user_id, ...comments.map((c) => c.user_id)]);
  const author = people[e.user_id];
  const name = (p) => (p ? (p.display_name || '@' + (p.username || 'traveller')) : 'Traveller');
  main.innerHTML = `
  <div class="page-head"><div><a href="#/${mine ? 'journal' : 'explore'}" class="small">← ${mine ? 'Journal' : 'Explore'}</a><h1>${esc(e.title)}</h1>
    <p>${mine ? '' : `By <b>${esc(name(author))}</b>${author?.home_country ? ' · from ' + esc(author.home_country) : ''} · `}${esc(e.place_name || '')}${e.visited_on ? ' · ' + fmtDate(e.visited_on) : ''}</p></div>
    <div class="row wrap">${mine ? '<button class="btn" id="jedit">Edit</button><button class="btn ghost" id="jdel">Delete</button>'
      : `<a class="btn dark" href="#/messages?to=${e.user_id}">${icon('chat', 16)} Message</a><button class="btn ghost" id="jrep">Report</button>`}</div></div>
  <div class="grid g2" style="align-items:start">
    <section class="photos">${urls.map((u, i) => `<button class="ph" data-view="${i}" style="background-image:url('${esc(u)}')" aria-label="Open photo ${i + 1}"></button>`).join('') || '<div class="empty" style="grid-column:1/-1">No photos</div>'}</section>
    <section class="stack">
      <div class="card stack">${e.rating ? `<span style="color:var(--accent);font-size:22px">${'★'.repeat(e.rating)}<span style="color:#D6D2CA">${'★'.repeat(5 - e.rating)}</span></span>` : ''}
        <p style="margin:0;white-space:pre-wrap">${esc(e.story || 'No story yet.')}</p>${mine ? `<span class="badge">${e.is_public ? 'Public' : 'Only me'}</span>` : ''}</div>
      <div class="card"><h2>People met</h2>${(e.people || []).map((p) => `<div class="person"><span class="avatar">${esc((p.name || '?')[0].toUpperCase())}</span><span style="flex:1"><b>${esc(p.name)}</b><br><span class="small muted">From ${esc(p.from_country || 'unknown')}</span></span>${p.username ? `<span class="badge ok">@${esc(p.username)}</span>` : '<span class="badge">Not on the app</span>'}</div>`).join('') || '<p class="muted">Nobody added.</p>'}</div>
      ${e.lat != null && mine ? `<a class="btn ghost" href="#/map">See on my map</a>` : ''}
      <div class="card stack" id="comments"><h2>Comments (${comments.length})</h2>
        ${comments.map((c) => `<div class="person"><span class="avatar">${esc(name(people[c.user_id])[0].toUpperCase())}</span><span style="flex:1"><b>${esc(name(people[c.user_id]))}</b><br>${esc(c.body)}<br><span class="small muted">${fmtDate(c.created_at)}</span></span>${c.user_id === S.user.id || mine ? `<button class="btn small ghost" data-cdel="${c.id}" aria-label="Delete comment">✕</button>` : ''}</div>`).join('') || '<p class="muted" style="margin:0">No comments yet.</p>'}
        ${(e.is_public || mine) ? `<form class="row" id="cform"><label class="sr" for="cbody">Comment</label><input class="input" id="cbody" maxlength="300" placeholder="Say something nice…"><button class="btn dark">Post</button></form>
        <span class="small muted">${mine || premium() ? 'Comments are free for you.' : 'Commenting uses 1 token.'}</span>` : ''}
      </div>
    </section>
  </div>`;
  $$('[data-view]').forEach((b) => b.onclick = () => viewer(urls, +b.dataset.view));
  if (mine) {
    $('#jedit').onclick = () => editEntry(e);
    $('#jdel').onclick = async () => { if (confirm('Delete this entry and its photos?')) { await api.remove('journal_entries', id); location.hash = '#/journal'; } };
  } else $('#jrep').onclick = () => reportFlow('entry', id, e.user_id);
  const cf = $('#cform');
  if (cf) cf.onsubmit = async (ev) => { ev.preventDefault(); const b = $('#cbody').value.trim(); if (!b) return; try { await api.addComment(id, b); toast('Comment posted'); render(); } catch (err) { toast(err.message); } };
  $$('[data-cdel]').forEach((b) => b.onclick = async () => { await sb.from('journal_comments').delete().eq('id', b.dataset.cdel); render(); });
}

/* full-screen photo viewer with swipe/arrow keys */
function viewer(urls, i = 0) {
  if (!urls.length) return;
  const close = modal(`<div class="viewer"><img id="vimg" alt="Trip photo"><div class="row between"><button class="btn small ghost" id="vprev" aria-label="Previous photo">←</button><span class="small muted" id="vcount"></span><button class="btn small ghost" id="vnext" aria-label="Next photo">→</button></div><button class="btn small" data-close>Close</button></div>`, (p) => {
    const show = () => { $('#vimg', p).src = urls[i]; $('#vcount', p).textContent = `${i + 1} of ${urls.length}`; };
    $('#vprev', p).onclick = () => { i = (i - 1 + urls.length) % urls.length; show(); };
    $('#vnext', p).onclick = () => { i = (i + 1) % urls.length; show(); };
    let x0 = null;
    $('#vimg', p).addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    $('#vimg', p).addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) (dx < 0 ? $('#vnext', p) : $('#vprev', p)).click(); x0 = null; });
    p.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') $('#vprev', p).click(); if (e.key === 'ArrowRight') $('#vnext', p).click(); });
    show();
  });
  return close;
}

function reportFlow(type, id, userId) {
  modal(`<h2>Report or block</h2><form class="stack" id="rf" style="margin-top:12px">
    <div class="field"><label for="rr">What's wrong?</label><textarea class="input" id="rr" maxlength="500" required placeholder="Spam, harassment, fake profile…"></textarea></div>
    <label class="row"><input type="checkbox" id="rb"> Also block this traveller</label>
    <div class="row"><button class="btn primary" style="flex:1">Send report</button><button type="button" class="btn ghost" data-close>Cancel</button></div></form>`, (p, close) => {
    $('#rf', p).onsubmit = async (e) => {
      e.preventDefault();
      try { await api.report(type, id, $('#rr', p).value.trim()); if ($('#rb', p).checked && userId) await api.block(userId); close(); toast('Thanks. We’ll review it.'); } catch (err) { toast(err.message); }
    };
  });
}

function editEntry(e = null) {
  const st = { photos: [...(e?.photos || [])], newFiles: [], people: [...(e?.people || [])], rating: e?.rating || 0, place: e ? { name: e.place_name, lat: e.lat, lng: e.lng } : null };
  modal(`
    <h2>${e ? 'Edit entry' : 'New journal entry'}</h2>
    <form class="stack" id="jf" style="margin-top:14px">
      <div class="field"><label for="jt">Title</label><input class="input" id="jt" required maxlength="80" value="${esc(e?.title || '')}" placeholder="e.g. Sunset at Sossusvlei"></div>
      <div class="field"><label>Photos <span class="muted" id="phc"></span></label><div class="photos" id="phs"></div></div>
      <div class="field"><label>Location</label><div id="jplace"></div>${e?.place_name ? `<span class="small muted">Current: ${esc(e.place_name)}</span>` : ''}</div>
      <div class="grid g2"><div class="field"><label for="jd">Date</label><input class="input" id="jd" type="date" value="${esc(e?.visited_on || '')}"></div>
        <div class="field"><label>Your rating</label><div class="stars" id="jr">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div></div></div>
      <div class="field"><label for="js">Your story</label><textarea class="input" id="js" maxlength="528" placeholder="What was it like? What would you tell a friend?">${esc(e?.story || '')}</textarea><span class="counter" id="jsc"></span></div>
      <div class="field"><label>People you met</label><div id="ppl"></div>
        <div class="grid g3"><input class="input" id="pn" placeholder="Name" maxlength="60" aria-label="Name"><input class="input" id="pfrom" placeholder="From (country)" maxlength="60" aria-label="Where they come from"><input class="input" id="pu" placeholder="@username (optional)" maxlength="21" aria-label="Their app username"></div>
        <button type="button" class="btn small ghost" id="padd" style="align-self:flex-start">Add person</button>
        <span class="small muted">If they’re on SpeedCurrency, add their @username to link them (they control whether they can be tagged).</span></div>
      <div class="row between"><span>Public (others can see this entry)</span><button type="button" class="switch" role="switch" id="jpub" aria-checked="${e?.is_public ? 'true' : 'false'}" aria-label="Public entry"></button></div>
      <div class="row"><button class="btn primary" style="flex:1" id="jsave">Save entry</button><button type="button" class="btn ghost" data-close>Cancel</button></div>
    </form>`, async (p, close) => {
    const urls = await api.photoUrls(st.photos);
    const drawPhotos = () => {
      const total = st.photos.length + st.newFiles.length;
      $('#phc', p).textContent = `${total} of 6`;
      $('#phs', p).innerHTML = [
        ...st.photos.map((ph, i) => `<div class="ph" style="background-image:url('${esc(urls[i] || ph)}')"><button type="button" data-rm="o${i}" aria-label="Remove photo">✕</button></div>`),
        ...st.newFiles.map((f, i) => `<div class="ph" style="background-image:url('${esc(f.url)}')"><button type="button" data-rm="n${i}" aria-label="Remove photo">✕</button></div>`),
        total < 6 ? `<label class="add">${icon('plus', 22)}Add<input type="file" accept="image/*" multiple hidden id="phin"></label>` : '',
      ].join('');
      $$('[data-rm]', p).forEach((b) => b.onclick = () => { const k = b.dataset.rm; if (k[0] === 'o') { st.photos.splice(+k.slice(1), 1); urls.splice(+k.slice(1), 1); } else st.newFiles.splice(+k.slice(1), 1); drawPhotos(); });
      const inp = $('#phin', p);
      if (inp) inp.onchange = async () => {
        const room = 6 - st.photos.length - st.newFiles.length;
        for (const f of [...inp.files].slice(0, room)) { const blob = await shrink(f); st.newFiles.push({ blob, url: URL.createObjectURL(blob) }); }
        if (inp.files.length > room) toast('Max 6 photos per entry');
        drawPhotos();
      };
    };
    drawPhotos();
    placePicker($('#jplace', p), (pl) => { st.place = { name: pl.name + (pl.detail ? ', ' + pl.detail : ''), lat: pl.lat, lng: pl.lng }; });
    const stars = () => $$('#jr button', p).forEach((b) => b.classList.toggle('on', +b.dataset.n <= st.rating));
    $$('#jr button', p).forEach((b) => b.onclick = () => { st.rating = +b.dataset.n; stars(); }); stars();
    const cnt = () => { $('#jsc', p).textContent = `${$('#js', p).value.length} / 528`; }; $('#js', p).addEventListener('input', cnt); cnt();
    const drawPeople = () => {
      $('#ppl', p).innerHTML = st.people.map((x, i) => `<div class="person"><span class="avatar">${esc((x.name || '?')[0].toUpperCase())}</span><span style="flex:1"><b>${esc(x.name)}</b><br><span class="small muted">From ${esc(x.from_country || '?')}</span></span>${x.username ? `<span class="badge ok">@${esc(x.username)}</span>` : '<span class="badge">Invite later</span>'}<button type="button" class="btn small ghost" data-pr="${i}" aria-label="Remove">✕</button></div>`).join('');
      $$('[data-pr]', p).forEach((b) => b.onclick = () => { st.people.splice(+b.dataset.pr, 1); drawPeople(); });
    };
    drawPeople();
    $('#padd', p).onclick = async () => {
      const name = $('#pn', p).value.trim(); if (!name) { toast('Add their name'); return; }
      let username = $('#pu', p).value.trim().replace(/^@/, '').toLowerCase() || null;
      let from = $('#pfrom', p).value.trim();
      if (username) {
        const found = await api.findTraveller(username);
        if (!found && !DEMO) { toast('No traveller with that username (or they turned tagging off)'); username = null; }
        if (found && !from) from = found.home_country;
      }
      st.people.push({ name, from_country: from, username });
      ['#pn', '#pfrom', '#pu'].forEach((s) => { $(s, p).value = ''; });
      drawPeople();
    };
    const pub = $('#jpub', p); pub.onclick = () => pub.setAttribute('aria-checked', String(pub.getAttribute('aria-checked') !== 'true'));
    $('#jf', p).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('#jsave', p); btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const uploaded = [];
        for (const f of st.newFiles) uploaded.push(await api.uploadPhoto(f.blob));
        const row = {
          title: $('#jt', p).value.trim(), place_name: st.place?.name || null, lat: st.place?.lat ?? null, lng: st.place?.lng ?? null,
          visited_on: $('#jd', p).value || null, rating: st.rating || null, story: $('#js', p).value.trim() || null,
          photos: [...st.photos, ...uploaded].slice(0, 6), people: st.people, is_public: pub.getAttribute('aria-checked') === 'true',
        };
        if (e) await api.update('journal_entries', e.id, row); else await api.insert('journal_entries', row);
        close(); toast('Journal saved'); location.hash = '#/journal'; render();
      } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = 'Save entry'; }
    });
  });
}

/* =========================================================
   ACCOUNT, PREMIUM, PRIVACY
   ========================================================= */
const COUNTRIES = (() => { try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); const codes = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' '); return codes.map((c) => dn.of(c)).sort(); } catch { return []; } })();
const countryOptions = (sel) => `<option value="">Choose…</option>${COUNTRIES.map((c) => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('')}`;

async function Account(main, r) {
  const p = S.profile = await api.profile();
  const [used, bal, ledger] = await Promise.all([api.plannerUsage(), api.balance(), api.ledger()]);
  const t = tier();
  const invite = `${location.origin}${location.pathname}?ref=${p.referral_code || ''}`;
  let mfa = null;
  if (!DEMO) { const { data } = await sb.auth.mfa.listFactors(); mfa = data?.totp?.find((f) => f.status === 'verified') || null; }
  const planCard = (key, name, price, yearly, perks, cta) => `<div class="card stack ${key === t ? 'dark' : ''}" style="padding:18px">
    <div class="row between"><b style="font-size:18px">${name}</b>${key === t ? '<span class="badge dark">Current</span>' : ''}</div>
    <span class="price">${price}</span>${yearly ? `<span class="small ${key === t ? '' : 'muted'}">${yearly}</span>` : ''}
    <ul style="margin:0;padding-left:18px">${perks.map((x) => `<li>${x}</li>`).join('')}</ul>${cta}</div>`;
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Account · ${t.toUpperCase()}</span><h1>${esc(p.display_name || 'Your account')}</h1><p>${esc(S.user.email || '')}${p.username ? ' · @' + esc(p.username) : ''}</p></div>
    <button class="btn ghost" id="out">Sign out</button></div>

  <div class="grid g2" style="align-items:start">
    <section class="stack">
      <form class="card stack" id="pform"><h2>Profile</h2>
        <div class="grid g2">
          <div class="field"><label for="pname">Name</label><input class="input" id="pname" maxlength="60" value="${esc(p.display_name || '')}"></div>
          <div class="field"><label for="puser">Username</label><input class="input" id="puser" maxlength="20" placeholder="e.g. gmega" value="${esc(p.username || '')}"></div>
        </div>
        <div class="field"><label for="pbio">Short bio</label><input class="input" id="pbio" maxlength="160" value="${esc(p.bio || '')}" placeholder="Producer, explorer, coffee lover"></div>
        <div class="field"><label>Home country</label>
          <div class="row" style="min-height:48px;padding:0 14px;border-radius:14px;background:var(--soft)">${icon('lock', 16)}<b>${esc(p.home_country || 'Detecting…')}</b></div>
          <span class="small muted">Set from where this account was created. It can’t be changed.</span></div>
        <div class="field"><label>Residential address</label><div id="paddr"></div>${p.residential_address ? `<span class="small muted">Current: ${esc(p.residential_address)}</span>` : ''}</div>
        <h3 style="margin-top:6px">${icon('passport', 18)} Travel documents</h3>
        <div class="grid g2">
          <div class="field"><label for="pnat">Nationality</label><select class="input" id="pnat">${countryOptions(p.nationality)}</select></div>
          <div class="field"><label for="ppass">Passport issued by</label><select class="input" id="ppass">${countryOptions(p.passport_country || p.home_country)}</select></div>
          <div class="field"><label for="pexp">Passport expiry date</label><input class="input" id="pexp" type="date" value="${esc(p.passport_expiry || '')}"></div>
          <div class="field"><label for="pcur">Preferred currency</label><input class="input" id="pcur" maxlength="3" value="${esc(p.preferred_currency || homeCurrency(p.home_country_code))}" autocapitalize="characters"></div>
        </div>
        <p class="small muted" style="margin:0">We never ask for your passport number. The assistant uses the issuing country and expiry date to check entry rules.</p>
        <h3 style="margin-top:6px">Emergency contact</h3>
        <div class="grid g2">
          <div class="field"><label for="pen">Name</label><input class="input" id="pen" maxlength="80" value="${esc(p.emergency_name || '')}"></div>
          <div class="field"><label for="pep">Phone</label><input class="input" id="pep" maxlength="30" inputmode="tel" value="${esc(p.emergency_phone || '')}"></div>
        </div>
        <button class="btn primary">Save profile</button>
      </form>

      <div class="card stack"><h2>${icon('shield', 20)} Security</h2>
        <div class="row between"><span>Two-step sign-in (optional)<br><span class="small muted">${mfa ? 'On: a code from your authenticator app is needed at sign-in.' : 'Add a code from an authenticator app (Google Authenticator, Authy…).'}</span></span>
          <button class="btn small ${mfa ? 'ghost' : 'dark'}" id="mfa">${mfa ? 'Turn off' : 'Turn on'}</button></div>
        <div class="row between"><span>Password</span><button class="btn small ghost" id="pw">Change password</button></div>
      </div>

      <div class="card stack"><h2>Privacy</h2>
        <div class="row between"><span>Public journal<br><span class="small muted">Lets others see entries you mark public</span></span><button class="switch" role="switch" data-f="public_journal" aria-checked="${p.public_journal}" aria-label="Public journal"></button></div>
        <div class="row between"><span>Let people tag me<br><span class="small muted">Others can link you in “people met”</span></span><button class="switch" role="switch" data-f="allow_tags" aria-checked="${p.allow_tags}" aria-label="Let people tag me"></button></div>
        <p class="small muted" style="margin:0">The assistant is powered by Claude. Don’t include passport numbers or other private details in questions.</p>
      </div>
    </section>

    <section class="stack">
      <div class="card stack" id="tokens"><h2>${icon('token', 20)} Tokens: ${bal}</h2>
        <p class="muted" style="margin:0">Tokens pay for messages (1), comments (1) and extra assistant questions (${C.TOKENS_PER_EXTRA_QUESTION}). Messaging and comments are free on Premium and Pro.</p>
        <div class="field"><label for="inv">Your invite link: you get 50 tokens per friend who joins, and they get 40.</label>
          <div class="row"><input class="input" id="inv" readonly value="${esc(invite)}"><button class="btn dark" id="share">Share</button></div></div>
        <details><summary class="small"><b>Recent activity</b></summary><div class="list" style="margin-top:6px">${ledger.map((x) => `<div class="row between"><span>${esc(x.reason)}<br><span class="small muted">${fmtDate(x.created_at)}</span></span><b style="color:${x.delta > 0 ? 'var(--ok)' : 'var(--accent-dark)'}">${x.delta > 0 ? '+' : ''}${x.delta}</b></div>`).join('')}</div></details>
      </div>

      <div class="stack" id="plans"><h2>Plans</h2><p class="small muted" style="margin:0">${used} of ${planLimit()} assistant questions used this month.</p>
        ${planCard('free', 'Free', 'N$0', '', [`${C.FREE_PLANS_PER_MONTH} Claude questions a month`, 'Journal, map, trips, converter', '20 tokens to start (40 if invited)', 'Ads shown'], '')}
        ${planCard('premium', 'Premium', `N$${C.PRICE_MONTHLY}/mo`, `or N$${money(C.PRICE_YEARLY, 0)}/year`, [`${C.PREMIUM_PLANS_PER_MONTH} Claude questions a month with live web search`, 'Free messaging and comments', '100 bonus tokens each payment', 'Digital album, no ads'],
          t === 'free' ? `<div class="row wrap"><button class="btn primary" data-pay="monthly">Monthly</button><button class="btn" data-pay="yearly">Yearly</button></div>` : '')}
        ${planCard('pro', 'Pro', `N$${C.PRICE_PRO_MONTHLY}/mo`, `or N$${money(C.PRICE_PRO_YEARLY, 0)}/year`, [`${C.PRO_PLANS_PER_MONTH} questions on Claude Sonnet, deeper research`, 'Tailored adventures, money and journal coaching', '300 bonus tokens each payment', 'Everything in Premium'],
          t !== 'pro' ? `<div class="row wrap"><button class="btn primary" data-pay="pro_monthly">Monthly</button><button class="btn" data-pay="pro_yearly">Yearly</button></div>` : '')}
        ${premium() ? `<p class="small muted">Active until ${fmtDate(p.premium_until)}.</p>` : ''}
        <span class="small muted">Card or mobile money through DPO Pay.</span>
      </div>
      ${adBlock()}
    </section>
  </div>`;
  let addr = p.residential_address ? { name: p.residential_address, lat: p.residential_lat, lng: p.residential_lng } : null;
  placePicker($('#paddr'), (pl) => { addr = { name: (pl.name + (pl.detail ? ', ' + pl.detail : '')).slice(0, 200), lat: pl.lat, lng: pl.lng }; });
  $('#out').onclick = async () => { await api.signOut(); S.user = null; S.profile = null; CACHE.clear(); location.hash = '#/auth'; render(); };
  $('#pform').onsubmit = async (e) => {
    e.preventDefault();
    const username = $('#puser').value.trim().toLowerCase();
    if (username && !/^[a-z0-9_]{3,20}$/.test(username)) { toast('Username: 3–20 letters, numbers or _'); return; }
    const cur = $('#pcur').value.trim().toUpperCase();
    try {
      await api.updateProfile({
        display_name: $('#pname').value.trim(), username: username || null, bio: $('#pbio').value.trim() || null,
        residential_address: addr?.name || null, residential_lat: addr?.lat ?? null, residential_lng: addr?.lng ?? null,
        nationality: $('#pnat').value || null, passport_country: $('#ppass').value || null, passport_expiry: $('#pexp').value || null,
        emergency_name: $('#pen').value.trim() || null, emergency_phone: $('#pep').value.trim() || null, preferred_currency: /^[A-Z]{3}$/.test(cur) ? cur : null,
      });
      S.profile = await api.profile(); toast('Profile saved');
    } catch (err) { toast(err.message); }
  };
  $$('[data-f]').forEach((b) => b.onclick = async () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); await api.updateProfile({ [b.dataset.f]: v }); });
  $$('[data-pay]').forEach((b) => b.onclick = async () => { b.disabled = true; try { location.href = await api.pay(b.dataset.pay); } catch (e) { toast(e.message); b.disabled = false; } });
  $('#share').onclick = async () => {
    const text = `Join me on SpeedCurrency: plan trips with a Claude-powered assistant, journal your travels and convert money. ${invite}`;
    if (navigator.share) { try { await navigator.share({ title: 'SpeedCurrency', text, url: invite }); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(invite); toast('Invite link copied'); } catch { $('#inv').select(); } }
  };
  $('#pw').onclick = () => modal(`<h2>Change password</h2><form class="stack" id="pwf" style="margin-top:12px"><div class="field"><label for="npw">New password</label><input class="input" id="npw" type="password" minlength="8" autocomplete="new-password" required></div><button class="btn primary">Save password</button></form>`, (pnl, close) => {
    $('#pwf', pnl).onsubmit = async (e) => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: $('#npw', pnl).value }); if (error) toast(error.message); else { close(); toast('Password changed'); } };
  });
  $('#mfa').onclick = async () => {
    if (DEMO) return toast('Two-step sign-in works once you are signed in online.');
    if (mfa) { if (!confirm('Turn off two-step sign-in?')) return; const { error } = await sb.auth.mfa.unenroll({ factorId: mfa.id }); if (error) return toast(error.message); toast('Two-step sign-in is off'); return render(); }
    const { data: old } = await sb.auth.mfa.listFactors();
    for (const f of old?.all || []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SpeedCurrency' });
    if (error) return toast(error.message);
    modal(`<h2>Turn on two-step sign-in</h2><ol class="small" style="padding-left:18px"><li>Open your authenticator app and scan this code (or enter the key).</li><li>Type the 6-digit code it shows.</li></ol>
      <img src="${esc(data.totp.qr_code)}" alt="QR code for your authenticator app" style="width:200px;height:200px;background:#fff;border-radius:12px;padding:8px">
      <p class="small">Key: <code style="word-break:break-all">${esc(data.totp.secret)}</code></p>
      <form class="stack" id="mfe"><label class="sr" for="mfec">Code</label><input class="input" id="mfec" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required placeholder="123456"><button class="btn primary">Verify and turn on</button></form>`, (pnl, close) => {
      $('#mfe', pnl).onsubmit = async (e) => {
        e.preventDefault();
        const { error: err } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: $('#mfec', pnl).value.trim() });
        if (err) return toast('That code didn’t work. Try the newest code.');
        close(); toast('Two-step sign-in is on'); render();
      };
    });
  };
  if (r?.q.get('tab')) $('#' + r.q.get('tab'))?.scrollIntoView({ block: 'start' });
}

/* =========================================================
   ALBUM: every journal photo, grouped by country and year
   ========================================================= */
async function Album(main) {
  const entries = (await api.list('journal_entries', { order: 'visited_on' })).filter((e) => e.photos?.length);
  const all = entries.flatMap((e) => e.photos.map((ph) => ({ ph, e })));
  const urls = await api.photoUrls(all.map((x) => x.ph));
  all.forEach((x, i) => { x.url = urls[i]; });
  const key = (e) => { const c = (e.place_name || '').split(',').pop().trim() || 'Other places'; const y = (e.visited_on || e.created_at || '').slice(0, 4); return `${c}${y ? ' · ' + y : ''}`; };
  const groups = {};
  for (const x of all) (groups[key(x.e)] ||= []).push(x);
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Album</span><h1>Your travel album</h1><p>${all.length} photos from ${entries.length} journal entries, grouped by place and year.</p></div>
    <div class="row wrap"><button class="btn dark" id="slides" ${all.length ? '' : 'disabled'}>${icon('album', 18)} Slideshow</button><a class="btn primary" href="#/journal?new=1">${icon('plus', 18)} Add photos</a></div></div>
  ${all.length ? Object.entries(groups).map(([g, xs]) => `<section class="section"><h2>${esc(g)}</h2><div class="album">${xs.map((x) => `<button class="ph" data-i="${all.indexOf(x)}" style="background-image:url('${esc(x.url)}')" aria-label="${esc(x.e.title)}"><span>${esc(x.e.title)}</span></button>`).join('')}</div></section>`).join('')
    : '<div class="empty">No photos yet. Add up to 6 per journal entry.</div>'}`;
  $$('[data-i]').forEach((b) => b.onclick = () => viewer(all.map((x) => x.url), +b.dataset.i));
  const sl = $('#slides'); if (sl) sl.onclick = () => viewer(all.map((x) => x.url), 0);
}

/* =========================================================
   EXPLORE: public journal entries from other travellers
   ========================================================= */
async function Explore(main) {
  const feed = await api.feed();
  const people = await api.profilesById(feed.map((e) => e.user_id));
  const covers = await api.photoUrls(feed.map((e) => e.photos?.[0]).filter(Boolean));
  let ci = 0;
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Explore</span><h1>Travellers’ stories</h1><p>Public journal entries. Comment, or message the traveller.</p></div>
    <a class="btn ghost" href="#/account?tab=tokens">${icon('gift', 18)} Invite friends</a></div>
  ${feed.length ? `<div class="grid g2">${feed.map((e) => { const a = people[e.user_id]; return `<a class="card entry" href="#/journal/${e.id}" style="text-decoration:none;color:inherit">
      <div class="cover" style="${e.photos?.length ? `background-image:url('${esc(covers[ci++])}')` : ''}"></div>
      <div class="stack" style="gap:4px"><span class="small muted">${esc(a?.display_name || '@' + (a?.username || 'traveller'))}${a?.home_country ? ' · ' + esc(a.home_country) : ''}</span><h2>${esc(e.title)}</h2>
        <span class="small muted">${esc(e.place_name || '')}</span>${e.rating ? `<span style="color:var(--accent)">${'★'.repeat(e.rating)}</span>` : ''}
        <span class="small">${esc((e.story || '').slice(0, 110))}${(e.story || '').length > 110 ? '…' : ''}</span></div></a>`; }).join('')}</div>`
    : `<div class="empty">No public stories yet. Make one of yours public from your journal, and share your invite link so friends can join.</div>`}`;
}

/* =========================================================
   CHATS: live direct messages between travellers
   ========================================================= */
async function Messages(main, r) {
  if (DEMO) { main.innerHTML = '<div class="empty">Chats work once you are signed in online.</div>'; return; }
  const convs = await api.conversations();
  const others = convs.map((c) => (c.user_a === S.user.id ? c.user_b : c.user_a));
  let toId = r.q.get('to');
  const people = await api.profilesById([...others, toId]);
  let active = r.id || (toId ? convs.find((c) => [c.user_a, c.user_b].includes(toId))?.id : null) || null;
  if (active) toId = null;
  const name = (id) => { const p = people[id]; return p ? (p.display_name || '@' + (p.username || 'traveller')) : 'Traveller'; };
  const conv = convs.find((c) => c.id === active);
  const otherId = conv ? (conv.user_a === S.user.id ? conv.user_b : conv.user_a) : toId;
  main.innerHTML = `
  <div class="page-head"><div><span class="eyebrow">Chats</span><h1>Messages</h1><p>${premium() ? 'Messaging is free on your plan.' : 'Each message uses 1 token. Free on Premium and Pro.'}</p></div>
    <button class="btn dark" id="newchat">${icon('plus', 18)} New chat</button></div>
  <div class="planner">
    <aside class="history" aria-label="Conversations">${convs.length ? convs.map((c) => { const o = c.user_a === S.user.id ? c.user_b : c.user_a; return `<a href="#/messages/${c.id}" ${c.id === active ? 'aria-current="true"' : ''}><b>${esc(name(o))}</b><br><span class="date">${fmtDate(c.last_at)}</span></a>`; }).join('') : '<p class="small muted">No chats yet.</p>'}</aside>
    <section class="chat">${otherId ? `
      <div class="row between"><h2>${esc(name(otherId))}</h2><button class="btn small ghost" id="crep">Report or block</button></div>
      <div class="msgs" id="dm" aria-live="polite"></div>
      <form class="composer" id="dmf"><label class="sr" for="dmt">Message</label><textarea class="input" id="dmt" rows="1" maxlength="1000" placeholder="Write a message…"></textarea><button class="btn dark" aria-label="Send">${icon('send')}</button></form>`
      : '<div class="empty">Pick a chat, or start a new one with a traveller’s @username.</div>'}</section>
  </div>`;
  $('#newchat').onclick = () => modal(`<h2>New chat</h2><form class="stack" id="ncf" style="margin-top:12px"><div class="field"><label for="ncu">Traveller’s username</label><input class="input" id="ncu" placeholder="@username" maxlength="21" required></div><button class="btn primary">Open chat</button></form>`, (p, close) => {
    $('#ncf', p).onsubmit = async (e) => { e.preventDefault(); const f = await api.findTraveller($('#ncu', p).value.trim()); if (!f) return toast('No traveller with that username'); close(); location.hash = `#/messages?to=${f.id}`; };
  });
  if (!otherId) return;
  $('#crep').onclick = () => reportFlow('user', otherId, otherId);
  const dm = $('#dm');
  const paint = (list) => { dm.innerHTML = list.map((m) => `<div class="${m.sender_id === S.user.id ? 'bubble-user' : 'bubble-them'}">${esc(m.body)}<span class="t">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') || '<p class="small muted">Say hello 👋</p>'; dm.lastElementChild?.scrollIntoView({ block: 'end' }); };
  let list = active ? await api.messages(active) : [];
  paint(list);
  if (active) {
    const ch = sb.channel('dm-' + active).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active}` }, (payload) => {
      if (!list.find((m) => m.id === payload.new.id)) { list.push(payload.new); paint(list); }
    }).subscribe();
    cleanup = () => sb.removeChannel(ch);
  }
  const ta = $('#dmt');
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#dmf').requestSubmit(); } });
  $('#dmf').onsubmit = async (e) => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) return;
    ta.value = '';
    try {
      const convId = await api.sendMessage(otherId, body);
      if (!active) { location.hash = `#/messages/${convId}`; return; }
      const fresh = await api.messages(active); list = fresh; paint(list);
    } catch (err) { ta.value = body; toast(err.message); }
  };
}

/* =========================================================
   START
   ========================================================= */
async function mfaGate() {
  if (DEMO) return true;
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!data || data.currentLevel === data.nextLevel || data.nextLevel !== 'aal2') return true;
  const { data: f } = await sb.auth.mfa.listFactors();
  const factor = f?.totp?.find((x) => x.status === 'verified');
  if (!factor) return true;
  return await new Promise((resolve) => {
    modal(`<h2>Two-step check</h2><p class="muted">Enter the 6-digit code from your authenticator app.</p>
      <form class="stack" id="mfaf" style="margin-top:12px"><label class="sr" for="mfac">Code</label>
      <input class="input" id="mfac" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required placeholder="123456">
      <button class="btn primary">Verify</button><button type="button" class="btn ghost" id="mfaout">Sign out instead</button></form>`, (pnl, close) => {
      $('#mfaout', pnl).onclick = async () => { await sb.auth.signOut(); close(); resolve(false); };
      $('#mfaf', pnl).onsubmit = async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: $('#mfac', pnl).value.trim() });
        if (error) { toast('That code didn’t work. Try the newest code.'); return; }
        close(); resolve(true);
      };
    });
  });
}
async function boot() {
  try { const ref = new URLSearchParams(location.search).get('ref'); if (ref) localStorage.setItem('sc_ref', ref.toLowerCase().slice(0, 12)); } catch { /* ignore */ }
  S.user = await api.user();
  if (!S.user) return;
  if (!(await mfaGate())) { S.user = null; return; }
  S.profile = await api.profile();
  if (!DEMO && S.profile && !S.profile.home_country) { try { await api.register(); S.profile = await api.profile(); } catch { /* retried next load */ } }
  startReminders();
}
async function handlePaymentReturn() {
  const qs = new URLSearchParams(location.search);
  const token = qs.get('TransactionToken') || qs.get('TransID');
  if (!token || DEMO || !S.user) return;
  try { const r = await api.verifyPayment(token); toast(r.ok ? 'Payment received – welcome to Premium' : `Payment not completed: ${r.status || ''}`); S.profile = await api.profile(); } catch { toast('We could not confirm the payment yet. Refresh in a minute.'); }
  history.replaceState(null, '', location.pathname + '#/account');
}
if (sb) sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { S.user = null; } });
await boot();
await handlePaymentReturn();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
