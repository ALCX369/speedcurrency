// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Theme mods: our own looks. Everyone picks their own; two are Premium.
// "Suggest one for me" can use an optional he / she / skip answer, kept only on this device.
export const THEMES = [
  { id: 'dune', name: 'Dune Gold', desc: 'Warm ivory and desert gold. The SpeedCurrency classic.', premium: false, sw: ['#F4F1EA', '#D8A657', '#14120E'] },
  { id: 'ember', name: 'Ember Sport', desc: 'Bold, fast and fiery: racing stripes and ember orange.', premium: false, sw: ['#F3F1EE', '#FF5A1F', '#111214'] },
  { id: 'ocean', name: 'Ocean Blue', desc: 'Swakopmund sea and Skeleton Coast fog.', premium: true, sw: ['#EEF3F5', '#2F8FB5', '#0E1B22'] },
  { id: 'rose', name: 'Rose Quartz', desc: 'Kalahari sunset pink with soft gold.', premium: true, sw: ['#F7F0EF', '#D46A7E', '#1E1316'] },
  { id: 'welwitschia', name: 'Welwitschia', desc: 'Sage and deep olive, after the 1,000-year-old desert plant.', premium: false, sw: ['#EFF2EA', '#5E7D32', '#13201A'] },
  { id: 'copper', name: 'Kalahari Copper', desc: 'Red dunes at sunset: warm sand and burnished copper.', premium: true, sw: ['#F6EEE6', '#B4552D', '#24120B'] },
  { id: 'stars', name: 'Namib Stars', desc: 'A dark-sky night over the Namib: deep navy with starlight silver.', premium: true, sw: ['#0B0E16', '#9DB4E0', '#E8ECF5'] },
];
const SUGGEST = { he: 'ember', she: 'rose', skip: 'dune' };
const key = (uid) => `sc_theme_${uid || 'guest'}`;

export function applyTheme(uid, premium) {
  let id = 'dune'; try { id = localStorage.getItem(key(uid)) || 'dune'; } catch { /* private mode */ }
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.dataset.mod = t.premium && !premium ? 'dune' : t.id; // a lapsed Premium falls back to Dune Gold
}

export function themePicker({ uid, premium, modal, esc }) {
  let cur = document.documentElement.dataset.mod || 'dune';
  modal(`<div class="stack th-pick"><span class="eyebrow">Theme mods</span><h2 style="margin:0">Make it yours</h2>
    <div class="th-grid">${THEMES.map((t) => `<button type="button" class="th-card ${t.id === cur ? 'on' : ''}" data-th="${t.id}" aria-pressed="${t.id === cur}">
      <span class="th-sw">${t.sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span><b>${esc(t.name)}${t.premium ? ' <small class="th-prem">★ Premium</small>' : ''}</b><small>${esc(t.desc)}</small></button>`).join('')}</div>
    <details class="th-suggest"><summary>✦ Suggest one for me</summary><p class="small muted" style="margin:6px 0">Optional. Your answer stays on this phone only.</p>
      <div class="row wrap" style="gap:6px"><button type="button" class="chip" data-sg="he">He / him</button><button type="button" class="chip" data-sg="she">She / her</button><button type="button" class="chip" data-sg="skip">Skip</button></div></details>
    <p class="small muted th-msg" style="margin:0" aria-live="polite"></p>
    <button class="btn small ghost" data-close style="align-self:flex-start">Done</button></div>`, (pnl) => {
    const msg = pnl.querySelector('.th-msg');
    const pick = (id) => {
      const t = THEMES.find((x) => x.id === id); if (!t) return;
      if (t.premium && !premium) { msg.innerHTML = `${esc(t.name)} is a Premium theme. <a href="#/account?tab=plans" data-close>See Premium</a>`; return; }
      try { localStorage.setItem(key(uid), id); } catch { /* private mode */ }
      document.documentElement.dataset.mod = id; cur = id;
      pnl.querySelectorAll('[data-th]').forEach((b) => { b.classList.toggle('on', b.dataset.th === id); b.setAttribute('aria-pressed', String(b.dataset.th === id)); });
      msg.textContent = `${t.name} is on.`;
    };
    pnl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-th]'); if (b) pick(b.dataset.th);
      const s = e.target.closest('[data-sg]'); if (s) { const id = SUGGEST[s.dataset.sg]; const t = THEMES.find((x) => x.id === id); msg.textContent = `Suggested: ${t.name}.`; pick(id); }
    });
  });
}
