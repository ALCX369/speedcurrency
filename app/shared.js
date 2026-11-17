// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Small helpers shared by several modules (one copy each):
//   country choice (Namibia / South Africa), "database update not installed yet" detection,
//   CSV download, free-photo check and "Place, Town" labels.

// ---- country: Explore, the town finder and anything else follow one saved choice ----
export const REGION = {
  NA: { name: 'Namibia', towns: ['Windhoek', 'Swakopmund', 'Walvis Bay', 'Lüderitz', 'Keetmanshoop', 'Ondangwa', 'Oshakati', 'Rundu', 'Katima Mulilo', 'Otjiwarongo', 'Tsumeb'],
    sights: ['Sossusvlei', 'Etosha National Park', 'Fish River Canyon', 'Spitzkoppe', 'Kolmanskop', 'Epupa Falls'], bounds: [[11.7, -29], [25.3, -16.9]] },
  ZA: { name: 'South Africa', towns: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Stellenbosch', 'Franschhoek', 'Hermanus', 'Knysna', 'Gqeberha', 'Bloemfontein', 'Mbombela'],
    sights: ['Table Mountain', 'Kruger National Park', 'Cape Point', 'Drakensberg', 'Robben Island', 'Blyde River Canyon'], bounds: [[16.3, -35], [33, -22]] },
};
export const regionNow = () => { try { return localStorage.getItem('sc_cc') === 'ZA' ? 'ZA' : 'NA'; } catch { return 'NA'; } };
export const regionOf = (place) => Object.keys(REGION).find((k) => [...REGION[k].towns, ...REGION[k].sights].includes(place)) || regionNow();
export function setRegion(cc) {
  cc = cc === 'ZA' ? 'ZA' : 'NA';
  try { localStorage.setItem('sc_cc', cc); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('sc:country', { detail: { cc } }));
}
/** Calls fn(cc) whenever the country changes; returns a function that stops listening. */
export function onRegion(fn) { const h = (e) => fn(e.detail.cc); window.addEventListener('sc:country', h); return () => window.removeEventListener('sc:country', h); }

// ---- database update 016 not installed yet: read Postgres / PostgREST error codes, not message text ----
// 42703 missing column · 42883/PGRST202 missing function · 42P01/PGRST205 missing table · storage "Bucket not found"
export const notReady = (e) => /^(42703|42883|42P01|PGRST202|PGRST204|PGRST205)$/.test(String(e?.code || '')) || /bucket not found/i.test(e?.message || '');
export const rateLimited = (e) => /rate_limited/.test(e?.message || '');
export const SOON = 'This is switching on very soon.';

// ---- CSV download (cells that start with = + - @ are made safe for spreadsheets) ----
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`.replace(/^"([=+\-@])/, '"\'$1');
export function csvDownload(name, rows) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

// ---- free photos we may keep and show again later (Wikimedia / Wikipedia uploads only) ----
export const okImg = (u) => (/^https:\/\/upload\.wikimedia\.org\/[^\s'"()<>]+$/.test(u || '') ? u : null);

// ---- "Place, Town" (or just "Place" when the town is the place) ----
export const placeLabel = (p) => (p.town && p.town !== p.name ? `${p.name}, ${p.town}` : p.name);
