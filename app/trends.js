// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// What's popping: last summer's hot spots, next summer's picks, safety, and the economy watch
// for Namibia + South Africa. Facts are dated and sourced (checked 16 Nov 2026); update each season.
import { openTownPreview } from './town-finder.js';

const CHECKED = '16 Nov 2026';
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

const HOT = [ // last summer, Dec 2025 - Feb 2026
  { t: 'Cape Town', cc: 'ZA', why: 'Top domestic festive pick: 54% of South Africans planned to travel, Cape Town led.', src: 'iol' },
  { t: 'Durban', cc: 'ZA', why: 'Growing coastal favourite next to Cape Town in December 2025.', src: 'iol2' },
  { t: 'Plettenberg Bay', cc: 'ZA', why: 'Garden Route seaside town that books out first, with Knysna and Hermanus.', src: 'getaway' },
  { t: 'Stellenbosch', cc: 'ZA', why: 'Winelands: Stellenbosch and Franschhoek fill early every festive season.', src: 'getaway' },
  { t: 'Swakopmund', cc: 'NA', why: 'Namibia’s December coast: cool sea air when the interior is hot.', src: '' },
  { t: 'Sossusvlei', cc: 'NA', why: 'Big Daddy dune and Deadvlei: most visitors to Namibia come for these red dunes. Go at sunrise, before the heat.', src: '' },
];
const NEXT = [ // next summer, Dec 2026 - Feb 2027
  { t: 'Gqeberha', cc: 'ZA', why: 'Port Elizabeth: beaches, Boardwalk and Donkin Reserve, plus Addo elephants 1 hour away. South End heritage precinct is being upgraded.', tip: 'Drive to Addo on the N2 via Colchester, not the R335.', src: 'nomad' },
  { t: 'Knysna', cc: 'ZA', why: 'Garden Route lagoon town. Seaside towns book out fastest, so book early.', tip: 'Avoid driving rural roads at night.', src: 'getaway' },
  { t: 'Hermanus', cc: 'ZA', why: 'Cliff paths and sea views 90 minutes from Cape Town.', tip: 'Book stays before October for December.', src: 'getaway' },
  { t: 'Walvis Bay', cc: 'NA', why: 'Flamingos, kayaking with seals, Sandwich Harbour dunes, next to Swakopmund.', tip: 'Fill up in town: fuel stops are far apart.', src: '' },
  { t: 'Etosha National Park', cc: 'NA', why: 'Rainy season: green park, baby animals, fewer crowds.', tip: 'Gravel roads get slippery after rain; drive slowly.', src: '' },
  { t: 'Ondangwa', cc: 'NA', why: 'The north’s busy hub: markets, malls, Olukonda museum nearby, the gateway to Ruacana and Etosha’s King Nehale gate.', tip: 'Pair with Oshakati and Ruacana falls (after good rains).', src: '' },
];
const SAFETY = {
  ZA: ['Advice from Canada (5 Nov 2026), the US, UK and Australia: travel with a high degree of caution, not avoidance.',
    'Cape Town airport: use the M3 and N2, not the R300.',
    'Gqeberha to Addo: N2 via Colchester, not the R335 via Motherwell.',
    'Don’t drive rural roads at night; keep car doors locked in town.',
    'Power cuts (load shedding) can still happen: carry a power bank.'],
  NA: ['Distances are long: fill up whenever you can and carry water.',
    'Don’t drive at night: animals on the road are the biggest danger.',
    'Gravel roads: keep under 80 km/h; most rollovers happen on gravel.',
    'Emergency: 10111 police.'],
};
const ECONOMY = [
  { h: 'South Africa tourism up 12.3%', p: '5.58 million international tourists in Jan–Jun 2026, up 12.3% (Department of Tourism figures, via trade press).', src: 'ttw' },
  { h: 'Hyphen green hydrogen: decision moved to end-2027', p: 'The US$10bn Namibian project (24% state stake) delayed its final investment decision to the end of 2027. AfDB added a ~N$100m grant in Sept 2026. Target: about N$54bn spent with Namibian businesses.', src: 'namibian' },
  { h: 'Orange Basin oil: not decided yet', p: 'TotalEnergies’ Venus is technically ready for a final decision; fiscal terms are still being negotiated. Equinor bought 17.4% of PEL 90 in Aug 2026. First oil is talked about for ~2029–2030 (unconfirmed).', src: 'aew' },
];
const SRC = {
  iol: ['IOL: Dezemba travel trends', 'https://iol.co.za/travel/2026-10-20-dezemba-travel-trends-how-to-save-on-festive-season-holidays/'],
  iol2: ['IOL: coastal getaways data', 'https://iol.co.za/travel/south-africa/2025-02-14-south-africans-flock-to-coastal-getaways-top-holiday-destinations-revealed-in-travel-data/'],
  getaway: ['Getaway: early booker’s guide', 'https://www.getaway.co.za/travel/travel-ideas/the-early-bookers-guide-to-the-festive-season/'],
  nomad: ['Gqeberha South End guide 2026', 'https://www.nomadlawyer.org/gqeberha-south-end-st-peters-heritage-tourism-guide-2026'],
  ttw: ['Travel And Tour World', 'https://www.travelandtourworld.com/news/article/2ou66vql16ei/'],
  namibian: ['The Namibian: Hyphen delay', 'https://www.namibian.com.na/hyphen-delay-raises-questions-on-promises-made/'],
  aew: ['African Energy Week: Orange Basin', 'https://aecweek.com/news/namibias-orange-basin-moves-toward-first-oil-aew-2026'],
  canada: ['Canada travel advice: South Africa', 'https://travel.gc.ca/destinations/south-africa'],
};

export async function Trends(main, deps) {
  const { esc } = deps;
  const { here } = await import('./here.js'); const cc = here().cc;
  if (cc) for (const L of [HOT, NEXT]) L.sort((a, b) => (b.cc === cc) - (a.cc === cc)); // your country first
  const src = (k) => (SRC[k] ? `<a class="tr-src" href="${esc(SRC[k][1])}" target="_blank" rel="noopener noreferrer">Source: ${esc(SRC[k][0])}</a>` : '<span class="tr-src">Local favourite</span>');
  const card = (x, i, list) => `<article class="tr-card"><span class="eyebrow">${x.cc === 'NA' ? '🇳🇦 Namibia' : '🇿🇦 South Africa'}</span><h3>${esc(x.t)}</h3><p>${esc(x.why)}</p>${x.tip ? `<p class="tr-tip">💡 ${esc(x.tip)}</p>` : ''}
      <div class="row wrap tr-btns"><button type="button" class="chip" data-list="${list}" data-i="${i}">📖 Town guide</button><a class="chip" href="${esc(yt(x.t + ' travel vlog'))}" target="_blank" rel="noopener noreferrer">▶ Watch</a></div>${src(x.src)}</article>`;
  main.innerHTML = `
    <header class="tr-head"><span class="eyebrow">What’s popping · checked ${CHECKED}</span><h1>Hot spots & <em>next summer</em></h1>
      <p class="muted">Where people went last summer, where to go this December, how to stay safe, and the big money moving in Namibia and South Africa.</p></header>
    <h2>🔥 Last summer’s hot spots <small class="muted">Dec 2025 – Feb 2026</small></h2>
    <div class="tr-rail">${HOT.map((x, i) => card(x, i, 'hot')).join('')}</div>
    <h2>☀️ Best for next summer <small class="muted">Dec 2026 – Feb 2027</small></h2>
    <div class="tr-rail">${NEXT.map((x, i) => card(x, i, 'next')).join('')}</div>
    <h2>🛡 Travel safe</h2>
    <div class="tr-safe">${Object.entries(SAFETY).map(([cc, tips]) => `<div class="tr-safe-col"><b>${cc === 'NA' ? '🇳🇦 Namibia' : '🇿🇦 South Africa'}</b><ul>${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}
      <a class="tr-src" href="${esc(SRC.canada[1])}" target="_blank" rel="noopener noreferrer">Source: ${esc(SRC.canada[0])} · always check your own government’s advice</a></div>
    <h2>📈 Economy & big investments</h2>
    <div class="tr-econ">${ECONOMY.map((x) => `<article class="tr-card dark"><h3>${esc(x.h)}</h3><p>${esc(x.p)}</p>${src(x.src)}</article>`).join('')}</div>
    <p class="small muted">News, not financial advice. Figures from the linked sources, checked ${CHECKED}. Some trade-press numbers vary between sources.</p>`;
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-list]'); if (!b) return;
    const x = (b.dataset.list === 'hot' ? HOT : NEXT)[+b.dataset.i];
    openTownPreview({ name: x.t }, deps);
  });
}

/** Small teaser for Home. */
export const trendsTeaser = (esc) => `<a class="tr-teaser card reveal" href="#/trends"><span class="eyebrow">What’s popping</span><b>Hot spots, next summer & the economy</b><span class="small">${esc(NEXT.slice(0, 3).map((x) => x.t).join(' · '))} →</span></a>`;
