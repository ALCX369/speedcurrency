// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Traveller profile (#/u/<id>): an Instagram/TikTok-style page in SpeedCurrency's own look.
// Cover from their latest memory, gold-ring avatar, stats, a 3-column grid of their public journey,
// and chat right inside the profile (a sliding chat sheet), so you never leave their journey to talk.
import { safeImg } from './explore-swipe.js';

export async function Profile(main, r, { esc, api, sb, S, DEMO, modal, toast, reportFlow, premium, fmtDate }) {
  const uid = decodeURIComponent(r.id || '');
  if (!uid) { location.hash = '#/explore'; return; }
  const me = uid === S.user?.id;
  main.innerHTML = '<div class="skeleton" style="margin-top:20px"><span></span><span></span><span></span></div>';

  const [people, entries] = await Promise.all([
    me ? Promise.resolve({ [uid]: S.profile }) : api.profilesById([uid]).catch(() => ({})),
    DEMO ? Promise.resolve([]) : sb.from('journal_entries').select('*').eq('user_id', uid).eq('is_public', true).order('created_at', { ascending: false }).limit(60).then(({ data }) => data || []),
  ]);
  const a = people[uid] || {};
  const name = a.display_name || (a.username ? '@' + a.username : 'Traveller');
  const paths = entries.flatMap((e) => (e.photos || []).slice(0, 1));
  const urls = paths.length ? await api.photoUrls(paths).catch(() => []) : [];
  const cover = {}; paths.forEach((p, i) => { cover[p] = safeImg(urls[i]); });
  const places = new Set(entries.map((e) => (e.place_name || '').split(',')[0].trim()).filter(Boolean));
  const photos = entries.reduce((n, e) => n + (e.photos || []).length, 0);
  const hero = cover[entries.find((e) => e.photos?.length)?.photos?.[0]] || '';
  let level = '';
  if (me) { try { const m = await import('./journey-pulse.js'); const s = JSON.parse(localStorage.getItem(`sc_pulse_${uid}`) || '{}'); level = m.levelOf(s.xp || 0).name; } catch { /* no pulse yet */ } }

  main.innerHTML = `
    <header class="pf-hero" style="${hero ? `background-image:linear-gradient(180deg,rgba(13,11,8,.1),rgba(13,11,8,.92)),url('${esc(hero)}')` : ''}">
      <span class="pf-av" aria-hidden="true">${esc(name.replace('@', '')[0]?.toUpperCase() || '✦')}</span>
      <h1>${esc(name)}${me && premium() ? ' <span class="pf-prem" title="Premium member">★ Premium</span>' : ''}</h1>
      <p class="pf-sub">${[a.username ? '@' + a.username : '', a.home_country ? 'from ' + a.home_country : '', level ? level : ''].filter(Boolean).map(esc).join(' · ')}</p>
      ${a.bio ? `<p class="pf-bio">${esc(a.bio)}</p>` : ''}
      <div class="pf-stats"><span><b>${entries.length}</b>memories</span><span><b>${places.size}</b>places</span><span><b>${photos}</b>photos</span></div>
      <div class="row wrap pf-acts">
        ${me ? '<a class="btn small primary" href="#/account">Edit profile</a><a class="btn small ghost" href="#/journal?new=1">Add a memory</a>'
          : '<button type="button" class="btn small primary" id="pfchat">💬 Message</button>'}
        <button type="button" class="btn small ghost" id="pfshare">Share</button>
        ${me ? '' : '<button type="button" class="btn small ghost" id="pfmore" aria-label="Report or block">•••</button>'}
      </div>
    </header>
    <div class="row between pf-tabs"><h2>${me ? 'Your public journey' : `${esc(name.split(' ')[0])}'s journey`}</h2><small class="muted">${places.size ? [...places].slice(0, 3).map(esc).join(' · ') : ''}</small></div>
    ${entries.length ? `<div class="pf-grid">${entries.map((e) => { const c = cover[e.photos?.[0]];
      return `<a class="pf-cell" href="#/journal/${esc(e.id)}" style="${c ? `background-image:url('${esc(c)}')` : ''}" aria-label="${esc(e.title)}">${c ? '' : `<span>${esc(e.title.slice(0, 40))}</span>`}${(e.photos || []).length > 1 ? `<i>${e.photos.length}</i>` : ''}</a>`; }).join('')}</div>`
      : `<div class="empty">${me ? 'Nothing public yet. Make a memory public from your journal and it shows here.' : 'No public memories yet.'}</div>`}
    <section class="pf-sheet" id="pfsheet" hidden aria-label="Chat with ${esc(name)}">
      <div class="pf-sheet-top"><b>💬 ${esc(name)}</b><button type="button" class="btn small ghost" id="pfclose" aria-label="Close chat">✕</button></div>
      <div class="pf-msgs" id="pfmsgs" aria-live="polite"></div>
      <form class="pf-send" id="pfsend"><label class="sr" for="pfin">Message</label><input id="pfin" class="input" maxlength="1000" placeholder="Say hi, ask about their trip…" autocomplete="off"><button class="btn small primary">Send</button></form>
      <a class="small" href="#/messages?to=${esc(uid)}">Open in Chats →</a>
    </section>`;

  main.querySelector('#pfshare').onclick = async () => {
    const link = `${location.origin}${location.pathname}#/u/${encodeURIComponent(uid)}`;
    try { if (navigator.share) await navigator.share({ title: `${name} on SpeedCurrency`, url: link }); else { await navigator.clipboard.writeText(link); toast('Profile link copied'); } } catch { /* cancelled */ }
  };
  main.querySelector('#pfmore')?.addEventListener('click', () => reportFlow('user', uid, uid));

  // chat inside the profile
  let timer = null, conv = null;
  const sheet = main.querySelector('#pfsheet'); const box = main.querySelector('#pfmsgs');
  const paint = (list) => {
    box.innerHTML = list.length ? list.map((m) => `<div class="pf-msg ${m.sender_id === S.user.id ? 'mine' : ''}"><span>${esc(m.body)}</span><small>${esc(fmtDate(m.created_at))}</small></div>`).join('')
      : '<p class="small muted" style="margin:0">No messages yet. Say hello 👋</p>';
    box.scrollTop = box.scrollHeight;
  };
  const load = async () => {
    if (!conv) { const all = await api.conversations(); conv = all.find((c) => [c.user_a, c.user_b].includes(uid)) || null; }
    paint(conv ? await api.messages(conv.id) : []);
  };
  main.querySelector('#pfchat')?.addEventListener('click', async () => {
    sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open'));
    if (DEMO) { box.innerHTML = '<p class="small muted" style="margin:0">Chats work once you are signed in online.</p>'; return; }
    box.innerHTML = '<div class="skeleton"><span></span></div>';
    try { await load(); } catch { box.innerHTML = '<p class="small muted" style="margin:0">Could not load the chat. Try again.</p>'; }
    clearInterval(timer); timer = setInterval(() => { if (document.body.contains(sheet) && !sheet.hidden) load().catch(() => {}); else clearInterval(timer); }, 8000);
    main.querySelector('#pfin').focus();
  });
  main.querySelector('#pfclose').onclick = () => { sheet.classList.remove('open'); clearInterval(timer); setTimeout(() => { sheet.hidden = true; }, 250); };
  main.querySelector('#pfsend').onsubmit = async (e) => {
    e.preventDefault(); const inp = main.querySelector('#pfin'); const body = inp.value.trim(); if (!body) return;
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try { await api.sendMessage(uid, body); inp.value = ''; conv = null; await load(); window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'message' } })); }
    catch (err) { toast(err.message); } finally { btn.disabled = false; }
  };
  return () => clearInterval(timer);
}
