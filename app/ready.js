// "Ready to Go": a pre-trip readiness score, a worldwide checklist and Namibia must-knows.
// Facts were checked against the linked sources on 15 Nov 2026. Rules change: every card says where to confirm.
// The checklist is saved on this device only (localStorage); it is a convenience, nothing depends on it.

const CHECKED = '15 Nov 2026';
const KEY = 'sc-ready-v1';

const CHECKLIST = [
  ['passport', 'Passport valid 6+ months after you arrive, with 3 blank pages'],
  ['visa', 'Visa or e-Visa sorted (print the e-Visa if you have one)'],
  ['insurance', 'Travel insurance that covers medical evacuation'],
  ['copies', 'Photos of passport, visa, insurance and bookings saved offline + one copy left with family'],
  ['embassy', 'Registered your trip with your embassy (free in most countries)'],
  ['bank', 'Bank told about your trip, and a second card packed'],
  ['cash', 'Some local cash for fuel, parks and small shops'],
  ['health', 'Vaccines checked; malaria tablets if you go north'],
  ['maps', 'Offline maps downloaded (signal drops between towns)'],
  ['contacts', 'Emergency numbers saved in your phone'],
  ['plan', 'Someone at home has your route and dates'],
  ['meds', 'Medicine, sunscreen, hat and plenty of drinking water for long drives'],
];

const SRC = {
  visa: ['https://thebrief.com.na/?p=22339', 'The Brief (visa fees)'],
  visa2: ['https://namibiaembassyusa.org/wp-content/uploads/2025/03/Fact-Sheet-Visa-Requirements-to-Namibia_18.03.25.pdf', 'Namibian Embassy fact sheet'],
  roads: ['https://travel.gc.ca/destinations/namibia', 'Government of Canada advisory'],
  roads2: ['https://travel.state.gov/en/international-travel/travel-advisories/namibia.html', 'US State Dept'],
  parks: ['https://safarifind.com/blog/namibia-self-drive-safari-2026-park-permits-explained', 'Park permits 2026'],
  money: ['https://www.bon.com.na/Informations/Media/Media-Releases/2025-Media-Releases/Articles/Inflation-Target.aspx', 'Bank of Namibia'],
  health: ['https://tabiji-prod.pages.dev/health/namibia/', 'Travel health guide'],
  world: ['https://travel.state.gov/en/international-travel/planning/checklist.html', 'Official travel checklist'],
};

const NAMIBIA = [
  { e: '🛂', t: 'Entry & visas', s: ['visa', 'visa2'], p: [
    'Since April 2025 many nationalities (incl. USA, Canada and most of Europe) need a visa. Check your passport on the Home Affairs e-Services portal.',
    '<b>e-Visa: N$1,600.</b> Visa at the airport counter was raised to <b>N$2,000</b> (reported Sept 2025). Apply online first: it is cheaper and faster.',
    'Passport: 6 months valid, 3 blank pages. Print your e-Visa and carry it.',
  ] },
  { e: '🚙', t: 'Roads (the #1 risk)', s: ['roads', 'roads2'], p: [
    'Gravel-road crashes are the biggest danger to visitors, usually from speed. Drive slower than feels necessary, especially on bends and loose patches.',
    '<b>Don\'t drive after dark</b> outside towns: animals and stray livestock on the road.',
    'Fuel up at every town; distances are long and help outside Windhoek can be slow.',
  ] },
  { e: '🐘', t: 'Parks & Etosha', s: ['parks'], p: [
    'From 1 April 2026 Etosha costs about <b>N$280 per foreign adult per day</b>, N$180 for SADC citizens and N$60 for Namibians (plus a vehicle fee). Confirm at the gate.',
    'A lodge booking does not replace your park entry fee.',
    'Stay in your car unless a guide or ranger says it is safe. Ask the gate what time the camps close and be back before then.',
  ] },
  { e: '💵', t: 'Money', s: ['money'], p: [
    '<b>N$1 = R1</b>, always. South African rand is accepted everywhere in Namibia.',
    'The Namibian dollar is <b>not</b> accepted in South Africa: spend or swap your N$ before you leave.',
    'Cards work in towns; carry cash for fuel stations, parks and rural shops.',
  ] },
  { e: '🩺', t: 'Health & sun', s: ['health'], p: [
    'Malaria risk is in the north: Etosha, the Zambezi (Caprivi) and near the Angolan border. Windhoek, Sossusvlei and the coast are malaria-free.',
    'Arriving from a yellow-fever country (or a long stopover there)? Bring your yellow fever certificate.',
    'Desert sun is strong all year: water, hat, sunscreen. Fever after a northern trip = see a doctor fast.',
  ] },
  { e: '🆘', t: 'Emergencies', s: ['roads'], p: [
    '<b>Police: 10111</b> (the most widely listed number). Ambulance numbers differ by town; save your lodge\'s number too.',
    'In remote areas help can take 2+ hours. Tell someone your route and when you will arrive.',
  ], call: '10111' },
];

function season(month) {
  return month >= 10 || month <= 2
    ? { e: '🌧️', h: 'Rainy season (Nov–Mar)', b: 'Gravel roads can turn slippery and rivers can flood fast. A 4x4 is safer off the main roads, and the desert turns green.' }
    : { e: '☀️', h: 'Dry season (Apr–Oct)', b: 'Best time for wildlife at the waterholes. Days are warm, nights in the desert get cold, so pack a jacket.' };
}

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: keep in memory only */ } }

function passportStatus(expiry, fmtDate) {
  if (!expiry) return { cls: 'warn', text: 'Add your passport expiry in Account so we can check it for you.', link: '#/account' };
  const months = (new Date(expiry) - new Date()) / (30.44 * 864e5);
  if (months < 0) return { cls: 'bad', text: `Expired on ${fmtDate(expiry)}. Renew before you book anything.` };
  if (months < 6) return { cls: 'bad', text: `Expires ${fmtDate(expiry)}: under 6 months. Many countries, Namibia included, ask for 6 months and may refuse boarding or entry.` };
  if (months < 9) return { cls: 'warn', text: `Expires ${fmtDate(expiry)}. Fine for a short trip now; renew before longer travel.` };
  return { cls: 'ok', text: `Valid until ${fmtDate(expiry)}. You're good. ✨`, done: true };
}

function ring(pct) {
  const r = 46, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<svg class="ring" viewBox="0 0 110 110" role="img" aria-label="${pct}% ready">
    <circle cx="55" cy="55" r="${r}" class="ring-bg"/>
    <circle cx="55" cy="55" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    <text x="55" y="61" text-anchor="middle" class="ring-txt">${pct}%</text></svg>`;
}

const srcLinks = (keys, esc) => keys.map((k) => `<a href="${esc(SRC[k][0])}" target="_blank" rel="noopener noreferrer">${esc(SRC[k][1])}</a>`).join(' · ');

export function Ready(main, { esc, fmtDate, profile }) {
  const state = load();
  const pass = passportStatus(profile?.passport_expiry, fmtDate);
  const sea = season(new Date().getMonth());

  const score = () => {
    const done = CHECKLIST.filter(([k]) => state[k]).length + (pass.done ? 1 : 0);
    return Math.round((done / (CHECKLIST.length + 1)) * 100);
  };
  const mood = (p) => (p === 100 ? 'Fully ready. Have the best trip! 🧡' : p >= 66 ? 'Almost there, just a few things left.' : p >= 33 ? 'Good start. Keep ticking.' : 'Let\'s get you ready, one tick at a time.');

  main.innerHTML = `
  <div class="page-head reveal"><div><span class="eyebrow">✅ Ready to Go</span><h1>Know before you go</h1>
    <p>Your pre-trip score, a checklist that works for any country, and the Namibia must-knows locals wish every visitor read first.</p></div></div>

  <section class="ready-hero card night reveal" aria-label="Your readiness">
    <div id="rring">${ring(score())}</div>
    <div class="stack" style="gap:6px"><h2 style="color:var(--on-dark);margin:0">You're <span id="rpct">${score()}</span>% ready</h2>
      <p id="rmood" aria-live="polite" style="margin:0;color:var(--on-dark-muted)">${mood(score())}</p>
      <div class="pass ${pass.cls}"><span aria-hidden="true">🛂</span> ${esc(pass.text)}${pass.link ? ` <a href="${pass.link}">Add it →</a>` : ''}</div></div>
  </section>

  <div class="season reveal"><span aria-hidden="true">${sea.e}</span><div><b>Now in Namibia: ${sea.h}</b><br><span class="muted">${sea.b}</span></div></div>

  <section class="section reveal"><div class="row between"><h2>Your checklist</h2><button class="btn small ghost" id="rreset" type="button">Start over</button></div>
    <ul class="checklist" id="rlist">${CHECKLIST.map(([k, l]) => `<li><label><input type="checkbox" data-k="${k}" ${state[k] ? 'checked' : ''}><span>${esc(l)}</span></label></li>`).join('')}</ul>
    <p class="small muted">Saved on this device. Source: ${srcLinks(['world'], esc)}</p></section>

  <section class="section reveal"><h2>Namibia must-knows</h2>
    <div class="grid g2 know">${NAMIBIA.map((n) => `<article class="card stack">
      <h3 style="margin:0"><span aria-hidden="true">${n.e}</span> ${esc(n.t)}</h3>
      <ul class="md-ul">${n.p.map((x) => `<li>${x}</li>`).join('')}</ul>
      ${n.call ? `<a class="btn primary small" href="tel:${n.call}" style="align-self:flex-start">📞 Call ${n.call}</a>` : ''}
      <p class="small muted" style="margin:auto 0 0">Checked ${CHECKED} · ${srcLinks(n.s, esc)}</p></article>`).join('')}</div></section>

  <section class="card accent stack reveal"><h2 style="margin:0">Going somewhere else?</h2>
    <p style="margin:0">The assistant checks visas, fees and warnings for your passport and destination, with sources.</p>
    <a class="btn dark" href="#/planner?q=${encodeURIComponent('Check my trip: visa for my passport, entry rules, health requirements, safety warnings and money tips for ')}" style="align-self:flex-start">Check my next trip →</a></section>`;

  const repaint = () => {
    const p = score();
    main.querySelector('#rring').innerHTML = ring(p);
    main.querySelector('#rpct').textContent = p;
    main.querySelector('#rmood').textContent = `${p}% ready. ${mood(p)}`;
  };
  main.querySelector('#rlist').addEventListener('change', (e) => {
    const k = e.target?.dataset?.k; if (!k) return;
    state[k] = e.target.checked; save(state); repaint();
  });
  main.querySelector('#rreset').onclick = () => {
    for (const k of Object.keys(state)) delete state[k];
    save(state); main.querySelectorAll('#rlist input').forEach((i) => { i.checked = false; }); repaint();
  };
}
