// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// "I've been here": add a past visit (e.g. Cape Town last year) straight into your Journey as a memory.
// Pick the year (month optional) and a short caption; the Journey grid groups memories by year, newest first.

export function beenHereSheet({ place, api, modal, esc, toast }) {
  const now = new Date(); const Y = now.getFullYear();
  const years = Array.from({ length: 40 }, (_, k) => Y - k);
  const months = ['Any month', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  modal(`<form class="pw" id="bhf"><span class="eyebrow">Add to my journey</span><h2>I've been to ${esc(place.name)}</h2>
      <div class="row wrap" style="gap:10px">
        <div class="field" style="flex:1;min-width:120px"><label for="bhy">Year</label><select class="input" id="bhy">${years.map((y) => `<option${y === Y - 1 ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
        <div class="field" style="flex:1;min-width:140px"><label for="bhm">Month</label><select class="input" id="bhm">${months.map((m, i) => `<option value="${i}">${m}</option>`).join('')}</select></div></div>
      <div class="field"><label for="bht">Caption</label><input class="input" id="bht" maxlength="80" value="${esc(place.name)}" required></div>
      <div class="field"><label for="bhs">A line about it (optional)</label><input class="input" id="bhs" maxlength="200" placeholder="What made it special?"></div>
      <label class="row" style="gap:8px;min-height:44px"><input type="checkbox" id="bhp"> Show it on my public profile</label>
      <p class="small muted" style="margin:0">Add photos later from the memory page.</p>
      <div class="row wrap"><button class="btn small primary">✓ Add to my journey</button><button type="button" class="btn small ghost" data-close>Cancel</button></div></form>`, (pnl, close) => {
    pnl.querySelector('#bhf').onsubmit = async (ev) => {
      ev.preventDefault();
      const y = +pnl.querySelector('#bhy').value, m = +pnl.querySelector('#bhm').value;
      const when = new Date(y, Math.max(0, m - 1), 1);
      if (when > now) { toast('Pick a date in the past'); return; }
      const b = pnl.querySelector('#bhf button'); b.disabled = true;
      try {
        const e = await api.insert('journal_entries', {
          title: pnl.querySelector('#bht').value.trim().slice(0, 80) || place.name,
          story: pnl.querySelector('#bhs').value.trim().slice(0, 200) || null,
          place_name: [place.name, place.town && place.town !== place.name ? place.town : ''].filter(Boolean).join(', ').slice(0, 120),
          visited_on: `${y}-${String(Math.max(1, m)).padStart(2, '0')}-01`,
          lat: Number.isFinite(place.lat) ? place.lat : null, lng: Number.isFinite(place.lng) ? place.lng : null,
          is_public: pnl.querySelector('#bhp').checked, photos: [],
        });
        window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'memory' } }));
        toast(`Added to your ${y} journey`); close();
        if (e?.id) location.hash = `#/journal/${e.id}`;
      } catch (err) { toast(err.message); b.disabled = false; }
    };
  });
}
