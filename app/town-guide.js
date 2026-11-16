// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Town Guide: tap a town (e.g. Swakopmund) and get far more than a Wikipedia summary.
// Photo gallery (Wikimedia Commons), top attractions / things to do / malls / eat / nightlife / stay
// (Wikivoyage travel guide listings), sport and malls nearby (OpenStreetMap), events (news), weather,
// and the travellers who have been there. Free: a taste of each list. Premium: everything.
import { overpass, CATS } from './explore-map.js';
import { safeImg } from './explore-swipe.js';
import { newsCover } from './news-cover.js';
import { mountHeadsups } from './headsups.js';

const SECTIONS = [ // Wikivoyage listing type -> our section
  ['see', 'Top attractions', '🏛'], ['do', 'Things to do', '🏄'], ['buy', 'Malls, markets & shops', '🛍'],
  ['eat', 'Where to eat', '🍽'], ['drink', 'Nightlife & cafés', '🍸'], ['sleep', 'Where to stay', '🛏'],
];
const FREE_PER_SECTION = 4;
const fmtKm = (d) => (d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1) + ' km');
const HEAD_TO_TYPE = { see: 'see', do: 'do', buy: 'buy', eat: 'eat', drink: 'drink', sleep: 'sleep' };

/* ---------- Wikivoyage: a free, community travel guide with named listings ---------- */
const clean = (t) => {
  let s = String(t || '');
  s = s.replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]+\]/g, '');
  for (let k = 0; k < 4; k++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  return s.replace(/'{2,}/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
};

function parseListings(wt) {
  const heads = [...wt.matchAll(/^==([^=].*?)==\s*$/gm)].map((m) => ({ i: m.index, t: m[1].trim().toLowerCase() }));
  const headAt = (i) => { let t = ''; for (const h of heads) { if (h.i < i) t = h.t; else break; } return t; };
  const out = [];
  for (const m of wt.matchAll(/\{\{\s*(see|do|buy|eat|drink|sleep|listing)\s*\|/gi)) {
    let d = 0, j = m.index;
    for (; j < wt.length; j++) { if (wt.startsWith('{{', j)) { d++; j++; } else if (wt.startsWith('}}', j)) { d--; j++; if (!d) break; } }
    let body = wt.slice(m.index + m[0].length, j - 1);
    body = body.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
    for (let k = 0; k < 4; k++) body = body.replace(/\{\{[^{}]*\}\}/g, '');
    const p = {};
    for (const part of body.split('|')) { const e = part.indexOf('='); if (e > 0) p[part.slice(0, e).trim().toLowerCase()] = part.slice(e + 1).trim(); }
    const name = clean(p.name); if (!name) continue;
    const type = m[1].toLowerCase() === 'listing' ? HEAD_TO_TYPE[headAt(m.index)] : m[1].toLowerCase();
    if (!type) continue;
    out.push({ type, name, text: clean(p.content || p.description), url: /^https?:\/\//.test(p.url || '') ? p.url : '',
      lat: parseFloat(p.lat), lng: parseFloat(p.long), hours: clean(p.hours), price: clean(p.price), address: clean(p.address) });
  }
  return out;
}

export async function wikivoyage(town) {
  const api = 'https://en.wikivoyage.org/w/api.php?format=json&origin=*';
  const get = async (page) => { const j = await fetch(`${api}&action=parse&prop=wikitext&redirects=1&page=${encodeURIComponent(page)}`, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()); return j?.parse ? { title: j.parse.title, wt: j.parse.wikitext['*'] } : null; };
  let hit = await get(town).catch(() => null);
  if (!hit) { // fall back to a search, e.g. "Etosha" -> "Etosha National Park"
    const s = await fetch(`${api}&action=query&list=search&srlimit=1&srsearch=${encodeURIComponent(town)}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json()).catch(() => null);
    const t = s?.query?.search?.[0]?.title; if (t) hit = await get(t).catch(() => null);
  }
  if (!hit) return null;
  const intro = clean((hit.wt.split(/^==/m)[0] || '').replace(/\{\{[\s\S]*?\}\}/g, '')).slice(0, 420);
  return { title: hit.title, intro, listings: parseListings(hit.wt), url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}` };
}

const COUNTRY = {
  NA: { name: 'Namibia', money: 'Namibian dollar (N$, NAD) · rand accepted 1:1', dial: '+264', sos: '10111 police · 211111 ambulance (Windhoek)' },
  ZA: { name: 'South Africa', money: 'South African rand (R, ZAR)', dial: '+27', sos: '10111 police · 10177 ambulance · 112 mobile' },
};
async function wikidataFacts(q) { // population, elevation, founded (free, Wikidata)
  const w = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&prop=pageprops&ppprop=wikibase_item&format=json&origin=*`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
  const id = Object.values(w?.query?.pages || {})[0]?.pageprops?.wikibase_item; if (!id) return {};
  const j = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=claims&format=json&origin=*`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
  const cl = j?.entities?.[id]?.claims || {};
  const val = (p) => (cl[p] || []).map((x) => ({ v: x.mainsnak?.datavalue?.value, t: x.qualifiers?.P585?.[0]?.datavalue?.value?.time || '' })).filter((x) => x.v != null).sort((a, b) => (a.t < b.t ? 1 : -1))[0];
  const pop = val('P1082'), ele = val('P2044'), inc = val('P571');
  return { population: pop ? Math.round(+pop.v.amount).toLocaleString('en-ZA') + (pop.t ? ` (${pop.t.slice(1, 5)})` : '') : '', elevation: ele ? Math.round(+ele.v.amount) + ' m' : '', founded: inc?.v?.time ? inc.v.time.slice(1, 5).replace(/^0+/, '') : '' };
}
const OPENERS = ['', 'Good news: ', 'Sure: ', '', 'Here you go: ']; // varied, never a re-introduction
const INTENTS = [ // keywords -> where in the guide to look
  [/fuel|petrol|diesel|gas station|garage|filling|tyre|mechanic/i, 'fuel', 'for fuel'],
  [/eat|food|restaurant|lunch|dinner|breakfast|hungry|cafe|coffee/i, 'eat', 'to eat'],
  [/stay|sleep|hotel|lodge|guest ?house|camp|hostel|b&b|accommodation/i, 'sleep', 'to stay'],
  [/bar|drink|night ?life|club|pub|beer/i, 'drink', 'for a drink'],
  [/mall|shop|buy|market|craft|souvenir|supermarket/i, 'buy', 'to shop'],
  [/sport|stadium|gym|golf|rugby|soccer|football|swim/i, 'sport', 'for sport'],
  [/see|visit|attraction|museum|sight|tour|things to do|activit|fun|adventure|kids/i, 'see', 'to see and do'],
  [/event|festival|concert|news|happening|this week|weekend/i, 'events', ''],
  [/weather|hot|cold|rain|temperature/i, 'weather', ''],
  [/money|currency|rand|dollar|atm|cash|bank/i, 'money', ''],
  [/emergency|police|ambulance|hospital|safe|danger/i, 'sos', ''],
];

async function gallery(c) { // free photos taken in and around town
  const u = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${c.lat}|${c.lng}&ggsradius=10000&ggsnamespace=6&ggslimit=40&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
  const j = await fetch(u, { signal: AbortSignal.timeout(9000) }).then((r) => r.json());
  return Object.values(j?.query?.pages || {}).map((pg) => pg.imageinfo?.[0]?.thumburl).filter((x) => x && /\.(jpe?g|webp)/i.test(x)).slice(0, 18);
}

async function weather(c) {
  const j = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,weather_code&timezone=auto`, { signal: AbortSignal.timeout(7000) }).then((r) => r.json());
  const code = j?.current?.weather_code; const t = j?.current?.temperature_2m;
  const icon = code == null ? '' : code === 0 ? '☀️' : code < 4 ? '⛅' : code < 50 ? '🌫' : code < 70 ? '🌧' : code < 80 ? '❄️' : '⛈';
  return t == null ? '' : `${icon} ${Math.round(t)}°C now`;
}

export async function TownGuide(main, r, { esc, api, placeSearch, tier, modal, icon, gmaps, ago, sb, S, DEMO }, opts = {}) {
  const town = decodeURIComponent(r.id || '').trim();
  if (!town) { location.hash = '#/explore'; return; }
  const premium = tier() !== 'free';
  const lockCard = (n, what) => `<a class="tg-lock" href="#/account?tab=plan"><b>🔒 ${n} more ${esc(what.toLowerCase())}</b><small>See the full guide with Premium</small></a>`;

  main.innerHTML = `
    ${opts.popup ? '' : '<a class="small" href="#/explore">← Explore</a>'}
    <header class="tg-hero" id="tghero"><span class="eyebrow" id="tgwhere">Town guide</span><h1>${esc(town)}</h1>
      <p id="tgintro" class="tg-intro"></p>
      <div class="row wrap tg-acts"><span class="tg-wx" id="tgwx"></span>
        <a class="btn small primary" href="#/explore?town=${encodeURIComponent(town)}">Swipe places</a>
        <a class="btn small ghost" href="#/trips?new=1&dest=${encodeURIComponent(town)}">${icon('plus', 16)} Save trip</a>
        ${opts.popup ? `<a class="btn small ghost" data-close href="#/town/${encodeURIComponent(town)}">Full page</a>` : ''}</div></header>
    <div class="tg-facts" id="tgfacts" aria-label="Quick facts"></div>
    <section class="tg-askbox"><form class="tg-ask" id="tgask" role="search"><label class="sr" for="tgq">Ask about ${esc(town)}</label>
      <input id="tgq" placeholder="Ask about ${esc(town)}: fuel, food, things to do…" autocomplete="off" maxlength="300"><button class="btn small primary">Ask</button></form>
      <div class="tg-ans" id="tgans" aria-live="polite"></div></section>
    <nav class="chips tg-jump" aria-label="Jump to">${SECTIONS.map(([k, l, e]) => `<a class="chip" href="#tg-${k}" data-jump="${k}">${e} ${esc(l.split(/[,&]/)[0].trim())}</a>`).join('')}<a class="chip" data-jump="fuel" href="#tg-fuel">⛽ Fuel</a><a class="chip" data-jump="sport" href="#tg-sport">🏟 Sport</a><a class="chip" data-jump="events" href="#tg-events">🎉 Events</a></nav>
    <section class="tg-social" aria-label="See ${esc(town)} on social media">${[
      ['▶', 'YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(town + ' travel guide')}`],
      ['◎', 'Instagram', `https://www.instagram.com/explore/tags/${encodeURIComponent(town.toLowerCase().replace(/[^a-z0-9]/g, ''))}/`],
      ['♪', 'TikTok', `https://www.tiktok.com/search?q=${encodeURIComponent(town + ' things to do')}`],
      ['f', 'Facebook', `https://www.facebook.com/search/top?q=${encodeURIComponent(town + ' events')}`],
    ].map(([i, n, u]) => `<a class="tg-soc" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">${i}</span>${n}</a>`).join('')}</section>
    <section class="tg-gal" id="tggal" aria-label="Photos of ${esc(town)}"><span class="tg-ph"></span><span class="tg-ph"></span><span class="tg-ph"></span></section>
    <div id="tgsecs"><div class="skeleton"><span></span><span></span><span></span></div></div>
    <section class="tg-sec" id="tg-fuel"><h2>⛽ Fuel stations & garages</h2><div id="tgfuel"><div class="skeleton"><span></span></div></div></section>
    <section class="tg-sec" id="tg-sport"><h2>🏟 Sport & malls nearby</h2><div class="tg-osm" id="tgosm"><div class="skeleton"><span></span></div></div></section>
    <section class="tg-sec" id="tg-events"><h2>🎉 Events & news</h2><div id="tgnews"><div class="skeleton"><span></span></div></div></section>
    <section class="tg-sec tg-hu" id="tghu" aria-label="Heads-ups for ${esc(town)}"></section>
    <section class="tg-sec"><h2>Travellers who've been here</h2><div id="tgppl" class="tg-ppl"><div class="skeleton"><span></span></div></div></section>
    <p class="small muted" id="tgcred">Guide listings: Wikivoyage (CC BY-SA). Photos: Wikimedia Commons. Places: © OpenStreetMap contributors.</p>`;

  // jump chips scroll inside the page (the app uses # for routing)
  main.querySelector('.tg-jump').addEventListener('click', (e) => { const a = e.target.closest('[data-jump]'); if (!a) return; e.preventDefault(); main.querySelector('#tg-' + a.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const alive = () => document.body.contains(main.querySelector('#tghero'));

  const G = { listings: [], fuel: [], sport: [], malls: [], news: [], wx: '' }; // what the ask box can answer from
  let c = null;
  const q = r.q || new URLSearchParams();
  if (q.get('lat')) c = { lat: +q.get('lat'), lng: +q.get('lng'), detail: q.get('detail') || '', cc: q.get('cc') };
  else { try { c = (await placeSearch(town))[0]; } catch { /* offline: the guide still loads text */ } }
  const cc = c?.cc || (/south africa/i.test(c?.detail || '') ? 'ZA' : 'NA'); const CO = COUNTRY[cc] || COUNTRY.NA;
  const region = (c?.detail || '').split(', ').filter((x) => x && !/namibia|south africa/i.test(x)).pop() || '';
  const facts = main.querySelector('#tgfacts');
  const paintFacts = (f = {}) => { facts.innerHTML = [['Country', CO.name], ['Region', region], ['Population', f.population], ['Elevation', f.elevation], ['Founded', f.founded], ['Money', CO.money], ['Dial code', CO.dial], ['Driving', 'on the left'], ['Time', 'UTC+2 (CAT / SAST)'], ['Emergency', CO.sos]]
    .filter(([, v]) => v).map(([k, v]) => `<span><small>${esc(k)}</small><b>${esc(v)}</b></span>`).join(''); };
  askBox(main, town, CO, G, { esc, api, gmaps });
  paintFacts(); wikidataFacts(`${town} ${CO.name}`).then((f) => { if (alive()) paintFacts(f); }).catch(() => {});
  if (c && alive()) main.querySelector('#tgwhere').textContent = [region, CO.name].filter(Boolean).join(' · ');

  // hero photo + story (Wikipedia), weather
  api.wiki(`${town} ${CO.name}`).then((w) => {
    if (!alive() || !w) return;
    const img = safeImg(w.img); const hero = main.querySelector('#tghero');
    if (img) { hero.style.backgroundImage = `linear-gradient(180deg,rgba(13,11,8,.15),rgba(13,11,8,.9)),url('${img}')`; hero.classList.add('has-photo'); }
    const intro = main.querySelector('#tgintro'); if (!intro.textContent) intro.textContent = (w.text || '').split('. ').slice(0, 2).join('. ').slice(0, 260);
  }).catch(() => {});
  if (c) weather(c).then((t) => { G.wx = t; if (alive()) main.querySelector('#tgwx').textContent = t; }).catch(() => {});

  // photo gallery: tap to enlarge
  const gal = main.querySelector('#tggal');
  if (c) gallery(c).then((pics) => {
    if (!alive()) return;
    pics = pics.map(safeImg).filter(Boolean);
    gal.innerHTML = pics.length ? pics.map((u, i) => `<button type="button" class="tg-pic" data-i="${i}" style="background-image:url('${esc(u)}')" aria-label="Photo ${i + 1} of ${esc(town)}"></button>`).join('') : '';
    if (!pics.length) gal.remove();
    gal.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) modal(`<div class="pw"><img class="tg-big" src="${esc(pics[+b.dataset.i])}" alt="Photo of ${esc(town)}"><p class="small muted" style="margin:0">Photo: Wikimedia Commons</p><button class="btn small ghost" data-close style="align-self:flex-start">Close</button></div>`); };
  }).catch(() => gal.remove()); else gal.remove();

  // the guide (Wikivoyage)
  const secs = main.querySelector('#tgsecs');
  try {
    const g = await wikivoyage(town); if (!alive()) return;
    if (!g || !g.listings.length) throw new Error('none');
    G.listings = g.listings;
    if (g.intro) main.querySelector('#tgintro').textContent = g.intro.split('. ').slice(0, 2).join('. ').slice(0, 260);
    secs.innerHTML = SECTIONS.map(([k, label, emo]) => {
      const list = g.listings.filter((x) => x.type === k); if (!list.length) return '';
      const show = premium ? list : list.slice(0, FREE_PER_SECTION);
      return `<section class="tg-sec" id="tg-${k}"><div class="row between"><h2>${emo} ${esc(label)}</h2><small class="muted">${list.length}</small></div>
        <div class="tg-list">${show.map((x) => {
          const where = Number.isFinite(x.lat) && Number.isFinite(x.lng) ? `${x.name} ${x.lat},${x.lng}` : `${x.name} ${town}`;
          return `<article class="tg-item"><b>${esc(x.name)}</b>${x.text ? `<p>${esc(x.text.slice(0, 230))}${x.text.length > 230 ? '…' : ''}</p>` : ''}
            ${[x.hours && '🕒 ' + x.hours, x.price && '💲 ' + x.price].filter(Boolean).map((t) => `<small class="muted">${esc(t.slice(0, 80))}</small>`).join('')}
            <div class="row wrap tg-btns"><a class="chip" href="${esc(gmaps(where))}" target="_blank" rel="noopener noreferrer">📍 Directions</a>${x.url ? `<a class="chip" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">🌐 Website</a>` : ''}</div></article>`;
        }).join('')}${!premium && list.length > FREE_PER_SECTION ? lockCard(list.length - FREE_PER_SECTION, label) : ''}</div></section>`;
    }).join('');
    main.querySelector('#tgcred').innerHTML = `Guide listings: <a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">Wikivoyage: ${esc(g.title)}</a> (CC BY-SA). Photos: Wikimedia Commons. Places: © OpenStreetMap contributors.`;
  } catch {
    if (alive()) secs.innerHTML = `<p class="small muted">No travel-guide listings for ${esc(town)} yet. Use the sport & malls list below, or <a href="${esc(gmaps('things to do in ' + town))}" target="_blank" rel="noopener noreferrer">search Google Maps</a>.</p>`;
  }

  // sport + malls from OpenStreetMap
  const osm = main.querySelector('#tgosm');
  if (c) {
    (async () => { const got = []; for (const k of ['fuel', 'stadium', 'shops']) got.push(await overpass(c, CATS.find((x) => x[0] === k)).catch(() => null)); return got; })().then(([fuel, sport, shops]) => { // one at a time: the free map server allows 2 requests per person
      if (!alive()) return;
      const busy = (what) => `<p class="small muted">The free map service is busy right now. <a href="${esc(gmaps(what + ' near ' + town))}" target="_blank" rel="noopener noreferrer">Find ${esc(what)} on Google Maps</a>.</p>`;
      if (!fuel) main.querySelector('#tgfuel').innerHTML = busy('fuel stations');
      if (!sport && !shops) { osm.innerHTML = busy('malls and stadiums'); if (!fuel) return; }
      fuel ||= []; sport ||= []; shops ||= [];
      const malls = shops.filter((p) => /mall|department/i.test(p.kind)).concat(shops.filter((p) => !/mall|department/i.test(p.kind)));
      Object.assign(G, { sport, malls, fuel });
      if (fuel.length || !main.querySelector('#tgfuel .small')) main.querySelector('#tgfuel').innerHTML = fuel.length ? `<div class="tg-list">${(premium ? fuel.slice(0, 20) : fuel.slice(0, 6)).map((p) => `<a class="tg-row" href="${esc(gmaps(`${p.name} ${p.lat},${p.lng}`))}" target="_blank" rel="noopener noreferrer"><b>⛽ ${esc(p.name)}</b><small class="muted">${esc(p.kind || 'fuel')} · ${fmtKm(p.dist)} from the centre${p.hours ? ' · ' + esc(p.hours.slice(0, 40)) : ''}</small></a>`).join('')}</div>` : '<p class="small muted">No fuel stations mapped here yet.</p>';
      const block = (title, arr) => { if (!arr.length) return ''; const show = premium ? arr.slice(0, 20) : arr.slice(0, FREE_PER_SECTION);
        return `<h3>${esc(title)}</h3><div class="tg-list">${show.map((p) => `<a class="tg-row" href="${esc(gmaps(`${p.name} ${p.lat},${p.lng}`))}" target="_blank" rel="noopener noreferrer"><b>${esc(p.name)}</b><small class="muted">${esc(p.kind || '')} · ${fmtKm(p.dist)}</small></a>`).join('')}${!premium && arr.length > FREE_PER_SECTION ? lockCard(Math.min(arr.length, 20) - FREE_PER_SECTION, title) : ''}</div>`; };
      if (sport.length || shops.length || osm.querySelector('.skeleton')) osm.innerHTML = block('Stadiums, gyms & golf', sport) + block('Malls & shops', malls) || '<p class="small muted">Nothing mapped nearby yet.</p>';
    });
  } else { osm.innerHTML = '<p class="small muted">Could not find this town on the map.</p>'; main.querySelector('#tgfuel').innerHTML = ''; }

  // events & news
  const country = cc;
  api.news({ place: town, days: 60, topic: 'events', source: 'all', country }).then((res) => {
    if (!alive()) return; const box = main.querySelector('#tgnews');
    const items = (res.items || []).slice(0, premium ? 8 : 3); G.news = items;
    box.innerHTML = items.length ? items.map((x) => `<a class="tg-row tg-news" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${newsCover(x, town, esc)}<b>${esc(x.title)}</b><small class="muted">${esc(x.source || 'News')} · ${ago(x.published)}</small></a>`).join('') + `<a class="small" href="#/updates?place=${encodeURIComponent(town)}">Open the full newspaper →</a>`
      : `<p class="small muted">No events found in the last 2 months. <a href="https://www.google.com/search?q=${encodeURIComponent('events this month ' + town)}" target="_blank" rel="noopener noreferrer">Search events</a></p>`;
  }).catch(() => { const box = main.querySelector('#tgnews'); if (box) box.innerHTML = '<p class="small muted">News is not available right now.</p>'; });

  if (sb) mountHeadsups(main.querySelector('#tghu'), { sb, esc, S, DEMO, town, title: `Heads-ups for ${town}` });
  // travellers who've been here (public memories within 20 km)
  const ppl = main.querySelector('#tgppl');
  try {
    const feed = (await api.feed()).filter((e) => c && e.lat != null && Math.hypot(e.lat - c.lat, (e.lng - c.lng) * Math.cos(c.lat * Math.PI / 180)) < 0.18);
    const people = await api.profilesById(feed.map((e) => e.user_id)).catch(() => ({}));
    const seen = [...new Set(feed.map((e) => e.user_id))];
    if (!alive()) return;
    ppl.innerHTML = seen.length ? seen.map((uid) => { const a = people[uid]; const n = a ? (a.display_name || '@' + (a.username || 'traveller')) : 'Traveller';
      return `<a class="tg-person" href="#/u/${esc(uid)}"><span class="avatar">${esc(n[0].toUpperCase())}</span><small>${esc(n.split(' ')[0].slice(0, 12))}</small></a>`; }).join('')
      : `<p class="small muted" style="margin:0">Nobody has shared ${esc(town)} yet. Be the first: add a public memory from your journey.</p>`;
  } catch { if (alive()) ppl.innerHTML = '<p class="small muted" style="margin:0">Could not load travellers right now.</p>'; }

  window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'town', meta: { name: town } } }));
}

/* ---------- ask box: short, warm answers. The guide first (instant, free), then the assistant ---------- */
function askBox(main, town, CO, G, { esc, api, gmaps }) {
  const form = main.querySelector('#tgask'); const out = main.querySelector('#tgans'); let n = 0, chatId = null;
  const names = (arr, k = 3) => arr.slice(0, k).map((x) => `<b>${esc(x.name)}</b>`);
  const list = (arr) => (arr.length > 1 ? arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1] : arr[0] || '');
  const local = (q) => {
    const hit = INTENTS.find(([re]) => re.test(q)); if (!hit) return null;
    const [, key, what] = hit; const open = OPENERS[n++ % OPENERS.length];
    if (key === 'fuel') return G.fuel.length ? `${open}the closest places ${what} are ${list(G.fuel.slice(0, 3).map((p) => `<b>${esc(p.name)}</b> (${fmtKm(p.dist)})`))}. Fill up before long drives, towns can be far apart.` : null;
    if (key === 'sport') return G.sport.length ? `${open}try ${list(names(G.sport))} ${what}.` : null;
    if (key === 'events') return G.news.length ? `${open}the latest is “${esc(G.news[0].title)}”. More in the events list below.` : 'Nothing listed in the last two months. Locals and the town’s Facebook pages usually know first.';
    if (key === 'weather') return G.wx ? `It’s ${esc(G.wx.replace(/ now$/, ''))} right now in ${esc(town)}.` : null;
    if (key === 'money') return `${esc(CO.money)}. Cards work in most shops; carry some cash for small towns and fuel.`;
    if (key === 'sos') return `Emergency numbers: ${esc(CO.sos)}. Save them in your phone before you drive.`;
    const types = key === 'see' ? ['see', 'do'] : [key];
    let arr = G.listings.filter((x) => types.includes(x.type));
    if (key === 'buy' && !arr.length) arr = G.malls;
    if (!arr.length) return null;
    const top = arr[0];
    return `${open}${list(names(arr))} are good picks ${what}.${top.text ? ` ${esc(top.name)}: ${esc(top.text.split('. ')[0].slice(0, 140))}.` : ''}`;
  };
  const miss = (q) => `I couldn’t find that in the ${esc(town)} guide. <a href="${esc(gmaps(q + ' ' + town))}" target="_blank" rel="noopener noreferrer">Try Google Maps</a>.`;
  form.onsubmit = async (e) => {
    e.preventDefault(); const q = main.querySelector('#tgq').value.trim(); if (!q) return;
    const ans = local(q);
    if (ans) { out.innerHTML = `<p class="tg-a">${ans}</p>`; return; }
    const btn = form.querySelector('button'); btn.disabled = true; out.innerHTML = '<p class="tg-a muted">Thinking…</p>';
    let acc = '';
    try {
      await api.askStream(chatId, `About ${town}, ${CO.name}: ${q}\n\nReply in 2-3 short, warm, practical sentences. No greeting, no introduction, don't repeat the question.`, 'plan', (ev) => {
        if (ev.type === 'start') chatId = ev.chat_id;
        if (ev.type === 'text') { acc += ev.text; out.innerHTML = `<p class="tg-a">${esc(acc.slice(0, 600))}</p>`; }
      });
      if (!acc) out.innerHTML = `<p class="tg-a">${miss(q)}</p>`;
    } catch (err) {
      out.innerHTML = `<p class="tg-a">${err.upgrade ? 'You’ve used your free assistant questions this month. <a href="#/account?tab=plans">Premium</a> gives you more.' : miss(q)}</p>`;
    } finally { btn.disabled = false; }
  };
}
