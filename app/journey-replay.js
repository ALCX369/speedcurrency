// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Journey Replay: "Play my journey" on the Trail map.
// The gold route draws itself memory to memory, the camera follows, a photo card shows each stop,
// and the km / stops counters grow as you go. Ends with a recap you can share.
// Respects reduced motion (no flying, no drawing animation: it steps stop by stop).

const STEP_MS = 2600;   // time spent drawing one leg of the route
const HOLD_MS = 1500;   // time the card rests on a stop

export function playJourney({ map, places, coverOf, esc, fmtDate, dateOf, km, host }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coords = places.map((e) => [e.lng, e.lat]);
  let alive = true, paused = false, raf = 0, timer = 0, i = 0, total = 0;

  // route that grows while playing (drawn above the dashed trail)
  const empty = { type: 'Feature', geometry: { type: 'LineString', coordinates: [coords[0]] } };
  if (map.getSource('replay')) map.getSource('replay').setData(empty);
  else {
    map.addSource('replay', { type: 'geojson', data: empty });
    map.addLayer({ id: 'replay-glow', type: 'line', source: 'replay', paint: { 'line-color': '#FF6A2B', 'line-width': 12, 'line-blur': 10, 'line-opacity': .55 } });
    map.addLayer({ id: 'replay', type: 'line', source: 'replay', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F0CB8A', 'line-width': 4 } });
  }

  const ui = document.createElement('div');
  ui.className = 'jr';
  ui.innerHTML = `
    <div class="jr-hud" aria-live="polite"><span><b id="jrkm">0</b> km</span><span><b id="jrn">1</b>/${coords.length} stops</span></div>
    <div class="jr-ctl"><button type="button" class="jr-b" id="jrpause" aria-label="Pause">❚❚</button><button type="button" class="jr-b" id="jrclose" aria-label="Close replay">✕</button></div>
    <article class="jr-card" id="jrcard"></article>
    <div class="jr-bar" aria-hidden="true"><i id="jrbar"></i></div>`;
  host.appendChild(ui);
  const $ = (s) => ui.querySelector(s);

  const card = (e, n) => {
    const c = coverOf(e);
    $('#jrcard').classList.remove('in');
    $('#jrcard').innerHTML = `${c ? `<div class="jr-ph" style="background-image:url('${esc(c)}')"></div>` : ''}
      <div class="jr-tx"><small>${String(n).padStart(2, '0')} · ${esc(fmtDate(dateOf(e)))}${e.place_name ? ' · ' + esc(e.place_name) : ''}</small>
      <b>${esc(e.title || 'A memory')}</b><a href="#/journal/${esc(e.id)}">Open memory →</a></div>`;
    requestAnimationFrame(() => $('#jrcard').classList.add('in'));
    $('#jrn').textContent = n;
    $('#jrbar').style.width = `${(n / coords.length) * 100}%`;
  };

  const finale = () => {
    const first = dateOf(places[0]), last = dateOf(places[places.length - 1]);
    const text = `My journey on SpeedCurrency: ${Math.round(total).toLocaleString('en-ZA')} km, ${places.length} memories${first ? `, ${fmtDate(first)} to ${fmtDate(last)}` : ''}.`;
    $('#jrcard').classList.remove('in');
    $('#jrcard').innerHTML = `<div class="jr-tx jr-end"><small>Your journey</small><b>${Math.round(total).toLocaleString('en-ZA')} km · ${places.length} memor${places.length === 1 ? 'y' : 'ies'}</b>
      ${first ? `<small>${esc(fmtDate(first))} → ${esc(fmtDate(last))}</small>` : ''}
      <div class="row wrap" style="gap:8px;margin-top:10px"><button type="button" class="btn small primary" id="jragain">↻ Play again</button>${navigator.share ? '<button type="button" class="btn small ghost" id="jrshare">Share</button>' : ''}</div></div>`;
    requestAnimationFrame(() => $('#jrcard').classList.add('in'));
    $('#jrpause').hidden = true;
    const bb = new maplibregl.LngLatBounds(); coords.forEach((c) => bb.extend(c));
    if (coords.length > 1) map.fitBounds(bb, { padding: 70, maxZoom: 10, duration: reduced ? 0 : 1800 });
    $('#jragain').onclick = () => { stop(); playJourney({ map, places, coverOf, esc, fmtDate, dateOf, km, host }); };
    if ($('#jrshare')) $('#jrshare').onclick = () => navigator.share({ title: 'My journey', text, url: location.origin + location.pathname }).catch(() => {});
    window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'replay' } }));
  };

  const fly = (c, dur) => (reduced ? map.jumpTo({ center: c, zoom: 9 }) : map.easeTo({ center: c, zoom: 9, duration: dur }));

  // draw the leg from stop i-1 to stop i, then rest on stop i
  const leg = () => {
    if (!alive) return;
    if (i >= coords.length - 1) { timer = setTimeout(finale, HOLD_MS); return; }
    const a = coords[i], b = coords[i + 1], d = km(places[i], places[i + 1]), base = total;
    const done = () => { total = base + d; $('#jrkm').textContent = Math.round(total).toLocaleString('en-ZA'); i += 1; card(places[i], i + 1); timer = setTimeout(leg, HOLD_MS); };
    if (reduced) { drawn.push(b); src().setData(line()); fly(b); done(); return; }
    fly(b, STEP_MS);
    let t0 = 0;
    const tick = (ts) => {
      if (!alive || paused) return;
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / STEP_MS), q = p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      src().setData(line([a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]));
      $('#jrkm').textContent = Math.round(base + d * q).toLocaleString('en-ZA');
      if (p < 1) raf = requestAnimationFrame(tick); else { drawn.push(b); done(); }
    };
    raf = requestAnimationFrame(tick);
  };
  const drawn = [coords[0]];
  const src = () => map.getSource('replay');
  const line = (tip) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: tip ? [...drawn, tip] : drawn.length > 1 ? drawn : [drawn[0], drawn[0]] } });

  function stop() {
    alive = false; cancelAnimationFrame(raf); clearTimeout(timer); ui.remove(); document.removeEventListener('keydown', onKey);
    if (map.getSource('replay')) src().setData(empty);
  }
  const onKey = (e) => { if (e.key === 'Escape') stop(); };
  document.addEventListener('keydown', onKey);
  $('#jrclose').onclick = stop;
  // pause stops the current leg; play redraws that leg from its start (or moves on after a resting stop)
  $('#jrpause').onclick = () => {
    paused = !paused;
    $('#jrpause').textContent = paused ? '▶' : '❚❚'; $('#jrpause').setAttribute('aria-label', paused ? 'Play' : 'Pause');
    clearTimeout(timer); cancelAnimationFrame(raf);
    if (paused) { map.stop(); src().setData(line()); } else leg();
  };

  fly(coords[0], reduced ? 0 : 1600);
  card(places[0], 1);
  timer = setTimeout(leg, reduced ? HOLD_MS : 1600 + HOLD_MS);
  return stop;
}
