// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// One memory: up to 6 photos that change every 9 seconds, a location tag, people tagged on the
// photo (tap a spot, type their @username, like Instagram), and the story in an editable bubble.
// Tags live in the entry's existing `people` list as { name, username, from_country, photo, x, y }.

const SLIDE_MS = 9000;
const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function mountMemory(root, ctx) {
  const { e, urls, mine, api, esc, toast, findTraveller } = ctx;
  let i = 0; let timer = null; let paused = false; let tagMode = false; let showTags = false;
  const n = urls.length;
  const tagsOn = (k) => (e.people || []).filter((p) => p.photo === k && p.x != null);

  root.innerHTML = `
    <div class="ms" aria-roledescription="slideshow" aria-label="Photos from this memory">
      ${n ? urls.map((u, k) => `<div class="ms-slide${k === 0 ? ' on' : ''}" style="background-image:url('${esc(u)}')" role="img" aria-label="Photo ${k + 1} of ${n}" aria-hidden="${k !== 0}"></div>`).join('')
        : '<div class="ms-slide on ms-empty" role="img" aria-label="No photos yet"></div>'}
      ${n > 1 ? `<div class="ms-bars" aria-hidden="true">${urls.map(() => '<i><b></b></i>').join('')}</div>` : ''}
      <div class="ms-tags" id="mstags"></div>
      ${n > 1 ? `<button class="ms-hit prev" type="button" aria-label="Previous photo"></button><button class="ms-hit next" type="button" aria-label="Next photo"></button>` : ''}
      <div class="ms-foot">
        ${e.place_name ? `<span class="loc-tag"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>${esc(e.place_name.split(',').slice(0, 2).join(','))}</span>` : '<span></span>'}
        <span class="row" style="gap:8px">
          ${n > 1 ? '<button class="ms-btn" type="button" id="mspause" aria-label="Pause slideshow">❚❚</button>' : ''}
          ${n ? `<button class="ms-btn" type="button" id="mstagbtn" aria-pressed="false" aria-label="Show people tagged in this photo"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"/></svg><span id="mstagn"></span></button>` : ''}
        </span>
      </div>
    </div>
    ${mine && n ? '<button class="btn ghost small ms-tagmode" type="button" id="mstagmode" aria-pressed="false">Tag people</button><p class="small muted ms-hint" id="mshint" hidden>Tap the person in the photo, then type their @username. Tap a tag to remove it.</p>' : ''}
    <div class="bubble" id="bubble">
      <p class="bubble-text" id="btext">${esc(e.story || (mine ? 'Tell the story of this moment…' : 'No story yet.'))}</p>
      ${mine ? '<button class="bubble-edit" type="button" id="bedit" aria-label="Edit story"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm17.7-10.2a1 1 0 0 0 0-1.4l-2.35-2.35a1 1 0 0 0-1.4 0l-1.84 1.83 3.75 3.75 1.84-1.83Z"/></svg></button>' : ''}
    </div>`;

  const slides = [...root.querySelectorAll('.ms-slide')];
  const bars = [...root.querySelectorAll('.ms-bars i')];
  const tagLayer = root.querySelector('#mstags');
  const tagBtn = root.querySelector('#mstagbtn');

  const drawTags = () => {
    const list = tagsOn(i);
    const cnt = root.querySelector('#mstagn'); if (cnt) cnt.textContent = list.length ? String(list.length) : '';
    if (tagBtn) tagBtn.hidden = !list.length && !tagMode;
    const visible = showTags || tagMode;
    tagLayer.innerHTML = visible ? list.map((p) => `<button type="button" class="ptag" data-u="${esc(p.username || p.name)}" style="left:${+p.x}%;top:${+p.y}%">${p.username ? '@' + esc(p.username) : esc(p.name)}${tagMode ? ' <span aria-hidden="true">✕</span>' : ''}</button>`).join('') : '';
    tagLayer.classList.toggle('editing', tagMode);
  };

  const go = (k) => {
    if (!n) return;
    i = (k + n) % n;
    slides.forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', String(j !== i)); });
    bars.forEach((b, j) => { b.className = j < i ? 'done' : j === i ? 'now' : ''; b.style.setProperty('--ms', `${SLIDE_MS}ms`); });
    drawTags(); restart();
  };
  const restart = () => {
    clearTimeout(timer);
    root.querySelector('.ms')?.classList.toggle('paused', paused || tagMode);
    if (n > 1 && !paused && !tagMode && !still()) timer = setTimeout(() => go(i + 1), SLIDE_MS);
  };

  root.querySelector('.ms-hit.prev')?.addEventListener('click', () => go(i - 1));
  root.querySelector('.ms-hit.next')?.addEventListener('click', () => go(i + 1));
  const pb = root.querySelector('#mspause');
  if (pb) pb.onclick = () => { paused = !paused; pb.textContent = paused ? '▶' : '❚❚'; pb.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow'); restart(); };
  if (tagBtn) tagBtn.onclick = () => { showTags = !showTags; tagBtn.setAttribute('aria-pressed', String(showTags)); drawTags(); };

  // Owner: tag mode. Tapping the photo drops a tag at that spot.
  const saveTags = async () => { try { await api.update('journal_entries', e.id, { people: e.people }); } catch (err) { toast(err.message); } };
  const modeBtn = root.querySelector('#mstagmode');
  if (modeBtn) modeBtn.onclick = () => {
    tagMode = !tagMode; modeBtn.setAttribute('aria-pressed', String(tagMode)); modeBtn.textContent = tagMode ? 'Done tagging' : 'Tag people';
    root.querySelector('#mshint').hidden = !tagMode; drawTags(); restart();
  };
  tagLayer.addEventListener('click', async (ev) => {
    if (!tagMode) return;
    const pill = ev.target.closest('.ptag');
    if (pill) { // remove this tag
      e.people = (e.people || []).filter((p) => !(p.photo === i && (p.username || p.name) === pill.dataset.u));
      drawTags(); await saveTags(); return;
    }
    const r = tagLayer.getBoundingClientRect();
    const x = Math.round(((ev.clientX - r.left) / r.width) * 100); const y = Math.round(((ev.clientY - r.top) / r.height) * 100);
    const raw = String(await ctx.ask() || '').trim().replace(/^@/, '').toLowerCase();
    if (!raw) return;
    if (!/^[a-z0-9_]{3,20}$/.test(raw)) { toast('Usernames are 3 to 20 letters, numbers or _'); return; }
    const found = await findTraveller(raw);
    if (!found) { toast('No traveller with that username, or they turned tagging off'); return; }
    e.people = [...(e.people || []).filter((p) => !(p.photo === i && p.username === raw)),
      { name: found.display_name || raw, username: raw, from_country: found.home_country || '', photo: i, x: Math.min(95, Math.max(5, x)), y: Math.min(92, Math.max(8, y)) }];
    drawTags(); await saveTags(); toast(`Tagged @${raw}`);
  });

  // Owner: edit the story right in the bubble.
  const be = root.querySelector('#bedit');
  if (be) be.onclick = () => {
    const bub = root.querySelector('#bubble'); const old = e.story || '';
    bub.innerHTML = `<form class="stack" id="bform"><label class="sr" for="bta">Your story</label>
      <textarea class="input" id="bta" maxlength="528" rows="5">${esc(old)}</textarea>
      <div class="row between"><span class="small muted" id="bcnt"></span><span class="row" style="gap:8px"><button type="button" class="btn small ghost" id="bcancel">Cancel</button><button class="btn small primary">Save</button></span></div></form>`;
    const ta = bub.querySelector('#bta'); const c = () => { bub.querySelector('#bcnt').textContent = `${ta.value.length} / 528`; };
    ta.addEventListener('input', c); c(); ta.focus();
    bub.querySelector('#bcancel').onclick = () => ctx.rerender();
    bub.querySelector('#bform').onsubmit = async (ev) => {
      ev.preventDefault();
      try { await api.update('journal_entries', e.id, { story: ta.value.trim() || null }); e.story = ta.value.trim(); toast('Story saved'); ctx.rerender(); } catch (err) { toast(err.message); }
    };
  };

  go(0);
  return () => clearTimeout(timer);
}
