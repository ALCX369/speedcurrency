// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Where am I? The app's default content (Home, postcards, trends, news, Nami, local ads) follows the traveller.
//   Country: from the phone's time zone (private, no permission needed).
//   Town: only after the user taps "Use my location"; reverse-geocoded with Photon, kept on this device only.
const KEY = 'sc_here';
const TZ = { 'Africa/Windhoek': ['NA', 'Namibia'], 'Africa/Johannesburg': ['ZA', 'South Africa'] };
const fresh = (h) => h && Date.now() - h.at < 6 * 3600e3;

export function here() {
  let h = null; try { h = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* private mode */ }
  if (h?.town) return h;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const [cc, country] = TZ[tz] || [null, null];
  return { cc, country, town: null, approx: true };
}

async function reverse(lat, lng) {
  const j = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
  const p = j.features?.[0]?.properties || {};
  const cc = String(p.countrycode || '').toUpperCase();
  return { town: p.city || p.town || p.village || p.county || p.name || null, region: p.state || '', cc: ['NA', 'ZA'].includes(cc) ? cc : null, country: p.country || '' };
}

/** Ask the browser for the position (user action), save the nearest town, return it. */
export function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await reverse(pos.coords.latitude, pos.coords.longitude);
        const h = { ...r, lat: +pos.coords.latitude.toFixed(3), lng: +pos.coords.longitude.toFixed(3), at: Date.now() };
        try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('sc:here', { detail: h })); res(h);
      } catch (e) { rej(e); }
    }, () => rej(new Error('Location permission was not given.')), { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60e3 });
  });
}

/** If permission was already given, refresh the town quietly (no prompt). */
export async function refreshQuietly() {
  let h = null; try { h = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* none */ }
  if (!h?.town || fresh(h)) return;
  try { const st = await navigator.permissions?.query({ name: 'geolocation' }); if (st?.state === 'granted') await locate(); } catch { /* keep the old town */ }
}

export function forget() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
