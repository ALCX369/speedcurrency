// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// My schedule: private plans (stored as trips, only the owner can read them).
//   scheduleSheet(): "Add to my schedule" from a place or town: date + a 33-character hope, then similar places.
//   mountScheduleCard(): the private card on your own profile.
//   checkSchedule(): when the app opens, a reminder for plans that start within 9 days (once per plan),
//                    plus a phone notification when allowed. The .ics file gives a calendar alarm 9 days before.

export const HOPE_MAX = 33;
export const NOTIFY_DAYS = 9;
const DAY = 86400000;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dateOf = (s) => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? null : d; };
const daysTo = (s) => { const d = dateOf(s); return d ? Math.round((d - today()) / DAY) : null; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isPlan = (t) => t?.reminder?.schedule === true;
// only free photos from Wikimedia / Wikipedia are kept with a plan (safe, public addresses)
const okImg = (u) => (/^https:\/\/upload\.wikimedia\.org\/[^\s'""()<>]+$/.test(u || '') ? u : null);

// calendar file: an all-day event with an alarm 9 days before (works in Google, Apple and Outlook calendars)
export function icsFor(t) {
  const d = dateOf(t.start_date); if (!d) return null;
  const ymd = iso(d).replace(/-/g, ''), next = iso(new Date(d.getTime() + DAY)).replace(/-/g, '');
  const clean = (s) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\r?\n/g, ' ');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SpeedCurrency//Schedule//EN', 'BEGIN:VEVENT',
    `UID:${t.id || ymd}@speedcurrency`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${clean('Trip: ' + t.destination)}`,
    `DESCRIPTION:${clean(t.notes ? 'Hoping for: ' + t.notes : 'Planned in SpeedCurrency')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${clean(`${t.destination} in ${NOTIFY_DAYS} days`)}`, `TRIGGER:-P${NOTIFY_DAYS}D`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
}
const saveIcs = (t) => { const u = icsFor(t); if (!u) return; const a = document.createElement('a'); a.href = u; a.download = `trip-${String(t.destination).replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}.ics`; a.click(); };

/** place = { name, town?, kind?, key? }; similar = async () => [{ name, sub, open() }] */
export function scheduleSheet({ place, api, modal, esc, toast, similar }) {
  const min = iso(new Date(today().getTime() + DAY));
  modal(`<form class="pw sch" id="schf"><span class="eyebrow">🔒 Private · only you see this</span><h2>Add to my schedule</h2>
      <p class="small muted" style="margin:0">${esc(place.name)}${place.town && place.town !== place.name ? ' · ' + esc(place.town) : ''}</p>
      <div class="field"><label for="schd">When are you going?</label><input class="input" type="date" id="schd" min="${min}" required></div>
      <div class="field"><label for="schh">What are you hoping for? <span class="muted" id="schn">0/${HOPE_MAX}</span></label>
        <input class="input" id="schh" maxlength="${HOPE_MAX}" placeholder="e.g. Sunrise on the dunes" autocomplete="off"></div>
      <p class="small muted" style="margin:0">We remind you ${NOTIFY_DAYS} days before.</p>
      <div class="row wrap"><button class="btn small primary">📅 Add to my schedule</button><button type="button" class="btn small ghost" data-close>Cancel</button></div></form>`, (pnl, close) => {
    const h = pnl.querySelector('#schh');
    h.oninput = () => { pnl.querySelector('#schn').textContent = `${h.value.length}/${HOPE_MAX}`; };
    pnl.querySelector('#schf').onsubmit = async (ev) => {
      ev.preventDefault();
      const date = pnl.querySelector('#schd').value; if (!date || daysTo(date) < 1) { toast('Pick a date from tomorrow on'); return; }
      const btn = pnl.querySelector('#schf button'); btn.disabled = true;
      try {
        const t = await api.insert('trips', {
          destination: String(place.town && place.town !== place.name ? `${place.name}, ${place.town}` : place.name).slice(0, 120),
          start_date: date, end_date: date, notes: h.value.trim().slice(0, HOPE_MAX) || null,
          reminder: { schedule: true, notify_days: NOTIFY_DAYS, place: place.name, kind: place.kind || null, key: place.key || null, img: okImg(place.img) },
        });
        window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'memory' } }));
        const remind = new Date(dateOf(date).getTime() - NOTIFY_DAYS * DAY);
        pnl.querySelector('#schf').outerHTML = `<div class="pw sch"><span class="eyebrow">✓ Saved to your schedule</span><h2>${esc(place.name)}</h2>
          <p style="margin:0"><b>${esc(new Date(date + 'T00:00:00').toDateString())}</b>${t.notes ? ` · “${esc(t.notes)}”` : ''}</p>
          <p class="small muted" style="margin:0">Reminder on ${esc(remind > today() ? remind.toDateString() : 'your next visit to the app')}.</p>
          <div class="row wrap"><button type="button" class="btn small primary" id="schics">Add to phone calendar</button>${'Notification' in window && Notification.permission === 'default' ? '<button type="button" class="btn small ghost" id="schnot">Allow reminders</button>' : ''}<a class="btn small ghost" href="#/account" data-close>My schedule</a></div>
          <h3 style="margin:8px 0 0">You might also like</h3><div class="sch-sim" id="schsim"><div class="skeleton"><span></span></div></div>
          <button type="button" class="btn small ghost" data-close style="align-self:flex-start">Done</button></div>`;
        pnl.querySelector('#schics').onclick = () => saveIcs(t);
        pnl.querySelector('#schnot')?.addEventListener('click', async (e) => { const p = await Notification.requestPermission().catch(() => 'denied'); e.target.remove(); toast(p === 'granted' ? 'Reminders allowed' : 'You can still use the calendar file'); });
        const box = pnl.querySelector('#schsim');
        let list = []; try { list = (await similar?.()) || []; } catch { /* offline */ }
        if (!box.isConnected) return;
        box.innerHTML = list.length ? list.slice(0, 4).map((s, i) => `<button type="button" class="sch-s" data-i="${i}"><b>${esc(s.name)}</b><small>${esc(s.sub || '')}</small></button>`).join('')
          : '<p class="small muted" style="margin:0">No similar places found nearby right now.</p>';
        box.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { close(); list[+b.dataset.i].open?.(); });
      } catch (e) { toast(e.message); btn.disabled = false; }
    };
  });
}

// private card on your own profile
export async function mountScheduleCard(el, { api, esc, toast }) {
  if (!el) return;
  const draw = async () => {
    const plans = (await api.list('trips').catch(() => [])).filter(isPlan).filter((t) => daysTo(t.start_date) >= 0).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
    el.innerHTML = `<div class="sch-card"><div class="row between"><h2 style="margin:0">📅 My schedule</h2><small class="muted">🔒 Only you</small></div>
      ${plans.length ? plans.map((t) => { const n = daysTo(t.start_date);
        const img = okImg(t.reminder?.img);
        return `<div class="sch-row${img ? ' has-img' : ''}" style="${img ? `background-image:linear-gradient(90deg,rgba(13,11,8,.88),rgba(13,11,8,.35)),url('${esc(img)}')` : ''}"><span class="sch-n"><b>${n}</b><small>${n === 1 ? 'day' : 'days'}</small></span>
          <span class="sch-t"><b>${esc(t.destination)}</b><small>${esc(new Date(t.start_date + 'T00:00:00').toDateString())}${n <= NOTIFY_DAYS ? ' · <span class="sch-soon">coming up</span>' : ''}</small>${t.notes ? `<em>“${esc(t.notes)}”</em>` : ''}</span>
          <span class="sch-a"><button type="button" class="btn small ghost" data-ics="${esc(t.id)}" aria-label="Add ${esc(t.destination)} to phone calendar">📆</button><button type="button" class="btn small ghost" data-del="${esc(t.id)}" aria-label="Remove ${esc(t.destination)} from schedule">✕</button></span></div>`; }).join('')
      : '<p class="small muted" style="margin:0">Nothing planned yet. Tap <b>📅 Add to my schedule</b> on any place in Explore or a town guide.</p>'}</div>`;
    el.querySelectorAll('[data-ics]').forEach((b) => b.onclick = () => saveIcs(plans.find((t) => t.id === b.dataset.ics)));
    el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (!confirm('Remove this plan from your schedule?')) return; try { await api.remove('trips', b.dataset.del); draw(); } catch (e) { toast(e.message); } });
  };
  await draw();
}

// once per plan: a reminder when the trip is 9 days away or closer
export async function checkSchedule({ api, toast, uid }) {
  const KEY = `sc_sched_seen_${uid}`;
  let seen = []; try { seen = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* none */ }
  const plans = (await api.list('trips').catch(() => [])).filter(isPlan).filter((t) => daysTo(t.start_date) >= 0);
  seen = seen.filter((sid) => plans.some((t) => t.id === sid)); // forget plans that are over, so the list never overflows
  const due = plans.filter((t) => daysTo(t.start_date) <= NOTIFY_DAYS && !seen.includes(t.id));
  for (const t of due) {
    const n = daysTo(t.start_date);
    const msg = n === 0 ? `Today: ${t.destination}! Have a wonderful trip.` : `${t.destination} is in ${n} day${n === 1 ? '' : 's'}${t.notes ? `: “${t.notes}”` : ''}`;
    toast(`📅 ${msg}`);
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('SpeedCurrency schedule', { body: msg, icon: 'icon.svg' }); } catch { /* not supported */ }
    seen.push(t.id);
  }
  try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* private mode */ }
}
