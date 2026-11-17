// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Journey Studio: the "My journey" page in four views and the habits that bring travellers back.
//   Stamps: a passport of gold town stamps (collect 50+ towns, rare park stamps) + "On this day".
//   Film:   a cinematic full-screen scroll of your memories.
//   Trail:  a glowing gold route across the map, memory to memory, with "Play my journey" (journey-replay.js).
//   Rope:   the original rope of knots (journal-rope.js).
// Plus Journey Wrapped (a story recap you can share) and Friends' activity.
// Healthy hooks only: rewards and progress, no guilt messages or fake alerts.
import { safeImg } from './explore-swipe.js';

export const STAMP_TOWNS = [ // [name, country, rare?]
  ['Windhoek', 'NA'], ['Swakopmund', 'NA'], ['Walvis Bay', 'NA'], ['Lüderitz', 'NA'], ['Keetmanshoop', 'NA'], ['Mariental', 'NA'], ['Rehoboth', 'NA'], ['Okahandja', 'NA'],
  ['Otjiwarongo', 'NA'], ['Outjo', 'NA'], ['Tsumeb', 'NA'], ['Grootfontein', 'NA'], ['Otavi', 'NA'], ['Gobabis', 'NA'], ['Ondangwa', 'NA'], ['Oshakati', 'NA'], ['Ongwediva', 'NA'],
  ['Outapi', 'NA'], ['Opuwo', 'NA'], ['Rundu', 'NA'], ['Katima Mulilo', 'NA'], ['Henties Bay', 'NA'], ['Usakos', 'NA'], ['Karibib', 'NA'], ['Omaruru', 'NA'], ['Khorixas', 'NA'],
  ['Sossusvlei', 'NA', 1], ['Etosha', 'NA', 1], ['Fish River Canyon', 'NA', 1], ['Spitzkoppe', 'NA', 1], ['Epupa Falls', 'NA', 1], ['Kolmanskop', 'NA', 1],
  ['Cape Town', 'ZA'], ['Johannesburg', 'ZA'], ['Pretoria', 'ZA'], ['Durban', 'ZA'], ['Gqeberha', 'ZA'], ['East London', 'ZA'], ['Bloemfontein', 'ZA'], ['Stellenbosch', 'ZA'],
  ['Franschhoek', 'ZA'], ['Hermanus', 'ZA'], ['Knysna', 'ZA'], ['Plettenberg Bay', 'ZA'], ['George', 'ZA'], ['Oudtshoorn', 'ZA'], ['Upington', 'ZA'], ['Springbok', 'ZA'],
  ['Kimberley', 'ZA'], ['Nelspruit', 'ZA'], ['Polokwane', 'ZA'],
  ['Kruger', 'ZA', 1], ['Addo', 'ZA', 1], ['Table Mountain', 'ZA', 1], ['Drakensberg', 'ZA', 1], ['Cape Agulhas', 'ZA', 1],
];
const ICONS = ['☀', '✦', '◈', '❖', '✺', '⚑', '⌂', '♦'];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const km = (a, b) => { const r = (x) => x * Math.PI / 180; return 6371 * 2 * Math.asin(Math.sqrt(Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2)); };
const dateOf = (e) => e.visited_on || e.created_at || '';
const VIEWS = [['grid', 'Grid'], ['stamps', 'Stamps'], ['film', 'Film'], ['trail', 'Trail'], ['rope', 'Rope']];

function stampSvg(name, cc, rare, got, when, esc) {
  const h = hash(name); const rot = (h % 15) - 7; const ic = ICONS[h % ICONS.length];
  const ink = got ? (rare ? '#E2B466' : cc === 'NA' ? '#C9693A' : '#2F6F8F') : 'currentColor';
  const id = 'st' + h.toString(36);
  return `<svg class="stamp ${got ? 'got' : ''} ${rare ? 'rare' : ''}" viewBox="0 0 120 120" style="--rot:${rot}deg" role="img" aria-label="${esc(name)} ${got ? 'stamp collected' : 'not collected yet'}">
    <defs><path id="${id}" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs>
    <circle cx="60" cy="60" r="56" fill="none" stroke="${ink}" stroke-width="3" stroke-dasharray="${rare ? '0' : '4 3'}"/>
    <circle cx="60" cy="60" r="36" fill="none" stroke="${ink}" stroke-width="1.5"/>
    <text font-size="10.5" font-weight="800" letter-spacing="2" fill="${ink}"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(name.toUpperCase())} · ${cc === 'NA' ? 'NAMIBIA' : 'SOUTH AFRICA'}</textPath></text>
    <text x="60" y="66" text-anchor="middle" font-size="22" fill="${ink}">${rare ? '★' : ic}</text>
    <text x="60" y="84" text-anchor="middle" font-size="8.5" font-weight="700" fill="${ink}">${esc(got ? when : 'not yet')}</text></svg>`;
}

export async function JourneyStudio(main, deps) {
  const { api, esc, fmtDate, loadMapLib, JournalRope, ropeDeps, S, DEMO, embedded } = deps;
  const view0 = new URLSearchParams(location.hash.split('?')[1] || '').get('view');
  let view = VIEWS.some(([k]) => k === view0) ? view0 : (localStorage.getItem('sc_jview') || 'grid');
  main.innerHTML = '<div class="skeleton" style="margin-top:20px"><span></span><span></span><span></span></div>';
  const entries = (await api.list('journal_entries', { order: 'visited_on' }).catch(() => []))
    .slice().sort((a, b) => String(dateOf(b)).localeCompare(String(dateOf(a))));
  const paths = entries.map((e) => e.photos?.[0]).filter(Boolean);
  const urls = paths.length ? await api.photoUrls(paths).catch(() => []) : [];
  const cover = {}; paths.forEach((p, i) => { cover[p] = safeImg(urls[i]); });
  const coverOf = (e) => cover[e.photos?.[0]] || '';

  // which towns are stamped: a memory whose place names the town
  const stamped = new Map();
  for (const e of entries.slice().reverse()) {
    const pl = (e.place_name || '') + ' ' + (e.title || '');
    for (const [t] of STAMP_TOWNS) if (!stamped.has(t) && new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(pl)) stamped.set(t, dateOf(e));
  }
  let pulseTowns = []; try { pulseTowns = JSON.parse(localStorage.getItem(`sc_pulse_${S.user?.id}`) || '{}').towns || []; } catch { /* none */ }
  const total = STAMP_TOWNS.length, got = stamped.size;
  const placesWithGeo = entries.filter((e) => e.lat != null).slice().reverse();
  const distance = Math.round(placesWithGeo.reduce((s, e, i, a) => (i ? s + km(a[i - 1], e) : 0), 0));

  // on this day: same day and month in an earlier year
  const now = new Date(); const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const otd = entries.find((e) => String(dateOf(e)).slice(5, 10) === md && String(dateOf(e)).slice(0, 4) < String(now.getFullYear()));

  main.innerHTML = `
    <header class="js-head" ${embedded ? 'hidden' : ''}><div><span class="eyebrow">My journey</span><h1>${got ? `${got} stamp${got === 1 ? '' : 's'}, <em>${entries.length} memories</em>` : 'Your story <em>starts here</em>'}</h1>
      <p class="muted">${distance ? `${distance.toLocaleString('en-ZA')} km travelled between memories · ` : ''}${got}/${total} towns collected</p></div>
      <div class="row wrap" style="gap:8px"><a class="btn small primary" href="#/journal?new=1">＋ Add a memory</a><button type="button" class="btn small ghost" id="jswrap">✦ My Wrapped</button></div></header>
    ${embedded ? `<div class="row between js-embed"><small class="muted">${got}/${total} towns collected${distance ? ` · ${distance.toLocaleString('en-ZA')} km` : ''}</small><button type="button" class="chip" id="jswrap2">✦ My Wrapped</button></div>` : ''}
    <div class="js-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${got}" aria-label="Stamps collected"><i style="width:${Math.max(2, (got / total) * 100)}%"></i></div>
    <section class="js-friends" id="jsfriends" aria-label="Friends' activity"></section>
    ${otd ? `<a class="js-otd" href="#/journal/${esc(otd.id)}" style="${coverOf(otd) ? `background-image:linear-gradient(90deg,rgba(13,11,8,.92),rgba(13,11,8,.35)),url('${esc(coverOf(otd))}')` : ''}"><span class="eyebrow">On this day · ${esc(String(dateOf(otd)).slice(0, 4))}</span><b>${esc(otd.title)}</b><small>${esc(otd.place_name || '')}</small></a>` : ''}
    <nav class="seg js-tabs" role="tablist" aria-label="Journey views">${VIEWS.map(([k, l]) => `<button type="button" role="tab" data-v="${k}" aria-selected="${k === view}">${l}</button>`).join('')}</nav>
    <div id="jsview"></div>`;
  const box = main.querySelector('#jsview');
  let sub = null;

  const views = {
    grid() {
      if (!entries.length) { box.innerHTML = '<div class="empty">No memories yet. <a href="#/journal?new=1">Add your first one</a>.</div>'; return; }
      box.innerHTML = `<div class="pf-grid">${entries.map((e) => { const c = coverOf(e); return `<a class="pf-cell" href="#/journal/${esc(e.id)}" style="${c ? `background-image:url('${esc(c)}')` : ''}" aria-label="${esc(e.title)}">${c ? '' : `<span>${esc(e.title.slice(0, 40))}</span>`}${(e.photos || []).length > 1 ? `<i>${e.photos.length}</i>` : ''}${e.is_public ? '' : '<i class="lock">🔒</i>'}</a>`; }).join('')}</div>`;
    },
    stamps() {
      const groups = [['NA', '🇳🇦 Namibia'], ['ZA', '🇿🇦 South Africa']];
      box.innerHTML = groups.map(([cc, label]) => { const list = STAMP_TOWNS.filter((t) => t[1] === cc); const n = list.filter(([t]) => stamped.has(t)).length;
        return `<section class="js-book"><div class="row between"><h2>${label}</h2><small class="muted">${n}/${list.length} collected</small></div>
          <div class="js-stamps">${list.map(([t, , rare]) => { const has = stamped.has(t); const seen = !has && pulseTowns.includes(t.toLowerCase());
            return `<a class="js-stamp ${seen ? 'seen' : ''}" href="${has ? `#/town/${encodeURIComponent(t)}` : `#/town/${encodeURIComponent(t)}`}" title="${esc(t)}${rare ? ' (rare)' : ''}">${stampSvg(t, cc, rare, has, has ? fmtDate(stamped.get(t)) : '', esc)}<small>${esc(t)}${seen ? ' · explored' : ''}</small></a>`; }).join('')}</div></section>`; }).join('')
        + '<p class="small muted">Add a memory in a town to stamp it. Rare ★ stamps are parks and wonders.</p>';
    },
    film() {
      if (!entries.length) { box.innerHTML = '<div class="empty">No memories yet. Add your first one and it plays here like a film.</div>'; return; }
      box.innerHTML = `<div class="js-film">${entries.map((e, i) => `<a class="js-frame" href="#/journal/${esc(e.id)}" style="${coverOf(e) ? `background-image:url('${esc(coverOf(e))}')` : ''}">
          <span class="js-n">${String(entries.length - i).padStart(2, '0')}</span>
          <span class="js-cap"><small>${esc(fmtDate(dateOf(e)))}${e.place_name ? ' · ' + esc(e.place_name) : ''}</small><b>${esc(e.title)}</b>${e.story ? `<em>${esc(e.story.slice(0, 120))}${e.story.length > 120 ? '…' : ''}</em>` : ''}</span></a>`).join('')}</div>`;
      const io = new IntersectionObserver((xs) => xs.forEach((x) => x.target.classList.toggle('in', x.isIntersecting)), { threshold: 0.35 });
      box.querySelectorAll('.js-frame').forEach((f) => io.observe(f));
      return () => io.disconnect();
    },
    async trail() {
      if (placesWithGeo.length < 1) { box.innerHTML = '<div class="empty">Add a place to your memories and your trail glows here.</div>'; return; }
      box.innerHTML = `<div class="js-trail"><div id="jstrailmap" role="application" aria-label="Your journey trail"></div>${placesWithGeo.length > 1 ? '<button type="button" class="jr-play" id="jrplay" hidden>▶ Play my journey</button>' : ''}</div><p class="small muted">Map © OpenStreetMap contributors · tiles OpenFreeMap</p>`;
      await loadMapLib().catch(() => {}); if (!window.maplibregl || view !== 'trail' || !box.querySelector('#jstrailmap')) return; // tab changed while loading
      const map = new maplibregl.Map({ container: 'jstrailmap', style: 'https://tiles.openfreemap.org/styles/dark', bounds: [[11.5, -35.2], [33.2, -16.8]], attributionControl: { compact: true } });
      const coords = placesWithGeo.map((e) => [e.lng, e.lat]);
      map.on('load', () => {
        map.addSource('trail', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({ id: 'trail-glow', type: 'line', source: 'trail', paint: { 'line-color': '#FF6A2B', 'line-width': 10, 'line-blur': 8, 'line-opacity': .45 } });
        map.addLayer({ id: 'trail', type: 'line', source: 'trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F0CB8A', 'line-width': 3, 'line-dasharray': [1, 1.6] } });
        const bb = new maplibregl.LngLatBounds(); coords.forEach((c) => bb.extend(c)); if (coords.length > 1) map.fitBounds(bb, { padding: 60, maxZoom: 11 }); else map.flyTo({ center: coords[0], zoom: 10 });
        const play = box.querySelector('#jrplay'); if (!play) return;
        play.hidden = false;
        play.onclick = async () => {
          play.hidden = true;
          const { playJourney } = await import('./journey-replay.js');
          if (view !== 'trail') return;
          stopReplay = playJourney({ map, places: placesWithGeo, coverOf, esc, fmtDate, dateOf, km, host: box.querySelector('.js-trail') });
          const back = new MutationObserver(() => { if (!box.querySelector('.jr')) { play.hidden = false; back.disconnect(); } });
          back.observe(box.querySelector('.js-trail'), { childList: true });
        };
      });
      let stopReplay = null;
      placesWithGeo.forEach((e, i) => { const el = document.createElement('a'); el.className = 'js-pin'; el.href = `#/journal/${e.id}`; el.textContent = String(i + 1); el.setAttribute('aria-label', e.title);
        const c = coverOf(e); if (c) { el.style.backgroundImage = `url('${c}')`; el.textContent = ''; }
        new maplibregl.Marker({ element: el }).setLngLat([e.lng, e.lat]).addTo(map); });
      return () => { if (stopReplay) stopReplay(); map.remove(); };
    },
    async rope() { return await JournalRope(box, ropeDeps); },
  };
  const show = async (k) => {
    view = k; try { localStorage.setItem('sc_jview', k); } catch { /* private mode */ }
    main.querySelectorAll('.js-tabs [data-v]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === k)));
    if (typeof sub === 'function') sub(); sub = null;
    sub = await views[k]();
  };
  main.querySelector('.js-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b && b.dataset.v !== view) show(b.dataset.v); });
  const wrap = () => wrapped({ entries, coverOf, got, total, distance, esc, S });
  main.querySelector('#jswrap').onclick = wrap; main.querySelector('#jswrap2')?.addEventListener('click', wrap);
  friends(main.querySelector('#jsfriends'), { api, esc, S, DEMO });
  await show(view);
  return () => { if (typeof sub === 'function') sub(); };
}

/* ---------- Journey Wrapped: a story recap (this month, or all time if the month is quiet) ---------- */
function wrapped({ entries, coverOf, got, total, distance, esc, S }) {
  const now = new Date(); const month = entries.filter((e) => String(dateOf(e)).slice(0, 7) === now.toISOString().slice(0, 7));
  const set = month.length >= 2 ? month : entries; const span = set === month ? now.toLocaleDateString('en-ZA', { month: 'long' }) : 'all time';
  const photos = set.reduce((n, e) => n + (e.photos || []).length, 0);
  const places = [...new Set(set.map((e) => (e.place_name || '').split(',')[0].trim()).filter(Boolean))];
  const top = set.slice().sort((a, b) => (b.photos || []).length - (a.photos || []).length)[0];
  let level = ''; try { const s = JSON.parse(localStorage.getItem(`sc_pulse_${S.user?.id}`) || '{}'); level = s.xp ? `${s.xp} XP` : ''; } catch { /* none */ }
  const slides = [
    ['Your journey', `<b>${esc(span)}</b>`, 'Wrapped ✦'],
    ['Memories made', `<b>${set.length}</b>`, `${photos} photos`],
    ['Places', `<b>${places.length}</b>`, esc(places.slice(0, 4).join(' · ') || 'Add places to your memories')],
    ['Distance', `<b>${distance.toLocaleString('en-ZA')} km</b>`, 'between your memories'],
    ['Passport', `<b>${got}/${total}</b>`, 'town stamps collected'],
    ...(top ? [['Top memory', `<b class="w-title">${esc(top.title)}</b>`, esc(top.place_name || ''), coverOf(top)]] : []),
    ['Keep going', `<b>${level || 'Next stop?'}</b>`, 'Share your Wrapped with friends'],
  ];
  const ov = document.createElement('div'); ov.className = 'wrapped'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Your Journey Wrapped');
  ov.innerHTML = `<div class="bars">${slides.map(() => '<span><i></i></span>').join('')}</div><button class="sv-x" aria-label="Close">✕</button><div class="w-slide" aria-live="polite"></div>
    <div class="w-acts"><button type="button" class="btn small primary" id="wshare">Share</button></div><button class="tap left" aria-label="Previous"></button><button class="tap right" aria-label="Next"></button>`;
  const overflow0 = document.body.style.overflow; document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  let i = 0, t = null; const bars = ov.querySelectorAll('.bars i');
  const close = () => { clearTimeout(t); ov.remove(); document.body.style.overflow = overflow0; };
  const paint = () => {
    const [k, big, small, img] = slides[i]; const sl = ov.querySelector('.w-slide');
    sl.style.backgroundImage = img ? `linear-gradient(180deg,rgba(13,11,8,.2),rgba(13,11,8,.9)),url('${img}')` : '';
    sl.className = `w-slide s${i % 4}`; sl.innerHTML = `<span class="eyebrow">${k}</span>${big}<p>${small}</p>`;
    bars.forEach((b, n) => { b.style.transition = 'none'; b.style.width = n < i ? '100%' : '0%'; });
    requestAnimationFrame(() => { bars[i].style.transition = 'width 4s linear'; bars[i].style.width = '100%'; });
    clearTimeout(t); t = setTimeout(next, 4000);
  };
  const next = () => { if (i < slides.length - 1) { i++; paint(); } else clearTimeout(t); };
  ov.querySelector('.tap.right').onclick = next; ov.querySelector('.tap.left').onclick = () => { i = Math.max(0, i - 1); paint(); };
  ov.querySelector('.sv-x').onclick = close;
  ov.querySelector('#wshare').onclick = async () => {
    const text = `My SpeedCurrency journey (${span}): ${set.length} memories, ${places.length} places, ${distance} km, ${got}/${total} stamps ✦`;
    try { if (navigator.share) await navigator.share({ title: 'My Journey Wrapped', text, url: location.origin + location.pathname }); else { await navigator.clipboard.writeText(text); ov.querySelector('#wshare').textContent = 'Copied!'; } } catch { /* cancelled */ }
  };
  document.addEventListener('keydown', function k(e) { if (!document.body.contains(ov)) return document.removeEventListener('keydown', k); if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); });
  window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'wrapped' } }));
  paint();
}

/* ---------- Friends' activity: people you chat with first, then other travellers ---------- */
async function friends(el, { api, esc, S, DEMO }) {
  if (!el || DEMO) { el?.remove(); return; }
  try {
    const [convs, feed] = await Promise.all([api.conversations().catch(() => []), api.feed().catch(() => [])]);
    const pals = new Set(convs.flatMap((c) => [c.user_a, c.user_b]).filter((u) => u !== S.user.id));
    const list = [...feed.filter((e) => pals.has(e.user_id)), ...feed.filter((e) => !pals.has(e.user_id))].slice(0, 10);
    if (!list.length) { el.remove(); return; }
    const people = await api.profilesById(list.map((e) => e.user_id)).catch(() => ({}));
    el.innerHTML = `<div class="row between"><b>${pals.size ? 'Friends’ activity' : 'Travellers’ latest'}</b><a class="small" href="#/explore">See all</a></div>
      <div class="js-fr">${list.map((e) => { const a = people[e.user_id]; const n = a ? (a.display_name || '@' + (a.username || 'traveller')) : 'Traveller';
        return `<a class="js-fr-item" href="#/u/${esc(e.user_id)}"><span class="avatar ${pals.has(e.user_id) ? 'pal' : ''}">${esc(n[0].toUpperCase())}</span><small><b>${esc(n.split(' ')[0].slice(0, 12))}</b> ${esc((e.place_name || e.title || '').split(',')[0].slice(0, 18))}</small></a>`; }).join('')}</div>`;
  } catch { el.remove(); }
}
