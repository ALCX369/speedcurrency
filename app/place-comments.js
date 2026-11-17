// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Place comments: anyone signed in can comment on a place or town (table place_comments, migration 016).
// Used by the Explore place window and the Town Guide. Demo mode keeps comments on this device.

import { avatarHtml, nameOf } from './avatars.js';
import { notReady, rateLimited, SOON } from './shared.js';

const LOCAL = 'sc_demo_place_comments';
const local = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { return []; } };

export async function mountComments(el, { key, name, sb, S, DEMO, esc, ago, toast, people = async () => ({}) }) {
  if (!el) return;
  const me = S?.user?.id;
  el.innerHTML = `<div class="pcm">
    <div class="row between"><h3 style="margin:0">Comments <span class="muted" id="pcmn"></span></h3></div>
    <div class="pcm-list" id="pcml" aria-live="polite"><div class="skeleton"><span></span></div></div>
    ${me ? `<form class="pcm-form" id="pcmf"><label class="sr" for="pcmi">Comment on ${esc(name)}</label>
      <input id="pcmi" maxlength="500" placeholder="Say something about ${esc(name)}…" autocomplete="off" required>
      <button class="btn small primary">Post</button></form>` : '<p class="small muted">Sign in to comment.</p>'}</div>`;
  const list = el.querySelector('#pcml');

  const load = async () => {
    if (DEMO) return local().filter((c) => c.place_key === key);
    const { data, error } = await sb.from('place_comments').select('id, user_id, body, created_at').eq('place_key', key).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
  };
  let rows = [], who = {};
  const draw = async (fresh = true) => {
    if (fresh) {
      try { rows = await load(); } catch (e) { list.innerHTML = `<p class="small muted" style="margin:0">${notReady(e) ? SOON : 'Comments could not load. Check your connection.'}</p>`; if (notReady(e)) el.querySelector('#pcmf')?.setAttribute('hidden', ''); return; }
      who = DEMO ? {} : await people(rows.map((r) => r.user_id)).catch(() => ({}));
    }
    el.querySelector('#pcmn').textContent = rows.length ? `(${rows.length})` : '';
    list.innerHTML = rows.length ? rows.map((c) => `<div class="pcm-c">${avatarHtml(who[c.user_id], esc)}
        <div><b>${DEMO && c.user_id === me ? 'You' : esc(nameOf(who[c.user_id]))}</b> <small class="muted">${esc(ago(c.created_at))}</small><p>${esc(c.body)}</p></div>
        ${c.user_id === me || S?.isAdmin ? `<button type="button" class="pcm-del" data-del="${esc(c.id)}" aria-label="Delete comment">✕</button>` : ''}</div>`).join('')
      : '<p class="small muted" style="margin:0">No comments yet. Be the first to share a tip.</p>';
    list.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this comment?')) return;
      if (DEMO) { try { localStorage.setItem(LOCAL, JSON.stringify(local().filter((c) => c.id !== b.dataset.del))); } catch { /* full */ } }
      else { const { error } = await sb.from('place_comments').delete().eq('id', b.dataset.del); if (error) { toast(error.message); return; } }
      rows = rows.filter((c) => c.id !== b.dataset.del); draw(false); // no need to download the list again
    });
  };

  const form = el.querySelector('#pcmf');
  if (form) form.onsubmit = async (ev) => {
    ev.preventDefault();
    const inp = form.querySelector('#pcmi'); const body = inp.value.trim(); if (!body) return;
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      if (DEMO) { const all = local(); all.unshift({ id: crypto.randomUUID(), place_key: key, place_name: name, user_id: me, body, created_at: new Date().toISOString() }); localStorage.setItem(LOCAL, JSON.stringify(all.slice(0, 300))); }
      else { const { data, error } = await sb.from('place_comments').insert({ place_key: key, place_name: String(name).slice(0, 120), body: body.slice(0, 500) }).select('id, user_id, body, created_at').single(); if (error) throw error; rows.unshift(data); if (S.profile) who[me] = S.profile; }
      inp.value = ''; toast('Comment posted');
      window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'comment' } }));
      await draw(DEMO); // online: show the new comment straight away, no re-download
    } catch (e) { toast(rateLimited(e) ? 'Slow down a little: too many comments this hour' : notReady(e) ? SOON : e.message); } finally { btn.disabled = false; }
  };
  await draw();
}
