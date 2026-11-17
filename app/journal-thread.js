// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Comments on a journal memory, with replies under each comment (needs migration 016 for replies).
// Everything happens in place: posting, replying, "View 3 more replies", editing and deleting never reload
// the page or jump to the top.
import { avatarHtml, nameOf } from './avatars.js';
import { notReady, SOON } from './shared.js';

const SHOW_REPLIES = 1; // replies shown before "View N more replies"
const EMOJIS = ['😍', '🔥', '👏', '🌍', '🙌', '😂', '🦁', '🏜️'];

export async function mountThread(el, { entryId, mine, open, api, sb, S, esc, ago, toast, premium, comments = null }) {
  if (!el) return;
  const expanded = new Set(); // threads the reader opened stay open after a refresh
  let replyTo = null, all = [], people = {};

  // load() talks to the server; paint() only redraws what is already here (opening replies costs nothing)
  const load = async (rows = null) => {
    all = rows || await api.comments(entryId).catch(() => []);
    people = { ...people, ...await api.profilesById(all.map((c) => c.user_id).filter((id) => !people[id])).catch(() => ({})) };
  };
  const draw = async (rows) => { await load(rows); paint(); };
  const paint = () => {
    const top = all.filter((c) => !c.parent_id);
    const kids = (id) => all.filter((c) => c.parent_id === id);
    const me = S.user?.id;
    const one = (c, reply) => `<div class="jc ${reply ? 'jc-reply' : ''}" data-cid="${esc(c.id)}">${avatarHtml(people[c.user_id], esc)}
      <div class="jc-body"><div class="jc-bubble"><b>${c.user_id === me ? 'You' : esc(nameOf(people[c.user_id]))}</b><span class="cbody">${esc(c.body)}</span></div>
        <div class="jc-meta"><span>${esc(ago(c.created_at))}${c.edited_at ? ' · edited' : ''}</span>
          ${open ? `<button type="button" class="jc-link" data-reply="${esc(c.parent_id || c.id)}" data-to="${esc(nameOf(people[c.user_id]))}">Reply</button>` : ''}
          ${c.user_id === me ? `<button type="button" class="jc-link" data-cedit="${esc(c.id)}">Edit</button>` : ''}
          ${c.user_id === me || mine ? `<button type="button" class="jc-link" data-cdel="${esc(c.id)}">Delete</button>` : ''}</div></div></div>`;
    el.innerHTML = `<h2>Comments <span class="muted">(${all.length})</span></h2>
      <div class="jc-list">${top.map((c) => {
        const r = kids(c.id); const showAll = expanded.has(c.id); const shown = showAll ? r : r.slice(0, SHOW_REPLIES); const more = r.length - shown.length;
        return `<div class="jc-thread">${one(c, false)}
          ${r.length ? `<div class="jc-replies">${shown.map((x) => one(x, true)).join('')}
            ${more > 0 ? `<button type="button" class="jc-more" data-more="${esc(c.id)}">View ${more} more repl${more === 1 ? 'y' : 'ies'}</button>` : r.length > SHOW_REPLIES ? `<button type="button" class="jc-more" data-less="${esc(c.id)}">Hide replies</button>` : ''}</div>` : ''}
          ${replyTo === c.id ? `<form class="jc-form jc-rform" data-rform="${esc(c.id)}"><label class="sr" for="jcr">Reply</label><input class="input" id="jcr" maxlength="300" placeholder="Write a reply…" autocomplete="off"><button class="btn small primary">Reply</button><button type="button" class="btn small ghost" data-rcancel>Cancel</button></form>` : ''}</div>`;
      }).join('') || '<p class="muted" style="margin:0">No comments yet. Be the first to say something kind.</p>'}</div>
      ${open ? `<div class="chips emoji-picks" aria-label="Quick emojis">${EMOJIS.map((x) => `<button type="button" class="chip" data-emo="${x}">${x}</button>`).join('')}</div>
        <form class="jc-form" id="cform"><label class="sr" for="cbody">Comment</label><input class="input" id="cbody" maxlength="300" placeholder="Say something nice…" autocomplete="off"><button class="btn dark">Post</button></form>
        <span class="small muted">${mine || premium() ? 'Comments are free for you.' : 'Commenting uses 1 token.'}</span>` : ''}`;
    el.querySelector('#jcr')?.focus();
  };

  const post = async (body, parent) => {
    try { await api.addComment(entryId, body, parent); toast(parent ? 'Reply posted' : 'Comment posted'); window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'comment' } })); if (parent) { expanded.add(parent); replyTo = null; } await draw(); }
    catch (err) { toast(notReady(err) ? SOON : err.message); }
  };

  // one listener for the whole box, so redrawing never loses handlers
  el.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button'); if (!t || !el.contains(t)) return;
    if (t.dataset.more) { expanded.add(t.dataset.more); return paint(); }
    if (t.dataset.less) { expanded.delete(t.dataset.less); return paint(); }
    if (t.dataset.reply) { replyTo = t.dataset.reply; paint(); const i = el.querySelector('#jcr'); if (i && t.dataset.to) { i.value = `@${t.dataset.to.replace(/^@/, '').split(' ')[0]} `; i.focus(); } return; }
    if (t.hasAttribute('data-rcancel')) { replyTo = null; return paint(); }
    if (t.dataset.emo) { const i = el.querySelector('#cbody'); if (i) { i.value = (i.value + ' ' + t.dataset.emo).trim().slice(0, 300); i.focus(); } return; }
    if (t.dataset.cdel) { if (!confirm('Delete this comment?')) return; const { error } = await sb.from('journal_comments').delete().eq('id', t.dataset.cdel); if (error) { toast(error.message); return; } const gone = t.dataset.cdel; all = all.filter((c) => c.id !== gone && c.parent_id !== gone); return paint(); }
    if (t.dataset.cedit) {
      const span = t.closest('[data-cid]').querySelector('.cbody'); const old = span.textContent;
      span.innerHTML = '<form class="row jc-edit"><input class="input" maxlength="300" aria-label="Edit comment"><button class="btn small primary">Save</button><button type="button" class="btn small ghost" data-ecancel>Cancel</button></form>';
      const f = span.querySelector('form'); const inp = f.querySelector('input'); inp.value = old; inp.focus();
      f.querySelector('[data-ecancel]').onclick = (e2) => { e2.stopPropagation(); span.textContent = old; };
      f.onsubmit = async (e2) => { e2.preventDefault(); const v = inp.value.trim(); if (!v) return; try { await api.editComment(t.dataset.cedit, v); toast('Comment updated'); await draw(); } catch (err) { toast(err.message); } };
    }
  });
  el.addEventListener('submit', (ev) => {
    const f = ev.target; ev.preventDefault();
    if (f.id === 'cform') { const i = f.querySelector('#cbody'); const b = i.value.trim(); if (b) { i.value = ''; post(b, null); } }
    else if (f.dataset.rform) { const b = f.querySelector('#jcr').value.trim(); if (b) post(b, f.dataset.rform); }
  });
  await draw(comments);
}
