// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Travel heads-ups: short, editable cloud bubbles with tips and warnings ("Road to Opuwo is gravel, go slow").
// Shown on a traveller's profile and in each Town Guide. Table: public.headsups (migration 014).
const KINDS = [['tip', '💡', 'Tip'], ['warning', '⚠️', 'Warning'], ['road', '🛣', 'Road'], ['safety', '🛡', 'Safety']];
const icon = (k) => (KINDS.find((x) => x[0] === k) || KINDS[0])[1];

export async function mountHeadsups(el, { sb, esc, S, DEMO, town = null, userId = null, title = 'Heads-up' }) {
  if (!el) return;
  if (DEMO) { el.innerHTML = ''; return; }
  const me = S.user?.id; const canAdd = town ? true : userId === me;
  const load = async () => {
    let q = sb.from('headsups').select('*').order('created_at', { ascending: false }).limit(town ? 12 : 6);
    q = town ? q.ilike('town', town) : q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };
  let list = [];
  try { list = await load(); } catch { el.innerHTML = ''; return; } // table not set up yet: stay quiet
  const names = town && list.length ? await sb.rpc('get_profiles', { ids: [...new Set(list.map((h) => h.user_id))] }).then(({ data }) => Object.fromEntries((data || []).map((p) => [p.id, p]))).catch(() => ({})) : {};
  const nm = (uid) => { const p = names[uid]; return p ? (p.display_name || '@' + (p.username || 'traveller')) : ''; };

  const paint = () => {
    el.innerHTML = `<div class="row between hu-head"><b>☁ ${esc(title)}</b>${canAdd ? '<button type="button" class="chip" data-hu="add">＋ Add</button>' : ''}</div>
      <div class="hu-list">${list.length ? list.map((h) => `<div class="hu ${h.kind}" data-id="${esc(h.id)}"><span class="hu-ic" aria-hidden="true">${icon(h.kind)}</span>
        <p>${esc(h.body)}</p><small>${town ? (h.user_id === me ? 'You' : `<a href="#/u/${esc(h.user_id)}">${esc(nm(h.user_id) || 'Traveller')}</a>`) : esc(h.town || '')}${h.town && town ? '' : ''} · ${esc(new Date(h.updated_at || h.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }))}</small>
        ${h.user_id === me ? '<span class="hu-own"><button type="button" data-hu="edit">Edit</button><button type="button" data-hu="del">Delete</button></span>' : ''}</div>`).join('')
        : `<p class="small muted" style="margin:0">${town ? `No heads-ups for ${esc(town)} yet. Know something travellers should? Add it.` : (userId === me ? 'Share a heads-up for other travellers: roads, safety, tips.' : 'No heads-ups yet.')}</p>`}</div>
      <form class="hu-form" hidden><div class="row wrap hu-kinds">${KINDS.map(([k, e, l], i) => `<label class="chip"><input type="radio" name="hk" value="${k}" ${i ? '' : 'checked'}> ${e} ${l}</label>`).join('')}</div>
        ${town ? '' : '<input class="input hu-town" maxlength="60" placeholder="Town (optional), e.g. Opuwo">'}
        <textarea class="input" maxlength="160" rows="2" placeholder="e.g. The road to Opuwo is gravel after Kamanjab, go slow" required></textarea>
        <div class="row" style="gap:8px"><button class="btn small primary">Post</button><button type="button" class="btn small ghost" data-hu="cancel">Cancel</button><small class="muted hu-count">0/160</small></div><p class="small hu-err" aria-live="polite"></p></form>`;
  };
  paint();
  let editing = null;
  const form = () => el.querySelector('.hu-form');
  el.addEventListener('input', (e) => { if (e.target.matches('.hu-form textarea')) el.querySelector('.hu-count').textContent = `${e.target.value.length}/160`; });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-hu]'); if (!b) return;
    const act = b.dataset.hu; const card = b.closest('.hu'); const h = card && list.find((x) => x.id === card.dataset.id);
    if (act === 'add') { editing = null; form().hidden = false; form().querySelector('textarea').value = ''; form().querySelector('textarea').focus(); }
    if (act === 'cancel') { form().hidden = true; editing = null; }
    if (act === 'edit' && h) { editing = h; const f = form(); f.hidden = false; f.querySelector('textarea').value = h.body; f.querySelector(`input[value="${h.kind}"]`).checked = true; const t = f.querySelector('.hu-town'); if (t) t.value = h.town || ''; f.querySelector('textarea').focus(); }
    if (act === 'del' && h && confirm('Delete this heads-up?')) {
      const { error } = await sb.from('headsups').delete().eq('id', h.id);
      if (!error) { list = list.filter((x) => x.id !== h.id); paint(); }
    }
  });
  el.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const err = f.querySelector('.hu-err'); err.textContent = '';
    const body = f.querySelector('textarea').value.trim(); const kind = f.querySelector('input[name="hk"]:checked')?.value || 'tip';
    const t = town || f.querySelector('.hu-town')?.value.trim() || null;
    if (body.length < 3) { err.textContent = 'Write a little more.'; return; }
    const btn = f.querySelector('.btn.primary'); btn.disabled = true;
    const res = editing ? await sb.from('headsups').update({ body, kind, town: t }).eq('id', editing.id).select().single()
      : await sb.from('headsups').insert({ body, kind, town: t }).select().single();
    btn.disabled = false;
    if (res.error) { err.textContent = res.error.message; return; }
    list = editing ? list.map((x) => (x.id === editing.id ? res.data : x)) : [res.data, ...list];
    editing = null; paint();
    window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'tag' } }));
  });
}
