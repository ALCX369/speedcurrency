// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Journey Pulse: the app's heartbeat, in the spirit of training and streak apps.
// XP for real travel actions, levels from Wanderer to Namib Legend, a daily streak flame,
// three daily quests, badges, and a little celebration when you level up.
// Any part of the app reports an action with:  window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind, meta } }))
// Progress is kept on this device (per account).

const LEVELS = [[0, 'Wanderer'], [100, 'Scout'], [250, 'Pathfinder'], [500, 'Dune Walker'], [900, 'Trailblazer'], [1500, 'Desert Fox'], [2500, 'Skeleton Coast Captain'], [4000, 'Namib Legend']];
const XP = { postcard: 10, wrapped: 5, open: 10, memory: 40, photo: 5, town: 15, place: 5, convert: 2, ready: 5, updates: 5, explore: 5, tag: 10, replay: 5 };
const DAILY_CAP = { convert: 5, place: 10, photo: 12 }; // stops XP farming
const QUESTS = [
  ['town', 1, 'Explore a town on the map', '#/explore', 25],
  ['place', 3, 'Open 3 places in Explore', '#/explore', 20],
  ['memory', 1, 'Add a memory to your journey', '#/journal?new=1', 40],
  ['convert', 1, 'Convert some money', '#/', 10],
  ['ready', 1, 'Check your Ready to Go list', '#/ready', 10],
  ['updates', 1, "Read today's local news", '#/updates', 10],
];
const BADGES = [
  ['first', 'First memory', (s) => s.count.memory >= 1],
  ['streak3', '3-day streak', (s) => s.best >= 3],
  ['streak7', '7-day streak', (s) => s.best >= 7],
  ['towns5', '5 towns explored', (s) => s.towns.length >= 5],
  ['places20', '20 places opened', (s) => s.count.place >= 20],
  ['money', 'Money master', (s) => s.count.convert >= 20],
];

const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let KEY = 'sc_pulse_guest';
const blank = () => ({ xp: 0, days: [], best: 0, towns: [], count: {}, today: { d: '', n: {}, quests: [] }, badges: [] });
const load = () => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };

export const levelOf = (xp) => {
  let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const [from, name] = LEVELS[i]; const to = LEVELS[i + 1]?.[0] ?? from;
  return { i, name, from, to, pct: to > from ? (xp - from) / (to - from) : 1, next: LEVELS[i + 1]?.[1] || null };
};
const streakOf = (days) => { // consecutive days ending today or yesterday
  const set = new Set(days); let n = 0; const d = new Date();
  if (!set.has(day(d))) d.setDate(d.getDate() - 1);
  while (set.has(day(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
};
const questsFor = (d) => { // 3 quests a day, the same all day
  let h = 0; for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = QUESTS.slice(); const out = [];
  while (out.length < 3) { out.push(pool.splice(h % pool.length, 1)[0]); h = Math.floor(h / 7) + 3; }
  return out.map((q) => q[0]);
};

function rollDay(s) {
  const d = day();
  if (s.today.d !== d) s.today = { d, n: {}, quests: questsFor(d), done: [] };
  s.today.done ||= [];
  return s;
}

/** Records an action, gives XP, and celebrates quests, badges and level-ups. */
export function award(kind, meta = {}) {
  const s = rollDay(load());
  const before = levelOf(s.xp).i;
  s.today.n[kind] = (s.today.n[kind] || 0) + 1;
  s.count[kind] = (s.count[kind] || 0) + 1;
  let gain = 0;
  if (kind === 'open') {
    if (!s.days.includes(s.today.d)) { s.days = [...s.days.slice(-60), s.today.d]; gain = XP.open + Math.min(streakOf(s.days), 7) * 2; }
  } else if (kind === 'town') {
    const t = String(meta.name || '').toLowerCase(); if (t && !s.towns.includes(t)) { s.towns.push(t); gain = XP.town; }
  } else if (!DAILY_CAP[kind] || s.today.n[kind] <= DAILY_CAP[kind]) gain = (XP[kind] || 0) * (meta.n || 1);
  s.best = Math.max(s.best, streakOf(s.days));
  const msgs = [];
  // quests
  for (const k of s.today.quests) {
    const q = QUESTS.find((x) => x[0] === k);
    if (q && !s.today.done.includes(k) && (s.today.n[k] || 0) >= q[1]) { s.today.done.push(k); gain += q[4]; msgs.push(`Quest done: ${q[2]}`); }
  }
  // badges
  for (const [id, label, test] of BADGES) if (!s.badges.includes(id) && test(s)) { s.badges.push(id); msgs.push(`Badge earned: ${label}`); }
  s.xp += gain; save(s);
  const after = levelOf(s.xp);
  if (gain) floatXp(gain);
  if (after.i > before) celebrate(`Level up! You are now a ${after.name}`);
  else if (msgs.length) celebrate(msgs[0], true);
  document.querySelectorAll('[data-pulse-card]').forEach((el) => paintCard(el));
  return gain;
}

/* ---------- feedback: floating +XP, confetti, banner ---------- */
function floatXp(n) {
  const el = document.createElement('div'); el.className = 'xp-float'; el.textContent = `+${n} XP`; el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el); setTimeout(() => el.remove(), 1600);
}
function celebrate(text, small = false) {
  const b = document.createElement('div'); b.className = 'pulse-banner' + (small ? ' small' : ''); b.setAttribute('role', 'status'); b.textContent = text;
  document.body.appendChild(b); setTimeout(() => b.remove(), 3200);
  if (still() || small) return;
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const colors = ['#F0CB8A', '#D8A657', '#FF6A2B', '#F3ECDF', '#86D6A8'];
  box.innerHTML = Array.from({ length: 36 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100)}vw;--d:${(Math.random() * .8 + .9).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--c:${colors[i % colors.length]};--delay:${(Math.random() * .25).toFixed(2)}s"></i>`).join('');
  document.body.appendChild(box); setTimeout(() => box.remove(), 2400);
}

/* ---------- Home card ---------- */
const flame = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2c1 3.5-1.6 5-1.6 7.6 0 1.4 1 2.4 2.2 2.4 1.6 0 2.4-1.4 2-3.4 2.7 1.8 4.4 4.6 4.4 7.4A7 7 0 0 1 12 23a7 7 0 0 1-7-7c0-4.6 4.4-7.4 7-14Z"/></svg>';

function paintCard(el) {
  const s = rollDay(load()); save(s);
  const lv = levelOf(s.xp); const streak = streakOf(s.days);
  const C = 2 * Math.PI * 46; const off = C * (1 - lv.pct);
  const week = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (6 - k)); return { on: s.days.includes(day(d)), l: d.toLocaleDateString(undefined, { weekday: 'narrow' }), today: k === 6 }; });
  el.innerHTML = `
    <div class="pulse-top">
      <svg class="pulse-ring" viewBox="0 0 110 110" role="img" aria-label="Level ${lv.i + 1}, ${Math.round(lv.pct * 100)}% to the next level">
        <circle class="pr-bg" cx="55" cy="55" r="46"/><circle class="pr-fg" cx="55" cy="55" r="46" style="stroke-dasharray:${C};stroke-dashoffset:${C}" data-off="${off}"/>
        <text x="55" y="52" class="pr-n">${lv.i + 1}</text><text x="55" y="70" class="pr-l">LEVEL</text></svg>
      <div class="pulse-who"><span class="eyebrow">Journey pulse</span><b>${lv.name}</b>
        <small><span class="xp-count" data-to="${s.xp}">0</span> XP${lv.next ? ` · ${lv.to - s.xp} to ${lv.next}` : ' · top level'}</small></div>
      <div class="streak ${streak ? 'lit' : ''}" title="Daily streak">${flame}<b>${streak}</b><small>day${streak === 1 ? '' : 's'}</small></div>
    </div>
    <div class="week" aria-label="This week">${week.map((w) => `<span class="${w.on ? 'on' : ''}${w.today ? ' today' : ''}"><i></i>${w.l}</span>`).join('')}</div>
    <div class="quests"><div class="row between"><b>Today's quests</b><small class="muted">${s.today.done.length}/3 done</small></div>
      ${s.today.quests.map((k) => { const q = QUESTS.find((x) => x[0] === k); const n = Math.min(s.today.n[k] || 0, q[1]); const done = s.today.done.includes(k);
        return `<a class="quest ${done ? 'done' : ''}" href="${q[3]}"><span class="qk" aria-hidden="true">${done ? '✓' : ''}</span><span class="qt">${q[2]}${q[1] > 1 ? ` <small>${n}/${q[1]}</small>` : ''}</span><span class="qx">+${q[4]}</span></a>`; }).join('')}</div>
    <div class="badges" aria-label="Badges">${BADGES.map(([id, label]) => `<span class="bdg ${s.badges.includes(id) ? 'got' : ''}" title="${label}">${label}</span>`).join('')}</div>`;
  // animate: ring fills, XP counts up
  requestAnimationFrame(() => { const fg = el.querySelector('.pr-fg'); if (fg) fg.style.strokeDashoffset = fg.dataset.off; });
  const xc = el.querySelector('.xp-count'); const to = +xc.dataset.to;
  if (still() || to < 2) { xc.textContent = to; return; }
  const t0 = performance.now(); const from = +(el.dataset.shown || 0);
  const tick = (t) => { const k = Math.min((t - t0) / 900, 1); xc.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(tick); else el.dataset.shown = to; };
  requestAnimationFrame(tick);
}

export function mountPulseCard(el) { el.setAttribute('data-pulse-card', ''); paintCard(el); }

/** Starts listening for actions from anywhere in the app. Call once after sign-in. */
let started = false;
export function startPulse(userId) {
  KEY = `sc_pulse_${userId || 'guest'}`;
  if (!started) { started = true; window.addEventListener('sc:pulse', (e) => award(e.detail?.kind, e.detail?.meta)); }
  award('open');
}
