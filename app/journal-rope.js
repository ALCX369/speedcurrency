// Journal as a rope: every entry is a knot on one twisted rope, newest at the top.
// Endless scroll: 6 knots at a time, the next 6 load as the rope's end comes into view.
// Strands under each card link the memory to the rest of the app: other visits to the same
// place, news from it, the assistant, and its photos.

const PAGE = 6;

const monthDay = (d) => {
  if (!d) return { day: '·', mon: '' };
  const x = new Date(d + (String(d).length === 10 ? 'T00:00:00' : ''));
  return { day: x.getDate(), mon: x.toLocaleDateString(undefined, { month: 'short' }) };
};
const yearOf = (e) => (e.visited_on || e.created_at || '').slice(0, 4);

export async function JournalRope(main, deps) {
  const { api, esc, fmtDate, editEntry, storyPlayer, toast } = deps;
  const entries = (await api.list('journal_entries', { order: 'visited_on' }))
    .slice().sort((a, b) => String(b.visited_on || b.created_at).localeCompare(String(a.visited_on || a.created_at)));
  const byPlace = new Map();
  for (const e of entries) { const k = (e.place_name || '').trim().toLowerCase(); if (k) byPlace.set(k, [...(byPlace.get(k) || []), e]); }

  main.innerHTML = `
  <header class="rope-head">
    <div><h1>Your journey</h1>
      <p>${entries.length ? `${entries.length} ${entries.length === 1 ? 'memory' : 'memories'} tied along one rope. Scroll down to travel back in time.` : 'Every trip you write down becomes a knot on this rope.'}</p></div>
    <div class="row wrap"><button class="btn ghost" id="playj">Play my journey</button><a class="btn ghost" href="#/album">Album</a></div>
  </header>
  <div class="rope" id="rope">
    <div class="rope-end top"><span class="rope-tip" aria-hidden="true"></span><button class="btn primary" id="newj">New entry</button></div>
    <ol class="rope-list" id="ropelist" aria-label="Your journal, newest first"></ol>
    <div class="rope-more" id="ropemore" aria-live="polite"></div>
  </div>`;

  const list = main.querySelector('#ropelist');
  const more = main.querySelector('#ropemore');
  let shown = 0; let lastYear = null; let busy = false;

  const strands = (e) => {
    const out = [];
    const k = (e.place_name || '').trim().toLowerCase();
    const twins = k ? (byPlace.get(k) || []).filter((x) => x.id !== e.id) : [];
    if (twins.length) out.push(`<a class="strand" href="#/journal/${esc(twins[0].id)}">Also here: ${esc(twins[0].title)}</a>`);
    if (e.place_name) {
      const place = e.place_name.split(',')[0].trim();
      out.push(`<a class="strand" href="#/updates?place=${encodeURIComponent(place)}">News from ${esc(place)}</a>`);
      out.push(`<a class="strand" href="#/planner?q=${encodeURIComponent(`What should I know before going back to ${place}? Reviews, prices and tips.`)}">Ask about ${esc(place)}</a>`);
    }
    if (e.people?.length) out.push(`<span class="strand quiet">Met ${e.people.length} ${e.people.length === 1 ? 'person' : 'people'}</span>`);
    return out.slice(0, 4).join('');
  };

  const knot = (e, cover, i) => {
    const { day, mon } = monthDay(e.visited_on || e.created_at);
    const stars = e.rating ? `<span class="rope-stars" aria-label="${e.rating} out of 5 stars">${'★'.repeat(e.rating)}<span>${'★'.repeat(5 - e.rating)}</span></span>` : '';
    const n = e.photos?.length || 0;
    return `<li class="knot-row ${i % 2 ? 'right' : 'left'}${shown + i === 0 ? ' newest' : ''}">
      <button class="knot" type="button" data-knot aria-label="Memory from ${esc(fmtDate(e.visited_on || e.created_at) || 'an unknown date')}"><b>${esc(String(day))}</b><small>${esc(mon)}</small></button>
      <article class="memory">
        <a class="memory-link" href="#/journal/${esc(e.id)}">
          ${cover ? `<span class="memory-photo" style="background-image:url('${esc(cover)}')">${n > 1 ? `<span class="memory-count">${n} photos</span>` : ''}</span>` : ''}
          <span class="memory-body"><span class="memory-place">${esc(e.place_name || 'Somewhere on the road')}</span>
            <strong>${esc(e.title)}</strong>${stars}
            ${e.story ? `<span class="memory-story">${esc(e.story.slice(0, 160))}${e.story.length > 160 ? '…' : ''}</span>` : ''}</span>
        </a>
        <div class="strands">${strands(e)}</div>
      </article></li>`;
  };

  const loadMore = async () => {
    if (busy || shown >= entries.length) return;
    busy = true; more.textContent = 'Pulling up more of the rope…';
    const batch = entries.slice(shown, shown + PAGE);
    let covers = [];
    try { covers = await api.photoUrls(batch.map((e) => e.photos?.[0]).filter(Boolean)); } catch { /* photos optional */ }
    let ci = 0; let html = '';
    batch.forEach((e, i) => {
      const y = yearOf(e);
      if (y && y !== lastYear) { html += `<li class="year-knot" aria-hidden="false"><span>${esc(y)}</span></li>`; lastYear = y; }
      html += knot(e, e.photos?.length ? covers[ci++] : '', i);
    });
    list.insertAdjacentHTML('beforeend', html);
    shown += batch.length; busy = false;
    if (shown >= entries.length) {
      more.innerHTML = entries.length
        ? `<div class="rope-end frayed"><span class="fray" aria-hidden="true"></span><p>Your rope starts here: ${esc(entries[entries.length - 1].title)}${entries[entries.length - 1].visited_on ? `, ${esc(fmtDate(entries[entries.length - 1].visited_on))}` : ''}.</p></div>`
        : `<div class="rope-empty"><p>No memories yet. Add your first trip, with photos, the place and a short story, and it becomes the first knot.</p></div>`;
      io?.disconnect();
    } else more.textContent = '';
  };

  // Endless scroll: the sentinel under the rope triggers the next 6 knots.
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) loadMore(); }, { rootMargin: '600px 0px' })
    : null;
  await loadMore();
  if (io) io.observe(more); else { more.innerHTML = '<button class="btn ghost" id="ropebtn">Show more</button>'; }
  // Listen on the rope itself (replaced on every visit), not on <main>, so handlers never pile up.
  main.querySelector('#rope').addEventListener('click', (ev) => {
    if (ev.target.id === 'ropebtn') loadMore();
    const k = ev.target.closest('[data-knot]');
    if (k) { k.classList.remove('tug'); void k.offsetWidth; k.classList.add('tug'); k.parentElement.querySelector('.memory-link')?.focus(); }
  });

  main.querySelector('#newj').onclick = () => editEntry();
  main.querySelector('#playj').onclick = async () => {
    const withPh = entries.filter((e) => e.photos?.length).slice(0, 12);
    if (!withPh.length) { toast('Add photos to your entries to play your journey'); return; }
    const urls = await api.photoUrls(withPh.flatMap((e) => e.photos.slice(0, 4))); let k = 0;
    storyPlayer(withPh.flatMap((e) => e.photos.slice(0, 4).map(() => ({ e, img: urls[k++] }))), 'My journey');
  };
  return () => io?.disconnect();
}
