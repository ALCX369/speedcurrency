// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Explore map: travellers' public memories sit on the map as photo pins. Pick a town and the map
// zooms in, then choose what you want (food, fuel, museums, stadiums, campus, gardens…).
// Tap a place for its "place window": photos of it, and the travellers who have been there.
// Free sources only: OpenFreeMap tiles, Photon search, OpenStreetMap (Overpass), Wikimedia Commons.

const TOWNS = ['Windhoek', 'Swakopmund', 'Walvis Bay', 'Ondangwa', 'Oshakati', 'Rundu', 'Katima Mulilo', 'Lüderitz', 'Keetmanshoop', 'Cape Town', 'Johannesburg', 'Durban'];
const CATS = [ // key, label, Overpass filters (';' separated), radius m
  ['food', 'Restaurants', 'nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]', 6000],
  ['fuel', 'Fuel & garages', 'nwr["amenity"="fuel"];nwr["shop"~"^(car_repair|tyres|car_parts)$"]', 8000],
  ['fun', 'Fun spots', 'nwr["leisure"~"^(water_park|amusement_arcade|bowling_alley|escape_game|miniature_golf)$"];nwr["amenity"~"^(cinema|nightclub|theatre)$"];nwr["tourism"="theme_park"]', 10000],
  ['museum', 'Museums & sights', 'nwr["tourism"~"^(museum|gallery|attraction|viewpoint|zoo)$"]', 12000],
  ['stadium', 'Stadiums & sport', 'nwr["leisure"~"^(stadium|sports_centre|golf_course)$"]', 12000],
  ['campus', 'Varsity & schools', 'nwr["amenity"~"^(university|college)$"]', 12000],
  ['garden', 'Parks & gardens', 'nwr["leisure"~"^(park|garden|nature_reserve)$"]', 10000],
  ['stay', 'Stays', 'nwr["tourism"~"^(hotel|guest_house|lodge|camp_site|hostel|motel)$"]', 8000],
  ['shops', 'Shops & malls', 'nwr["shop"~"^(supermarket|mall|department_store)$"]', 8000],
  ['money', 'ATMs & banks', 'nwr["amenity"~"^(atm|bank|bureau_de_change)$"]', 6000],
];
const CAT_ICON = { food: '🍽', fuel: '⛽', fun: '🎳', museum: '🏛', stadium: '🏟', campus: '🎓', garden: '🌿', stay: '🛏', shops: '🛍', money: '🏧' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const km = (a, b) => { const r = (x) => x * Math.PI / 180; return 6371 * 2 * Math.asin(Math.sqrt(Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2)); };
const dist = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);
const gmaps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

async function overpass(c, cat) {
  const [, , q, radius] = cat;
  const parts = q.split(';').map((x) => `${x}(around:${radius},${c.lat},${c.lng});`).join('');
  const body = 'data=' + encodeURIComponent(`[out:json][timeout:15];(${parts});out center 60;`);
  let j = null;
  for (const host of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) { // main server, then a free mirror
    try { const r = await fetch(host, { method: 'POST', body, signal: AbortSignal.timeout(16000) }); if (r.ok) { j = await r.json(); break; } } catch { /* try the next */ }
  }
  if (!j) throw new Error('Map data is busy, try again in a moment');
  return (j.elements || []).filter((e) => e.tags?.name).map((e) => {
    const t = e.tags; const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    return { key: `${e.type}/${e.id}`, name: t.name, lat, lng, dist: km(c, { lat, lng }),
      kind: (t.cuisine || t.tourism || t.leisure || t.amenity || t.shop || '').replace(/_/g, ' ').replace(/;/g, ', '),
      phone: t.phone || t['contact:phone'] || '', web: /^https?:\/\//.test(t.website || '') ? t.website : '', hours: t.opening_hours || '',
      street: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') };
  }).sort((a, b) => a.dist - b.dist).slice(0, 30);
}

async function commonsPhotos(p) { // free photos taken at this spot (Wikimedia Commons)
  const u = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${p.lat}|${p.lng}&ggsradius=300&ggsnamespace=6&ggslimit=10&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
  try {
    const j = await fetch(u, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
    return Object.values(j?.query?.pages || {}).map((pg) => pg.imageinfo?.[0]?.thumburl).filter((x) => x && /\.(jpe?g|png|webp)/i.test(x)).slice(0, 8);
  } catch { return []; }
}

export async function mountExploreMap(root, deps) {
  const { esc, api, loadMapLib, placeSearch, modal, reviewSheet, feed, people, urlOf } = deps;
  const name = (a) => (a ? (a.display_name || '@' + (a.username || 'traveller')) : 'Traveller');
  const st = { town: null, center: null, cat: null, places: [], markers: [] };

  const saved = () => { try { return JSON.parse(localStorage.getItem('sc_saved_places') || '[]'); } catch { return []; } };
  root.classList.add('swipe');
  root.innerHTML = `
    <form class="searchbar" id="exq" role="search"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <label class="sr" for="exqi">Find a town</label><input id="exqi" placeholder="Find a town in Namibia or South Africa" autocomplete="off"><button class="btn small primary">Go</button></form>
    <div class="chips mood" id="extowns" aria-label="Towns">${TOWNS.map((t) => `<button type="button" class="chip" data-town="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="ex-bar"><div class="seg" role="group" aria-label="View"><button type="button" data-v="swipe" aria-pressed="true">Swipe</button><button type="button" data-v="map" aria-pressed="false">Map</button></div>
      <button type="button" class="chip" id="exsaved">♥ Saved <b>${saved().length}</b></button></div>
    <div class="ex-cats chips" id="excats" hidden aria-label="What are you looking for?">${CATS.map(([k, l]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="false">${esc(l)}</button>`).join('')}</div>
    <div class="sw" id="exdeck"></div>
    <div class="ex-map" hidden>
      <div id="exmapc" role="application" aria-label="Explore map"></div>
      <div class="ex-title" id="extitle"><b>Travellers on the map</b><small>${feed.filter((e) => e.lat != null).length} public memories · pick a town to explore</small></div>
    </div>
    <div class="rail ex-rail" id="exrail" aria-live="polite"></div>
    <p class="small muted">Map © OpenStreetMap contributors · tiles OpenFreeMap · photos Wikimedia Commons.</p>`;

  await loadMapLib();
  if (!window.maplibregl) { root.querySelector('#exmapc').innerHTML = '<p class="muted" style="padding:20px">The map could not load. Check your connection.</p>'; return () => {}; }
  const map = new maplibregl.Map({ container: 'exmapc', style: 'https://tiles.openfreemap.org/styles/dark', bounds: [[11.5, -35.2], [33.2, -16.8]], attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'top-right');

  // Traveller pins: one photo pin per public memory with a location
  for (const e of feed.filter((x) => x.lat != null)) {
    const el = document.createElement('button'); el.className = 'ex-av'; el.type = 'button';
    const cov = urlOf[e.photos?.[0]]; if (cov) el.style.backgroundImage = `url('${cov.replace(/'/g, '%27')}')`; else el.textContent = name(people[e.user_id])[0].toUpperCase();
    el.setAttribute('aria-label', `${name(people[e.user_id])}: ${e.title}`);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); memoryWindow(e); });
    new maplibregl.Marker({ element: el }).setLngLat([e.lng, e.lat]).addTo(map);
  }

  const memoryWindow = (e) => {
    const a = people[e.user_id]; const pics = (e.photos || []).map((p) => urlOf[p]).filter(Boolean);
    modal(`<div class="pw">${pics.length ? `<div class="pw-pics">${pics.map((u) => `<span style="background-image:url('${esc(u)}')"></span>`).join('')}</div>` : ''}
      <span class="eyebrow">${esc(e.place_name || 'On the road')}</span><h2>${esc(e.title)}</h2>
      <p class="small muted" style="margin:0">By <b>${esc(name(a))}</b>${a?.home_country ? ` from ${esc(a.home_country)}` : ''}</p>
      ${e.story ? `<p style="margin:0">${esc(e.story.slice(0, 220))}${e.story.length > 220 ? '…' : ''}</p>` : ''}
      <div class="row wrap"><a class="btn small primary" data-close href="#/journal/${esc(e.id)}">Open memory</a><a class="btn small ghost" data-close href="#/messages?to=${esc(e.user_id)}">Message</a><button class="btn small ghost" data-close>Close</button></div></div>`);
  };

  const clearMarkers = () => { st.markers.forEach((m) => m.remove()); st.markers = []; };
  const rail = root.querySelector('#exrail');

  const goTown = async (q) => {
    rail.innerHTML = '<div class="skeleton"><span></span></div>';
    try {
      const hit = (await placeSearch(q))[0]; if (!hit) throw new Error('Town not found');
      st.town = hit.name; st.center = { lat: hit.lat, lng: hit.lng };
      map.flyTo({ center: [hit.lng, hit.lat], zoom: 12.5, speed: 1.2 });
      root.querySelector('#extitle').innerHTML = `<b>Exploring ${esc(hit.name)}</b><small>What are you looking for?</small>`;
      root.querySelector('#excats').hidden = false; rail.innerHTML = '';
      root.querySelectorAll('[data-town]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.town === q)));
      clearMarkers(); pickCat(st.cat || 'food');
      window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'town', meta: { name: hit.name } } }));
    } catch (err) { oops(err, () => goTown(q)); }
  };
  // Friendly errors with a retry, instead of raw messages like "signal timed out"
  const oops = (err, retry) => {
    const slow = /timed? ?out|abort|fetch|network|busy/i.test(err.message);
    rail.innerHTML = `<p class="small muted">${slow ? 'The connection is slow or the map service is busy.' : esc(err.message)} <button type="button" class="btn small ghost" id="exretry">Try again</button></p>`;
    rail.querySelector('#exretry').onclick = retry;
  };

  let req = 0; // only the latest category search may draw pins
  const pickCat = async (key) => {
    const cat = CATS.find((c) => c[0] === key); if (!cat || !st.center) return;
    st.cat = key; const mine = ++req;
    root.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === key)));
    rail.innerHTML = '<div class="skeleton"><span></span></div>'; clearMarkers();
    try {
      const places = await overpass(st.center, cat);
      if (mine !== req) return; // a newer choice was made while this one loaded
      st.places = places;
      if (!st.places.length) { rail.innerHTML = `<p class="small muted">Nothing mapped for ${esc(cat[1].toLowerCase())} here yet. <a href="${esc(gmaps(`${cat[1]} near ${st.town}`))}" target="_blank" rel="noopener noreferrer">Try Google Maps</a></p>`; return; }
      const bb = new maplibregl.LngLatBounds();
      st.places.forEach((p, i) => {
        const el = document.createElement('button'); el.className = 'ex-pin'; el.type = 'button'; el.textContent = String(i + 1);
        el.setAttribute('aria-label', p.name); el.addEventListener('click', (ev) => { ev.stopPropagation(); placeWindow(p); });
        st.markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)); bb.extend([p.lng, p.lat]);
      });
      st.bb = bb; map.fitBounds(bb, { padding: 60, maxZoom: 15 });
      deck?.set(st.places.map((p, n) => ({ id: p.key, title: p.name, icon: CAT_ICON[key], badge: `${n + 1} of ${st.places.length}`, sub: `${cap(p.kind || cat[1])} · ${dist(p.dist)} away`, tags: [p.hours && 'Hours listed', p.phone && 'Call', p.web && 'Website', st.town], data: { type: 'place', p } })));
      rail.innerHTML = st.places.map((p, i) => `<button type="button" class="ex-card" data-p="${i}"><span class="n">${i + 1}</span><b>${esc(p.name)}</b><small>${esc(p.kind || cat[1])} · ${dist(p.dist)}</small></button>`).join('');
    } catch (err) { if (mine === req) oops(err, () => pickCat(key)); }
  };

  // The place window: photos of the place, then the travellers who have been there
  const placeWindow = async (p) => {
    p.town = st.town;
    window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'place' } }));
    modal(`<div class="pw" id="pw"><div class="pw-pics" id="pwpics"><span class="pw-load"></span><span class="pw-load"></span></div>
      <span class="eyebrow">${esc(p.kind || 'Place')} · ${esc(st.town || '')}</span><h2>${esc(p.name)}</h2>
      <p class="small muted" style="margin:0">${[p.street, dist(p.dist) + ' from the centre', p.hours].filter(Boolean).map(esc).join(' · ')}</p>
      <div class="row wrap"><a class="btn small primary" href="${esc(gmaps(`${p.name} ${p.lat},${p.lng}`))}" target="_blank" rel="noopener noreferrer">Directions & reviews</a>
        ${p.phone ? `<a class="btn small ghost" href="tel:${esc(p.phone.split(';')[0].replace(/[^+\d]/g, ''))}">Call</a>` : ''}
        ${p.web ? `<a class="btn small ghost" href="${esc(p.web)}" target="_blank" rel="noopener noreferrer">Website</a>` : ''}
        <button class="btn small ghost" id="pwrev">Write a review</button></div>
      <h3>Travellers who've been here</h3><div id="pwppl" class="pw-ppl"><div class="skeleton"><span></span></div></div>
      <button class="btn small ghost" data-close style="align-self:flex-start">Close</button></div>`, async (pnl, close) => {
      pnl.querySelector('#pwrev').onclick = () => { close(); reviewSheet(p, () => {}); };
      // 1) photos of this spot
      const [pics, reviews] = await Promise.all([commonsPhotos(p), api.reviews([p.key]).catch(() => [])]);
      const revPics = reviews.filter((r) => r.photo_path).map((r) => api.reviewPhoto(r.photo_path));
      const all = [...revPics, ...pics];
      const box = pnl.querySelector('#pwpics');
      if (box) box.innerHTML = all.length ? all.map((u) => `<span style="background-image:url('${esc(u)}')"></span>`).join('') : '<p class="small muted" style="margin:0">No photos yet. Visit, then add yours in a review or your journal.</p>';
      // 2) people: public memories within 600 m or naming the place, and member reviews
      const near = feed.filter((e) => (e.lat != null && km(p, e) < 0.6) || (e.place_name || '').toLowerCase().includes(p.name.toLowerCase()));
      const revPeople = await api.profilesById(reviews.map((r) => r.user_id)).catch(() => ({}));
      const pp = pnl.querySelector('#pwppl'); if (!pp) return;
      const rows = [
        ...near.map((e) => { const a = people[e.user_id]; const ph = (e.photos || []).map((x) => urlOf[x]).filter(Boolean).slice(0, 3);
          return `<a class="pw-person" data-close href="#/journal/${esc(e.id)}"><span class="avatar">${esc(name(a)[0].toUpperCase())}</span><span class="pw-who"><b>${esc(name(a))}</b><small>${esc(e.title)}</small></span>${ph.map((u) => `<i style="background-image:url('${esc(u)}')"></i>`).join('')}</a>`; }),
        ...reviews.map((r) => { const a = revPeople[r.user_id];
          return `<div class="pw-person"><span class="avatar">${esc(name(a)[0].toUpperCase())}</span><span class="pw-who"><b>${esc(name(a))} <span style="color:var(--accent)">${'★'.repeat(r.rating)}</span></b><small>${esc(r.body.slice(0, 90))}</small></span>${r.photo_path ? `<i style="background-image:url('${esc(api.reviewPhoto(r.photo_path))}')"></i>` : ''}</div>`; }),      ];
      pp.innerHTML = rows.length ? rows.join('') : `<p class="small muted" style="margin:0">Nobody has shared this place yet. Be the first: add it to a public journal memory.</p>`;
    });
  };

  // Swipe deck (explore-swipe.js): towns and travellers' memories first, then the places in a town
  const { mountSwipe } = await import('./explore-swipe.js');
  const SA = ['Cape Town', 'Johannesburg', 'Durban'];
  const startCards = [];
  const mems = feed.filter((e) => urlOf[e.photos?.[0]]);
  TOWNS.forEach((t, k) => {
    startCards.push({ id: 'town:' + t, title: t, icon: '◎', badge: 'Town', sub: `${SA.includes(t) ? 'South Africa' : 'Namibia'} · swipe right to explore`, tags: ['Food', 'Sights', 'Stays'], data: { type: 'town', t } });
    const e = mems[k]; if (e) startCards.push({ id: 'mem:' + e.id, img: urlOf[e.photos[0]], title: e.title, badge: 'Traveller', sub: `${name(people[e.user_id])}${e.place_name ? ' · 📍 ' + e.place_name : ''}`, tags: [e.rating ? '★'.repeat(e.rating) : '', (e.photos || []).length > 1 ? `${e.photos.length} photos` : ''], data: { type: 'mem', e } });
  });
  const deck = mountSwipe(root.querySelector('#exdeck'), {
    cards: startCards, esc, yesLabel: 'Yes', noLabel: 'Skip',
    empty: 'That was the whole deck. Pick a town above, or switch to <b>Map</b>.',
    loadImg: async (c) => {
      if (c.data.type === 'town') {
        const j = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(c.data.t)}&redirects=1&prop=pageimages&pithumbsize=800&format=json&origin=*`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
        return Object.values(j?.query?.pages || {})[0]?.thumbnail?.source || '';
      }
      if (c.data.type === 'place') return (await commonsPhotos(c.data.p))[0] || '';
      return '';
    },
    onOpen: (c) => (c.data.type === 'town' ? goTown(c.data.t) : c.data.type === 'mem' ? memoryWindow(c.data.e) : placeWindow(c.data.p)),
    onYes: (c) => {
      if (c.data.type === 'town') return goTown(c.data.t);
      if (c.data.type === 'mem') { api.react?.(c.data.e.id, '❤️', true).catch(() => {}); return; }
      const p = c.data.p; const list = saved().filter((x) => x.key !== p.key);
      list.unshift({ key: p.key, name: p.name, kind: p.kind, town: st.town, lat: p.lat, lng: p.lng });
      try { localStorage.setItem('sc_saved_places', JSON.stringify(list.slice(0, 100))); } catch { /* private mode */ }
      root.querySelector('#exsaved b').textContent = Math.min(list.length, 100);
      window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'place' } }));
    },
  });
  // Swipe / Map switch
  root.querySelector('.seg').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-v]'); if (!b) return; const v = b.dataset.v;
    root.querySelectorAll('.seg [data-v]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    root.classList.toggle('swipe', v === 'swipe'); root.querySelector('#exdeck').hidden = v !== 'swipe'; root.querySelector('.ex-map').hidden = v !== 'map';
    if (v === 'map') { map.resize(); if (st.bb) map.fitBounds(st.bb, { padding: 60, maxZoom: 15, duration: 0 }); }
  });
  root.querySelector('#exsaved').onclick = () => {
    const list = saved();
    modal(`<div class="pw"><span class="eyebrow">Your shortlist</span><h2>Saved places</h2>
      ${list.length ? list.map((x) => `<a class="pw-person" href="${esc(gmaps(`${x.name} ${x.lat},${x.lng}`))}" target="_blank" rel="noopener noreferrer"><span class="avatar">♥</span><span class="pw-who"><b>${esc(x.name)}</b><small>${esc(cap(x.kind || 'Place'))}${x.town ? ' · ' + esc(x.town) : ''}</small></span></a>`).join('') : '<p class="small muted" style="margin:0">Swipe right on a place to save it here.</p>'}
      <button class="btn small ghost" data-close style="align-self:flex-start">Close</button></div>`);
  };

  root.querySelector('#exq').onsubmit =(ev) => { ev.preventDefault(); const q = root.querySelector('#exqi').value.trim(); if (q.length > 1) goTown(q); };
  root.querySelector('#extowns').addEventListener('click', (ev) => { const b = ev.target.closest('[data-town]'); if (b) goTown(b.dataset.town); });
  root.querySelector('#excats').addEventListener('click', (ev) => { const b = ev.target.closest('[data-cat]'); if (b) pickCat(b.dataset.cat); });
  rail.addEventListener('click', (ev) => { const b = ev.target.closest('[data-p]'); if (b) { const p = st.places[+b.dataset.p]; map.flyTo({ center: [p.lng, p.lat], zoom: 16 }); placeWindow(p); } });
  return () => map.remove();
}
