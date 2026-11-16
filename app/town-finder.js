// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Town finder: search any town or village in Namibia or South Africa (pick the country first),
// then a preview popup opens inside the app with the full Town Guide: facts, fuel, attractions,
// malls, sport, events, photos, travellers and a short-answer "ask about this town" box.
import { TownGuide } from './town-guide.js';

const BBOX = { NA: '11.7,-29.0,25.3,-16.9', ZA: '16.4,-34.9,32.9,-22.1' };
const NAMES = { NA: 'Namibia', ZA: 'South Africa' };
const KINDS = /^(city|town|village|suburb|hamlet|locality|neighbourhood|quarter|national_park|nature_reserve|protected_area)$/;

async function findTowns(q, cc) {
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=20&lang=en&bbox=${BBOX[cc]}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Search is busy, try again');
  const j = await r.json(); const seen = new Set();
  return (j.features || []).filter((f) => String(f.properties?.countrycode || '').toUpperCase() === cc && KINDS.test(f.properties?.osm_value || '')).map((f) => {
    const p = f.properties;
    return { name: p.name, kind: p.osm_value, detail: [p.county, p.state, NAMES[cc]].filter(Boolean).filter((x) => x !== p.name).join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], cc };
  }).filter((t) => t.name && !seen.has(t.name + t.detail) && seen.add(t.name + t.detail)).slice(0, 8);
}

/** Opens the Town Guide for one town as a popup inside the app. */
export function openTownPreview(t, deps) {
  deps.modal('<div class="tg-pop" id="tgpop"></div><button type="button" class="tg-x" data-close aria-label="Close">✕</button>', (panel, close) => {
    panel.classList.add('tg-panel');
    window.addEventListener('hashchange', close, { once: true }); // following a link closes the preview
    const q = new URLSearchParams(t.lat != null ? { lat: t.lat, lng: t.lng, cc: t.cc, detail: t.detail || '' } : {});
    TownGuide(panel.querySelector('#tgpop'), { id: encodeURIComponent(t.name), q }, deps, { popup: true });
  });
}

/** The searchable finder: country switch, live suggestions, keyboard friendly. */
export function mountTownFinder(el, deps) {
  const { esc } = deps;
  let cc = 'NA', t = 0, req = 0, list = [];
  el.innerHTML = `
    <div class="tf">
      <div class="seg tf-cc" role="group" aria-label="Country"><button type="button" data-cc="NA" aria-pressed="true">🇳🇦 Namibia</button><button type="button" data-cc="ZA" aria-pressed="false">🇿🇦 South Africa</button></div>
      <form class="searchbar tf-bar" role="search"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <label class="sr" for="tfq">Search a town</label><input id="tfq" placeholder="Search a town, e.g. Ondangwa" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="tfres"><button class="btn small primary">Go</button></form>
      <div class="tf-res" id="tfres" role="listbox" hidden></div>
    </div>`;
  const inp = el.querySelector('#tfq'); const res = el.querySelector('#tfres');
  const show = (html) => { res.innerHTML = html; res.hidden = !html; inp.setAttribute('aria-expanded', String(!!html)); };
  const search = async () => {
    const q = inp.value.trim(); if (q.length < 2) { show(''); return; }
    const mine = ++req; show('<p class="small muted tf-msg">Searching…</p>');
    try {
      list = await findTowns(q, cc); if (mine !== req) return;
      show(list.length ? list.map((x, i) => `<button type="button" role="option" data-i="${i}"><b>${esc(x.name)}</b><small>${esc(x.kind.replace(/_/g, ' '))} · ${esc(x.detail)}</small></button>`).join('')
        : `<p class="small muted tf-msg">No town called “${esc(q)}” in ${NAMES[cc]}. Check the spelling or switch country.</p>`);
    } catch { if (mine === req) show('<p class="small muted tf-msg">The connection is slow. Try again.</p>'); }
  };
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(search, 300); });
  el.querySelector('form').onsubmit = async (e) => { e.preventDefault(); await search(); if (list[0]) pick(0); };
  const pick = (i) => { const x = list[i]; if (!x) return; show(''); inp.value = x.name; openTownPreview(x, deps); };
  res.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); res.querySelector('[data-i]')?.focus(); } if (e.key === 'Escape') show(''); });
  res.addEventListener('keydown', (e) => { const b = e.target.closest('[data-i]'); if (!b) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); b.nextElementSibling?.focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (b.previousElementSibling || inp).focus(); } });
  el.querySelector('.tf-cc').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cc]'); if (!b) return; cc = b.dataset.cc;
    el.querySelectorAll('[data-cc]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    inp.placeholder = cc === 'NA' ? 'Search a town, e.g. Ondangwa' : 'Search a town, e.g. Stellenbosch'; search(); inp.focus();
  });
}
