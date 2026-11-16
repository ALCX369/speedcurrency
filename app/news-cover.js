// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// News covers: our own preview image for every story, drawn on the device (no downloads, no copyright).
// Each headline gets a fixed palette and dune shape from its text, a topic symbol, the source and place.

const PALETTES = [ // sky top, sky bottom, far dune, near dune, sun
  ['#F6D9A8', '#E89A5B', '#C8693A', '#8E3F22', '#FFF1D0'], // Sossusvlei dawn
  ['#2B1E3A', '#C2563A', '#7A2E25', '#3A1712', '#FFB36B'], // ember dusk
  ['#CFE0E3', '#93B5BC', '#6E8E95', '#3F5A60', '#F4F8F8'], // Skeleton Coast fog
  ['#0F0D0A', '#2A2116', '#5C4527', '#D8A657', '#F0CB8A'], // desert night gold
  ['#E7E3C4', '#B7B98A', '#7C8456', '#4C5634', '#FFF7D6'], // Etosha savanna
  ['#BFE3F0', '#5FA8C9', '#2F6F8F', '#1C4257', '#FFFFFF'], // Swakopmund ocean
];
const TOPICS = [
  [/rugby|soccer|football|cricket|match|cup|league|athlet|sport|olymp|marathon/i, '⚽'],
  [/rain|flood|weather|drought|storm|heat|wind/i, '☔'],
  [/court|police|crime|arrest|murder|theft|fraud|trial/i, '⚖'],
  [/tourism|tourist|travel|flight|airport|airline|visa|border|lodge|hotel/i, '✈'],
  [/festival|concert|show|event|music|art|carnival|expo/i, '✦'],
  [/health|hospital|clinic|covid|malaria|disease|doctor/i, '✚'],
  [/minister|president|govern|parliament|election|council|mayor|policy/i, '⌂'],
  [/bank|economy|price|fuel|business|market|trade|invest|mining|uranium|oil|gas/i, '◈'],
];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

/** Returns an HTML block: a unique illustrated cover for one news item. */
export function newsCover(item, place, esc, big = false) {
  const h = hash(item.title || item.link || '');
  const [sky1, sky2, far, near, sun] = PALETTES[h % PALETTES.length];
  const sym = (TOPICS.find(([re]) => re.test(item.title || '')) || [, '◉'])[1];
  const sx = 40 + (h >> 3) % 220, sy = 34 + (h >> 7) % 30, a = 40 + (h >> 11) % 40, b = 70 + (h >> 15) % 40;
  const id = 'nc' + h.toString(36);
  return `<div class="ncover${big ? ' big' : ''}" aria-hidden="true">
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>
      <rect width="320" height="180" fill="url(#${id})"/><circle cx="${sx}" cy="${sy}" r="${16 + (h % 10)}" fill="${sun}" opacity=".9"/>
      <path d="M0 ${a + 60} C 80 ${a + 20}, 140 ${a + 80}, 220 ${a + 40} S 320 ${a + 50}, 320 ${a + 50} V180 H0Z" fill="${far}"/>
      <path d="M0 ${b + 70} C 60 ${b + 40}, 170 ${b + 95}, 250 ${b + 55} S 320 ${b + 70}, 320 ${b + 70} V180 H0Z" fill="${near}"/></svg>
    <span class="nc-sym">${sym}</span><span class="nc-place">${esc(place || '')}</span><span class="nc-src">${esc((item.source || 'News').slice(0, 26))}</span><span class="nc-mark">SC</span></div>`;
}
