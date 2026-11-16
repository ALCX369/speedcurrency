// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// "My Google Maps reviews": the user imports their own Google Takeout file (Reviews.json, or the .zip),
// agrees to the import, and each review becomes a card on their profile and a pin on their map.
// Google offers no API for reading a person's Maps reviews, so the Takeout file is the only route.
// Nothing leaves the phone until the user confirms; every review starts private.

const PAGE = 12;
const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

/** Turns a Takeout reviews file into clean rows. Handles the GeoJSON format and older field names. */
export function parseTakeout(json) {
  const feats = Array.isArray(json?.features) ? json.features : Array.isArray(json) ? json : [];
  const out = [];
  for (const f of feats) {
    const pr = f.properties || f;
    const loc = pr.location || pr.Location || {};
    const geo = loc['Geo Coordinates'] || {};
    const c = f.geometry?.coordinates || [];
    const lat = Number(geo.Latitude ?? c[1]); const lng = Number(geo.Longitude ?? c[0]);
    const name = String(loc.name || loc['Business Name'] || pr.name || '').trim();
    if (!name) continue;
    const rating = Number(pr.five_star_rating_published ?? pr['Star Rating'] ?? pr.rating);
    const url = String(pr.google_maps_url || pr['Google Maps URL'] || '').replace(/^http:/, 'https:');
    const ok = (x) => Number.isFinite(x) && x !== 0;
    out.push({
      src_key: (url || `${name}|${ok(lat) ? lat.toFixed(5) : ''}|${ok(lng) ? lng.toFixed(5) : ''}`).slice(0, 300),
      place_name: name.slice(0, 200),
      address: String(loc.address || loc.Address || '').slice(0, 300) || null,
      lat: ok(lat) && Math.abs(lat) <= 90 ? lat : null, lng: ok(lng) && Math.abs(lng) <= 180 ? lng : null,
      rating: rating >= 1 && rating <= 5 ? Math.round(rating) : null,
      body: String(pr.review_text_published ?? pr['Review Comment'] ?? pr.review_text ?? '').slice(0, 4000) || null,
      reviewed_at: (() => { const d = Date.parse(pr.date || pr.Published || ''); return Number.isFinite(d) ? new Date(d).toISOString() : null; })(),
      maps_url: /^https:\/\//.test(url) ? url.slice(0, 500) : null,
    });
  }
  return out;
}

async function readFile(file) {
  if (/\.zip$/i.test(file.name)) {
    if (!window.JSZip) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = JSZIP; s.onload = res; s.onerror = () => rej(new Error('Could not open the .zip. Unzip it and pick Reviews.json instead.')); document.head.appendChild(s); });
    const zip = await window.JSZip.loadAsync(file);
    const entry = Object.values(zip.files).find((z) => !z.dir && /reviews?\.json$/i.test(z.name));
    if (!entry) throw new Error('No Reviews.json in this file. In Takeout, pick "Maps (your places)" and "Maps".');
    return JSON.parse(await entry.async('string'));
  }
  return JSON.parse(await file.text());
}

async function placePhoto(r) { // a free photo taken at the place (Wikimedia Commons)
  if (r.lat == null) return '';
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${r.lat}|${r.lng}&ggsradius=250&ggsnamespace=6&ggslimit=3&prop=imageinfo&iiprop=url&iiurlwidth=480&format=json&origin=*`;
    const j = await fetch(u, { signal: AbortSignal.timeout(8000) }).then((x) => x.json());
    return Object.values(j?.query?.pages || {}).map((p) => p.imageinfo?.[0]?.thumburl).find((x) => x && /\.(jpe?g|png|webp)/i.test(x)) || '';
  } catch { return ''; }
}

/** Data access: Supabase online, this device in demo mode. */
function store(sb, DEMO, userId) {
  const demo = () => { try { return JSON.parse(localStorage.getItem('sc_demo')) || {}; } catch { return {}; } };
  const save = (d) => localStorage.setItem('sc_demo', JSON.stringify(d));
  return {
    async list() {
      if (DEMO) return (demo().google_reviews || []).slice().sort((a, b) => String(b.reviewed_at).localeCompare(String(a.reviewed_at)));
      const { data, error } = await sb.from('google_reviews').select('*').eq('user_id', userId).order('reviewed_at', { ascending: false, nullsFirst: false }).limit(2000);
      if (error) throw error; return data;
    },
    async upsert(rows, pub) {
      if (DEMO) { const d = demo(); const have = new Map((d.google_reviews || []).map((x) => [x.src_key, x])); rows.forEach((r) => have.set(r.src_key, { id: have.get(r.src_key)?.id || crypto.randomUUID(), user_id: 'demo', ...r, is_public: pub })); d.google_reviews = [...have.values()]; save(d); return; }
      for (let i = 0; i < rows.length; i += 200) { // in batches
        const { error } = await sb.from('google_reviews').upsert(rows.slice(i, i + 200).map((r) => ({ ...r, user_id: userId, is_public: pub })), { onConflict: 'user_id,src_key' });
        if (error) throw error;
      }
    },
    async setPublic(id, v) {
      if (DEMO) { const d = demo(); d.google_reviews = (d.google_reviews || []).map((x) => (x.id === id ? { ...x, is_public: v } : x)); save(d); return; }
      const { error } = await sb.from('google_reviews').update({ is_public: v }).eq('id', id); if (error) throw error;
    },
    async removeAll() {
      if (DEMO) { const d = demo(); d.google_reviews = []; save(d); return; }
      const { error } = await sb.from('google_reviews').delete().eq('user_id', userId); if (error) throw error;
    },
  };
}

/** The signed-in user's own imported reviews (for their map). */
export async function myReviews(sb, DEMO, userId) { return store(sb, DEMO, userId).list(); }

/** Public imported reviews near a spot (for Explore's "who's been here"). */
export async function publicNear(sb, DEMO, p, deg = 0.006) {
  if (DEMO || p.lat == null) return [];
  const { data } = await sb.from('google_reviews').select('*').eq('is_public', true)
    .gte('lat', p.lat - deg).lte('lat', p.lat + deg).gte('lng', p.lng - deg).lte('lng', p.lng + deg).limit(20);
  return data || [];
}

export async function mountGoogleReviews(box, { sb, DEMO, userId, esc, toast, modal }) {
  const db = store(sb, DEMO, userId);
  let rows = []; let shown = PAGE;
  const stars = (n) => (n ? `<span class="gr-stars" aria-label="${n} out of 5">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>` : '');

  const draw = () => {
    const pub = rows.filter((r) => r.is_public).length;
    box.innerHTML = `
      <div class="row between"><h2>My Google Maps reviews</h2>${rows.length ? `<span class="badge">${rows.length}</span>` : ''}</div>
      ${rows.length ? `<p class="small muted" style="margin:0">${pub} public · ${rows.length - pub} only you. Public ones show to travellers in Explore.</p>` : `<p class="muted" style="margin:0">Bring the places you reviewed on Google Maps into SpeedCurrency. They show on your profile and your map.</p>`}
      <div class="row wrap"><button class="btn small primary" id="grimp" type="button">Import my Google reviews</button>
        <button class="btn small ghost" id="grhow" type="button">How to get the file</button>
        ${rows.length ? '<button class="btn small ghost" id="grdel" type="button">Remove all</button>' : ''}</div>
      <input type="file" id="grfile" accept=".json,.zip,application/json,application/zip" hidden>
      ${rows.length ? `<div class="gr-list">${rows.slice(0, shown).map((r, i) => `
        <article class="gr-card">
          <span class="gr-ph" data-ph="${i}"></span>
          <div class="gr-body"><b>${esc(r.place_name)}</b>${stars(r.rating)}
            <small>${esc([r.address, r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '))}</small>
            ${r.body ? `<p>${esc(r.body.slice(0, 240))}${r.body.length > 240 ? '…' : ''}</p>` : ''}
            <div class="row between"><span class="row" style="gap:8px"><button class="switch" role="switch" data-pub="${esc(r.id)}" aria-checked="${!!r.is_public}" aria-label="Show ${esc(r.place_name)} publicly"></button><span class="small muted">${r.is_public ? 'Public' : 'Only me'}</span></span>
              ${r.maps_url ? `<a class="small" href="${esc(r.maps_url)}" target="_blank" rel="noopener noreferrer">On Google Maps ↗</a>` : ''}</div></div>
        </article>`).join('')}</div>
        ${rows.length > shown ? '<button class="btn small ghost" id="grmore" type="button">Show more</button>' : ''}` : ''}`;
    // photos for the cards on screen
    rows.slice(0, shown).forEach(async (r, i) => {
      if (r._ph === undefined) r._ph = await placePhoto(r);
      const el = box.querySelector(`[data-ph="${i}"]`); if (el && r._ph) el.style.backgroundImage = `url('${r._ph.replace(/'/g, '%27')}')`;
    });
    box.querySelector('#grimp').onclick = () => box.querySelector('#grfile').click();
    box.querySelector('#grhow').onclick = howTo;
    box.querySelector('#grfile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
    const del = box.querySelector('#grdel');
    if (del) del.onclick = async () => { if (!confirm('Remove all imported Google reviews from SpeedCurrency? Your reviews on Google stay as they are.')) return; try { await db.removeAll(); rows = []; draw(); toast('Imported reviews removed'); } catch (err) { toast(err.message); } };
    const more = box.querySelector('#grmore'); if (more) more.onclick = () => { shown += PAGE; draw(); };
    box.querySelectorAll('[data-pub]').forEach((b) => b.onclick = async () => {
      const v = b.getAttribute('aria-checked') !== 'true';
      try { await db.setPublic(b.dataset.pub, v); const r = rows.find((x) => x.id === b.dataset.pub); if (r) r.is_public = v; draw(); } catch (err) { toast(err.message); }
    });
  };

  const howTo = () => modal(`<h2>Get your Google reviews file</h2>
    <ol class="gr-steps"><li>Open <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer">takeout.google.com</a> and sign in.</li>
      <li>Tap <b>Deselect all</b>.</li><li>Tick <b>Maps (your places)</b>, and <b>Maps</b> if you see it.</li>
      <li>Tap <b>Next step</b>, then <b>Create export</b>.</li><li>Google emails you a download link (minutes to a few hours). Download the .zip.</li>
      <li>Come back here, tap <b>Import my Google reviews</b> and pick the .zip (or the Reviews.json inside it).</li></ol>
    <p class="small muted">Google does not let apps read your Maps reviews directly, so this file is the only way. Photos are not in the file; we show a free photo of each place instead.</p>
    <button class="btn primary" data-close>Got it</button>`);

  const importFile = async (file) => {
    let found = [];
    try { found = parseTakeout(await readFile(file)); } catch (err) { toast(err.message || 'That file could not be read'); return; }
    if (!found.length) { toast('No reviews found in that file'); return; }
    modal(`<h2>Import ${found.length} review${found.length === 1 ? '' : 's'}?</h2>
      <div class="gr-list mini">${found.slice(0, 3).map((r) => `<div class="gr-card"><div class="gr-body"><b>${esc(r.place_name)}</b>${stars(r.rating)}</div></div>`).join('')}${found.length > 3 ? `<p class="small muted" style="margin:0">…and ${found.length - 3} more</p>` : ''}</div>
      <label class="row gr-consent"><input type="checkbox" id="grok"> <span>I agree that SpeedCurrency stores these reviews (place, rating, text and date) on my profile. I can remove them any time.</span></label>
      <label class="row gr-consent"><input type="checkbox" id="grpub"> <span>Make them public, so other travellers see them in Explore. If not ticked, only I see them.</span></label>
      <div class="row"><button class="btn primary" id="gryes" style="flex:1" disabled>Import</button><button class="btn ghost" data-close>Cancel</button></div>`, (p, close) => {
      const ok = p.querySelector('#grok'); const yes = p.querySelector('#gryes');
      ok.onchange = () => { yes.disabled = !ok.checked; };
      yes.onclick = async () => {
        yes.disabled = true; yes.textContent = 'Importing…';
        try { await db.upsert(found.slice(0, 2000), p.querySelector('#grpub').checked); rows = await db.list(); shown = PAGE; close(); draw(); toast(`${found.length} Google review${found.length === 1 ? '' : 's'} imported`); }
        catch (err) { toast(err.message); yes.disabled = false; yes.textContent = 'Import'; }
      };
    });
  };

  try { rows = await db.list(); } catch { rows = []; }
  draw();
}
