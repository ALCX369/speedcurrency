// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Postcard of the day: one hidden place in Namibia or South Africa each day, with a photo
// (Wikipedia) and one fun fact. Opening it earns XP; a new one arrives every morning.
import { safeImg } from './explore-swipe.js';

const CARDS = [ // [place, Wikipedia title, country, fact]
  ['Kolmanskop', 'Kolmanskop', 'NA', 'A diamond-rush ghost town near Lüderitz, abandoned in 1956. The desert now fills its houses with sand.'],
  ['Hoba Meteorite', 'Hoba meteorite', 'NA', 'The largest known meteorite on Earth (about 60 tonnes) still lies where it fell, near Grootfontein.'],
  ['Spitzkoppe', 'Spitzkoppe', 'NA', 'Granite peaks rising about 700 m above the plain, nicknamed the Matterhorn of Namibia.'],
  ['Twyfelfontein', 'Twyfelfontein', 'NA', 'A UNESCO World Heritage Site with more than 2,000 ancient rock engravings.'],
  ['Deadvlei', 'Deadvlei', 'NA', 'Its black camel-thorn trees died around 600 to 900 years ago and still stand in the white clay pan.'],
  ['Skeleton Coast', 'Skeleton Coast', 'NA', 'Named for the whale bones and shipwrecks scattered along its foggy shore.'],
  ['Fish River Canyon', 'Fish River Canyon', 'NA', 'One of the largest canyons in the world, about 160 km long.'],
  ['Epupa Falls', 'Epupa Falls', 'NA', 'The Kunene River tumbles through palms and baobabs on the Angolan border.'],
  ['Cape Cross', 'Cape Cross', 'NA', 'Home to one of the largest Cape fur seal colonies on the planet.'],
  ['Sandwich Harbour', 'Sandwich Harbour', 'NA', 'Where giant dunes run straight into the Atlantic Ocean.'],
  ['Quiver Tree Forest', 'Quiver Tree Forest', 'NA', 'About 250 quiver trees near Keetmanshoop; San hunters once made quivers from their branches.'],
  ['Waterberg Plateau', 'Waterberg Plateau Park', 'NA', 'A red sandstone plateau rising high above the bush, a refuge for rare rhino and antelope.'],
  ['Boulders Beach', 'Boulders Beach', 'ZA', 'Swim near a colony of African penguins in Simon’s Town.'],
  ['Blyde River Canyon', 'Blyde River Canyon', 'ZA', 'One of the largest canyons on Earth and among the greenest.'],
  ['Storms River Mouth', 'Tsitsikamma National Park', 'ZA', 'A suspension bridge swings over the river mouth in Tsitsikamma.'],
  ['Cango Caves', 'Cango Caves', 'ZA', 'Limestone caves near Oudtshoorn, the ostrich capital of the world.'],
  ['Sani Pass', 'Sani Pass', 'ZA', 'A famous 4x4 road that climbs the Drakensberg into Lesotho.'],
  ['Robben Island', 'Robben Island', 'ZA', 'Nelson Mandela was held here for 18 of his 27 years in prison.'],
  ['Augrabies Falls', 'Augrabies Falls National Park', 'ZA', 'The Orange River thunders into a deep granite gorge.'],
  ['Bourke’s Luck Potholes', 'Bourke\'s Luck Potholes', 'ZA', 'Swirling water carved deep round potholes into the rock.'],
  ['Cape Agulhas', 'Cape Agulhas', 'ZA', 'The southernmost tip of Africa, the official meeting point of the Atlantic and Indian oceans.'],
];
const today = () => new Date().toISOString().slice(0, 10);
export const todaysCard = (cc) => { const d = today(); let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0; const pool = cc && h % 4 ? CARDS.filter((x) => x[2] === cc) : CARDS; return pool[h % pool.length]; }; // 3 of 4 days from your current country

export async function mountPostcard(el, { esc, uid, cc: here }) {
  const [place, wiki, cc, fact] = todaysCard(here);
  const key = `sc_postcard_${uid || 'guest'}`; let opened = false;
  try { opened = localStorage.getItem(key) === today(); } catch { /* private mode */ }
  el.innerHTML = `<button type="button" class="pc ${opened ? 'open' : ''}" aria-expanded="${opened}">
      <span class="pc-img" id="pcimg"></span>
      <span class="pc-front"><span class="eyebrow">Postcard of the day · ${cc === 'NA' ? '🇳🇦' : '🇿🇦'}</span><b>${opened ? esc(place) : 'Tap to open today’s postcard'}</b><small>${opened ? esc(fact) : 'A new hidden place every day · +10 XP'}</small></span>
      <span class="pc-stamp" aria-hidden="true">✦</span></button>
    <div class="row wrap pc-acts" ${opened ? '' : 'hidden'}><a class="chip" href="#/town/${encodeURIComponent(place)}">📖 Guide</a><a class="chip" href="https://www.youtube.com/results?search_query=${encodeURIComponent(place + ' travel')}" target="_blank" rel="noopener noreferrer">▶ Watch</a></div>`;
  fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wiki)}&redirects=1&prop=pageimages&pithumbsize=900&format=json&origin=*`, { signal: AbortSignal.timeout(8000) })
    .then((r) => r.json()).then((j) => { const u = safeImg(Object.values(j?.query?.pages || {})[0]?.thumbnail?.source); const img = el.querySelector('#pcimg'); if (u && img) img.style.backgroundImage = `url('${u}')`; }).catch(() => {});
  const btn = el.querySelector('.pc');
  btn.onclick = () => {
    if (btn.classList.contains('open')) { location.hash = `#/town/${encodeURIComponent(place)}`; return; }
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    btn.querySelector('.pc-front b').textContent = place; btn.querySelector('.pc-front small').textContent = fact;
    el.querySelector('.pc-acts').hidden = false;
    try { localStorage.setItem(key, today()); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent('sc:pulse', { detail: { kind: 'postcard' } }));
  };
}
