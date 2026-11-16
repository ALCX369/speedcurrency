// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Home top: big "Ready to explore" heading, voice search, and three insight tiles.
// The tiles cost nothing: weather comes from Open-Meteo (free, no key), "trending" opens
// Updates, and the hidden gem changes every day. No AI questions are used here.

const SPOTS = [ // name, lat, lng, link
  ['Swakopmund', -22.68, 14.53, '#/explore-na/Swakopmund'],
  ['Windhoek', -22.56, 17.08, '#/explore-na/Windhoek'],
  ['Sossusvlei', -24.73, 15.29, '#/explore-na/Sossusvlei'],
  ['Etosha', -19.18, 15.92, '#/explore-na/Etosha%20National%20Park'],
  ['Fish River Canyon', -27.59, 17.6, '#/explore-na/Fish%20River%20Canyon'],
  ['Cape Town', -33.92, 18.42, '#/updates?place=Cape%20Town'],
];
export const GEMS = [
  ['Quiver Tree Forest', 'Keetmanshoop · aloe giants'], ['Hoba Meteorite', 'Grootfontein · biggest on Earth'],
  ['Lake Otjikoto', 'Tsumeb · sinkhole lake'], ['Moon Landscape', 'Swakopmund · lunar valleys'],
  ['Sesriem Canyon', 'Sossusvlei · narrow gorge'], ['Spitzkoppe', 'Erongo · granite peaks'],
];
const gemOfDay = () => GEMS[Math.floor(Date.now() / 864e5) % GEMS.length];

const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  trend: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  gem: svg('<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6M12 21L9 9M12 21l3-12"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
};

export function heroHtml(esc, place) {
  const [gem] = gemOfDay();
  return `
  <h1 class="explore-title reveal">Ready to explore<br><em>${esc(place)}?</em></h1>
  <form class="searchbar reveal" id="hsearch" role="search">${IC.search}<label class="sr" for="hq">Search a place</label>
    <input id="hq" placeholder="Search a place, vibe or town" autocomplete="off">
    <button type="button" class="mic" id="hmic" aria-label="Search by voice" hidden>${IC.mic}</button>
    <button class="btn small primary">Go</button></form>
  <section class="insights reveal" aria-label="Insights today"><h2 class="sr">Insights today</h2>
    <a class="insight" href="#/updates"><span class="ic">${IC.trend}</span><b>Trending</b><small>What's on this week</small></a>
    <a class="insight" href="${SPOTS[0][3]}" id="iwx"><span class="ic">${IC.sun}</span><b>Best weather</b><small id="iwxs">Checking today…</small></a>
    <a class="insight" href="#/explore-na/${encodeURIComponent(gem)}"><span class="ic">${IC.gem}</span><b>Hidden gem</b><small>${esc(gem)}</small></a>
  </section>`;
}

export function mountHero(root) {
  // Voice search where the phone supports it (Chrome on Android does)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = root.querySelector('#hmic');
  if (SR && mic) {
    mic.hidden = false;
    mic.onclick = () => {
      const r = new SR(); r.lang = 'en-ZA'; r.interimResults = false;
      mic.classList.add('on');
      r.onresult = (e) => { const q = e.results[0][0].transcript; root.querySelector('#hq').value = q; root.querySelector('#hsearch').requestSubmit(); };
      r.onend = () => mic.classList.remove('on');
      try { r.start(); } catch { mic.classList.remove('on'); }
    };
  }
  // Best weather today: the spot whose high is closest to a comfortable 25°C
  const lat = SPOTS.map((s) => s[1]).join(','); const lng = SPOTS.map((s) => s[2]).join(',');
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_probability_max&forecast_days=1&timezone=auto`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => {
      const rows = (Array.isArray(j) ? j : [j]).map((x, k) => ({ s: SPOTS[k], t: x.daily?.temperature_2m_max?.[0], rain: x.daily?.precipitation_probability_max?.[0] ?? 0 }))
        .filter((x) => typeof x.t === 'number');
      if (!rows.length) throw new Error();
      const best = rows.sort((a, b) => (Math.abs(a.t - 25) + a.rain / 10) - (Math.abs(b.t - 25) + b.rain / 10))[0];
      const a = root.querySelector('#iwx'); const s = root.querySelector('#iwxs'); if (!a || !s) return;
      a.href = best.s[3]; s.textContent = `${best.s[0]} · ${Math.round(best.t)}°C`;
    })
    .catch(() => { const s = root.querySelector('#iwxs'); if (s) s.textContent = 'Swakopmund · cool coast'; });
}
