// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Sign-in welcome: 3 slides (adventure, 6 features, plans), swipeable.

const FEATURES = [
  ['Ask anything', 'Visas, prices, places and reviews, with sources'],
  ['Convert money', '175 countries, search by name with flags'],
  ['Your rope', 'Every trip becomes a knot in your journey'],
  ['Story chats', 'Turn a rough idea into a story before you send'],
  ['Explore Namibia', 'Regions, towns, places and local news'],
  ['Ready to Go', 'Checklist and must-knows before you leave'],
];

export function onboardSlides(C) {
  const n = (v) => Number(v || 0).toLocaleString();
  return `
  <section class="onb" aria-roledescription="carousel" aria-label="Welcome to SpeedCurrency">
    <div class="onb-track" id="onbtrack">
      <article class="onb-slide s1" aria-label="1 of 3">
        <span class="onb-knot" aria-hidden="true"></span>
        <h1>Every journey, documented.</h1>
        <p>Your trips become a living documentary: a rope of memories with photos, places and stories you can relive and share.</p>
      </article>
      <article class="onb-slide s2" aria-label="2 of 3">
        <h2>Six things in your pocket</h2>
        <ul class="onb-feats">${FEATURES.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ul>
      </article>
      <article class="onb-slide s3" aria-label="3 of 3">
        <h2>Start free. Grow when you travel more.</h2>
        <div class="onb-plans">
          <div><b>Free</b><span>N$0</span><small>3 AI questions a month, journal, converter, chats with tokens</small></div>
          <div class="hl"><b>Premium</b><span>N$${n(C.PRICE_MONTHLY)}/mo</span><small>${n(C.PREMIUM_PLANS_PER_MONTH)} questions, free messages, reviews with photos, quick news briefs</small></div>
          <div><b>Pro</b><span>N$${n(C.PRICE_PRO_MONTHLY)}/mo</span><small>${n(C.PRO_PLANS_PER_MONTH)} questions with the strongest AI, everything in Premium</small></div>
        </div>
      </article>
    </div>
    <div class="onb-nav"><div class="onb-dots" role="tablist" aria-label="Choose slide">${[1, 2, 3].map((i) => `<button type="button" role="tab" aria-label="Slide ${i}" data-go="${i - 1}"${i === 1 ? ' aria-selected="true"' : ''}></button>`).join('')}</div>
      <button type="button" class="btn small primary" id="onbnext">Next</button></div>
  </section>`;
}

export function wireSlides(root) {
  const track = root.querySelector('#onbtrack'); if (!track) return;
  const dots = [...root.querySelectorAll('[data-go]')]; const next = root.querySelector('#onbnext');
  const at = () => Math.round(track.scrollLeft / track.clientWidth);
  const mark = (i) => { dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i))); next.textContent = i === 2 ? 'Create my account' : 'Next'; };
  const sync = () => mark(at());
  const go = (i) => { mark(i); track.scrollTo({ left: i * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  dots.forEach((d) => (d.onclick = () => go(+d.dataset.go)));
  next.onclick = () => { const i = at(); if (i < 2) go(i + 1); else document.getElementById('aname')?.focus(); };
}
