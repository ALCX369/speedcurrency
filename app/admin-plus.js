// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Admin workspace extras (admin only, needs migration 016):
//   Tracker:  one snapshot of the business per day (admin_track), trend lines + table + CSV.
//   Members:  everyone who joined (admin_members), search, CSV.
//   Comments: newest place comments, remove any.
// The Overview + payments view stays in app.js (Admin).

import { csvDownload, notReady } from './shared.js';

// update 016 not installed yet -> a clear note; any other error (offline, signed out) says what happened
const failed = (err, esc) => (notReady(err) ? '<div class="notice">This part needs database update 016. Run it once in Supabase (SQL editor), then reload.</div>' : `<div class="notice">Could not load this: ${esc(err.message || 'connection problem')}. Try again.</div>`);
// small line chart, accessible: the numbers are also in the table below
function spark(points, label) {
  const w = 280, h = 64, n = points.length;
  if (!n) return '';
  const max = Math.max(...points), min = Math.min(...points), span = max - min || 1;
  const xy = points.map((v, i) => [n === 1 ? w / 2 : (i / (n - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[n - 1];
  return `<svg viewBox="0 0 ${w} ${h}" class="ad-spark" role="img" aria-label="${label}: ${points[0]} to ${points[n - 1]} over ${n} day${n === 1 ? '' : 's'}">
    <path d="${d} L${w} ${h} L0 ${h} Z" class="ad-area"/><path d="${d}" class="ad-line"/><circle cx="${lx}" cy="${ly}" r="4" class="ad-dot"/></svg>`;
}

export async function AdminPlus(box, view, { sb, esc, fmtDate, ago, toast, money }) {
  box.innerHTML = '<div class="skeleton"><span></span><span></span></div>';

  if (view === 'tracker') {
    const { data, error } = await sb.rpc('admin_track');
    if (error) { box.innerHTML = failed(error, esc); return; }
    const rows = data || [];
    const last = rows[rows.length - 1] || {}, first = rows[0] || {};
    const M = [['members', 'Members'], ['paying', 'Paying members'], ['revenue_total', 'Earned all time (N$)'], ['questions_total', 'AI questions asked'], ['memories_total', 'Memories saved'], ['comments_total', 'Place comments']];
    const diff = (k) => { const d = (last[k] || 0) - (first[k] || 0); return rows.length > 1 ? `${d >= 0 ? '+' : ''}${money(d, 0)} since ${fmtDate(first.day)}` : 'first day recorded'; };
    box.innerHTML = `<p class="muted">Today's numbers are saved each time you open this tab, so the lines grow day by day (last 90 days).</p>
      <div class="ad-grid">${M.map(([k, l]) => `<div class="card ad-tile"><span class="small muted">${l}</span><b>${money(last[k] || 0, 0)}</b><small>${diff(k)}</small>${spark(rows.map((r) => +r[k] || 0), l)}</div>`).join('')}</div>
      <div class="row between wrap" style="margin:18px 0 8px"><h3>Daily record</h3><button type="button" class="btn small ghost" id="adcsv">Download CSV</button></div>
      <div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Day</th><th>Members</th><th>Paying</th><th>Earned N$</th><th>Pending</th><th>AI Qs</th><th>Memories</th><th>Comments</th></tr></thead>
      <tbody>${rows.slice().reverse().map((r) => `<tr><td>${esc(fmtDate(r.day))}</td><td>${r.members}</td><td>${r.paying}</td><td>${money(r.revenue_total, 0)}</td><td>${r.payments_pending}</td><td>${r.questions_total}</td><td>${r.memories_total}</td><td>${r.comments_total}</td></tr>`).join('')}</tbody></table></div>`;
    box.querySelector('#adcsv').onclick = () => csvDownload('speedcurrency-tracker', [['Day', 'Members', 'Paying', 'Earned NAD', 'Pending payments', 'AI questions', 'Memories', 'Comments', 'Reports 30d'],
      ...rows.map((r) => [r.day, r.members, r.paying, r.revenue_total, r.payments_pending, r.questions_total, r.memories_total, r.comments_total, r.reports_30d])]);
    return;
  }

  if (view === 'members') {
    const { data, error } = await sb.rpc('admin_members');
    if (error) { box.innerHTML = failed(error, esc); return; }
    const all = data || [];
    const now = Date.now();
    const plan = (m) => (m.plan !== 'free' && m.premium_until && new Date(m.premium_until) > now ? m.plan : 'free');
    box.innerHTML = `<div class="row wrap" style="gap:8px;margin-bottom:12px"><label class="sr" for="adq">Search members</label>
        <input id="adq" type="search" placeholder="Search name, email, country…" style="flex:1;min-width:200px">
        <button type="button" class="btn small ghost" id="adcsv">Download CSV</button></div>
      <p class="small muted" id="adcount"></p><div class="stack" id="adlist"></div>`;
    const draw = () => {
      const q = box.querySelector('#adq').value.trim().toLowerCase();
      const list = all.filter((m) => !q || [m.display_name, m.username, m.email, m.home_country, m.plan].some((v) => String(v || '').toLowerCase().includes(q)));
      box.querySelector('#adcount').textContent = `${list.length} of ${all.length} members`;
      box.querySelector('#adlist').innerHTML = list.map((m) => `<div class="card ad-member">
        <div class="row between wrap"><a href="#/u/${esc(m.id)}"><b>${esc(m.display_name || m.username || 'Member')}</b></a><span class="badge ${plan(m) === 'free' ? '' : 'dark'}">${esc(plan(m))}${m.account_type === 'business' ? ' · business' : ''}</span></div>
        <span class="small muted">${esc(m.email || '')}${m.home_country ? ' · ' + esc(m.home_country) : ''}</span>
        <span class="small">Joined ${esc(fmtDate(m.created_at))} · last seen ${m.last_sign_in ? esc(ago(m.last_sign_in)) : 'never'} · ${m.memories} memories · ${m.questions} AI questions · ${m.comments} comments</span></div>`).join('') || '<div class="notice">No one matches.</div>';
    };
    box.querySelector('#adq').oninput = draw; draw();
    box.querySelector('#adcsv').onclick = () => csvDownload('speedcurrency-members', [['Name', 'Username', 'Email', 'Country', 'Plan', 'Paid until', 'Type', 'Joined', 'Last seen', 'Memories', 'AI questions', 'Comments'],
      ...all.map((m) => [m.display_name, m.username, m.email, m.home_country, plan(m), (m.premium_until || '').slice(0, 10), m.account_type, (m.created_at || '').slice(0, 10), (m.last_sign_in || '').slice(0, 10), m.memories, m.questions, m.comments])]);
    return;
  }

  if (view === 'comments') {
    const { data, error } = await sb.from('place_comments').select('id, place_key, place_name, user_id, body, created_at').order('created_at', { ascending: false }).limit(100);
    if (error) { box.innerHTML = failed(error, esc); return; }
    box.innerHTML = (data || []).length ? `<div class="stack">${data.map((c) => `<div class="card ad-member" id="c-${esc(c.id)}">
        <div class="row between wrap"><b>${esc(c.place_name)}</b><span class="small muted">${esc(ago(c.created_at))}</span></div>
        <p style="margin:4px 0">${esc(c.body)}</p>
        <div class="row between wrap"><a class="small" href="#/u/${esc(c.user_id)}">See who wrote it</a><button type="button" class="btn small ghost" data-del="${esc(c.id)}">Remove</button></div></div>`).join('')}</div>`
      : '<div class="notice">No place comments yet. They appear here as soon as travellers comment in Explore.</div>';
    box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (!confirm('Remove this comment for everyone?')) return;
      b.disabled = true;
      const { error: e } = await sb.from('place_comments').delete().eq('id', b.dataset.del);
      if (e) { toast(e.message); b.disabled = false; return; }
      box.querySelector(`#c-${CSS.escape(b.dataset.del)}`)?.remove(); toast('Comment removed');
    });
  }
}
