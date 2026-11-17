// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Swipe deck for Explore, dating-app style: one big photo card at a time.
// Swipe right (or ♥) = yes, swipe left (or ✕) = skip, tap the card (or i) = open its window.
// Cards: { id, img, title, sub, tags[], badge, data }. Photos can arrive later through loadImg(card).

/** Makes a photo address safe for CSS url(): only https, blob or data images, with risky characters encoded. */
export const safeImg = (u) => {
  u = String(u || '');
  if (!/^(https:|blob:|data:image\/)/i.test(u)) return '';
  return u.replace(/["'()\\\s<>]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
};

export function mountSwipe(el, { cards, esc, onYes, onNo, onOpen, loadImg, empty, yesLabel = 'Save', noLabel = 'Skip' }) {
  let i = 0;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.innerHTML = `<div class="sw-stack" aria-live="polite"></div>
    <div class="sw-btns">
      <button type="button" class="sw-b no" aria-label="${esc(noLabel)}"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <button type="button" class="sw-b info" aria-label="Open details"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg></button>
      <button type="button" class="sw-b yes" aria-label="${esc(yesLabel)}"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21Z"/></svg></button>
    </div>`;
  const stack = el.querySelector('.sw-stack');
  stack.addEventListener('pointerdown', (e) => { if (e.target.closest('.sw-pg')) e.stopPropagation(); }, true);
  stack.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg]'); if (!b) return; e.stopPropagation();
    const node = b.closest('.sw-card'); const c = cards[+node.dataset.k]; if (!c?.imgs?.length) return;
    c.pi = (c.pi + +b.dataset.pg + c.imgs.length) % c.imgs.length; c.img = c.imgs[c.pi];
    node.style.backgroundImage = `url('${esc(c.img)}')`;
    node.querySelectorAll('.sw-dots i').forEach((d, n) => d.classList.toggle('on', n === c.pi));
  }, true);

  // several photos per card: dots on top, tap ‹ › to flip (the buttons never start a swipe)
  const pgHtml = (c) => ((c.imgs || []).length > 1 ? `<div class="sw-dots" aria-hidden="true">${c.imgs.map((_, n) => `<i class="${n === (c.pi || 0) ? 'on' : ''}"></i>`).join('')}</div>`
    + `<button type="button" class="sw-pg prev" data-pg="-1" aria-label="Previous photo">‹</button><button type="button" class="sw-pg next" data-pg="1" aria-label="Next photo">›</button>` : '');
  const setImgs = (c, u) => { c.imgs = (Array.isArray(u) ? u : [u]).map(safeImg).filter(Boolean).slice(0, 8); c.pi = 0; c.img = c.imgs[0] || ''; };
  const cardHtml = (c, k) => `<article class="sw-card" data-k="${k}" style="${safeImg(c.img) ? `background-image:url('${esc(safeImg(c.img))}')` : ''}" tabindex="${k === i ? 0 : -1}" aria-label="${esc(c.title)}">
      ${c.img ? '' : `<span class="sw-ph" aria-hidden="true">${esc(c.icon || '✦')}</span>`}
      ${c.badge ? `<span class="sw-badge">${esc(c.badge)}</span>` : ''}${pgHtml(c)}
      <span class="sw-stamp yes" aria-hidden="true">${esc(yesLabel)}</span><span class="sw-stamp no" aria-hidden="true">${esc(noLabel)}</span>
      <div class="sw-info"><h2>${esc(c.title)}</h2>${c.sub ? `<p>${esc(c.sub)}</p>` : ''}
        ${c.tags?.length ? `<div class="sw-tags">${c.tags.filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>
    </article>`;

  const paint = () => {
    const left = cards.slice(i, i + 3);
    if (!left.length) { stack.innerHTML = `<div class="sw-empty">${empty || 'You have seen them all.'}</div>`; el.querySelector('.sw-btns').hidden = true; return; }
    el.querySelector('.sw-btns').hidden = false;
    stack.innerHTML = left.map((c, n) => cardHtml(c, i + n)).reverse().join('');
    stack.querySelectorAll('.sw-card').forEach((c) => { const n = +c.dataset.k - i; c.style.setProperty('--n', n); });
    // fetch photos for the top cards that don't have one yet
    left.forEach((c, n) => { if (!c.img && !c.tried && loadImg) { c.tried = true; loadImg(c).then((u) => { setImgs(c, u); if (c.img) { const node = stack.querySelector(`[data-k="${i + n}"]`); if (node) { node.style.backgroundImage = `url('${c.img}')`; node.querySelector('.sw-ph')?.remove(); node.querySelector('.sw-info').insertAdjacentHTML('beforebegin', pgHtml(c)); } } }).catch(() => {}); } });
    const top = stack.querySelector(`[data-k="${i}"]`); drag(top);
    if (focusNext) { focusNext = false; top?.focus({ preventScroll: true }); }
  };
  let focusNext = false;

  const go = (dir) => {
    const c = cards[i]; const node = stack.querySelector(`[data-k="${i}"]`); if (!c || !node) return;
    node.classList.add('gone'); node.style.transition = still ? 'none' : 'transform .35s ease-out, opacity .35s';
    node.style.transform = `translate(${dir * 140}%, -4%) rotate(${dir * 24}deg)`; node.style.opacity = '0';
    focusNext = el.contains(document.activeElement); i++; setTimeout(paint, still ? 0 : 260);
    if (dir > 0) onYes?.(c); else onNo?.(c);
  };

  function drag(node) {
    if (!node) return;
    let x0 = null, y0 = 0, dx = 0, moved = false, vertical = false;
    node.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; vertical = false; node.setPointerCapture(e.pointerId); node.style.transition = 'none'; });
    node.addEventListener('pointermove', (e) => {
      if (x0 == null || vertical) return; dx = e.clientX - x0; const dy = e.clientY - y0;
      if (!moved && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { vertical = true; return snap(); } // a scroll, not a swipe
      if (Math.abs(dx) > 6) moved = true;
      node.style.transform = `translate(${dx}px, 0) rotate(${dx / 18}deg)`;
      node.style.setProperty('--yes', Math.max(0, Math.min(1, dx / 110))); node.style.setProperty('--no', Math.max(0, Math.min(1, -dx / 110)));
    });
    const snap = () => { node.style.transition = 'transform .3s cubic-bezier(.2,1.4,.4,1)'; node.style.transform = ''; node.style.setProperty('--yes', 0); node.style.setProperty('--no', 0); };
    node.addEventListener('pointerup', () => {
      if (x0 == null) return; x0 = null;
      if (vertical) return;
      if (Math.abs(dx) > 100) return go(Math.sign(dx));
      snap(); if (!moved) onOpen?.(cards[i]);
    });
    node.addEventListener('pointercancel', () => { x0 = null; snap(); }); // cancelled: never opens or swipes
    node.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'Enter') onOpen?.(cards[i]); });
  }

  el.querySelector('.sw-b.no').onclick = () => go(-1);
  el.querySelector('.sw-b.yes').onclick = () => go(1);
  el.querySelector('.sw-b.info').onclick = () => cards[i] && onOpen?.(cards[i]);
  paint();
  return { set(next) { cards = next; i = 0; paint(); } };
}
