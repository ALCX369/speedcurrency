// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Nami's own knowledge, so most answers come from inside the app:
//   1) FAQ: travel basics for Namibia + South Africa (checked 16 Nov 2026, sources linked) and how the app works.
//   2) Towns: a town's guide listings (Wikivoyage) and fuel stops (OpenStreetMap), the same data as the Town Guide.
//   3) Anything current (news, prices today, "this week") goes to the live assistant with web search instead.
import { STAMP_TOWNS } from './journey-studio.js';
import { overpass, CATS } from './explore-map.js';
import { wikivoyage } from './town-guide.js';

export const CHECKED = '16 Nov 2026';
const FAQ = [ // [keywords, answer (markdown), source label, source url]
  [/namibian dollar|(namibia|n\$|nad).*(rand|zar|south africa)|(rand|zar).*(namibia|n\$|nad)|currency|which money|cash|atm/i,
    'The **Namibian dollar (N$)** is pegged 1:1 to the **South African rand**. Rand works in Namibia, but N$ is **not** accepted in South Africa, so spend or swap it before you cross. Cards work in towns and malls; carry cash for small shops and rural fuel stops.', 'Travel tips', 'https://www.onthegotours.com/au/Namibia/Guides/Travel-Tips-and-Useful-Info'],
  [/visa|permit to enter|entry rule|e-?visa|immigration/i,
    'Since April 2025 many nationalities need a **visa for Namibia**: get it online (e-Visa) or on arrival. Fees in 2025: **N$1,600** for most non-African visitors, **N$1,200** for African visitors (a rise to N$2,000 at the border was reported but isn’t confirmed). Check your country on the official portal before you fly. For **South Africa**, many passports get 30–90 days visa-free; check Home Affairs.', 'Namibian Embassy fact sheet', 'https://namibiaembassyusa.org/wp-content/uploads/2025/03/Fact-Sheet-Visa-Requirements-to-Namibia_18.03.25.pdf'],
  [/passport/i,
    'Your passport should be valid for **6 months after you arrive**, with **2–3 blank pages**. Keep a photo of it on your phone and a copy with family. Need a Namibian passport? Apply at Home Affairs (MHAISS) or start online.', 'MHAISS e-services', 'https://eservices.mhaiss.gov.na'],
  [/drive|driving|speed|licen[cs]e|road rule|which side/i,
    'Both countries drive on the **left**. Namibia: about **120 km/h** on tar outside towns, **60** in town, and keep to **80 km/h on gravel** (most rollovers happen there). South Africa: **60** town, **100** rural, **120** freeway. Carry your licence; get an international permit if it isn’t in English.', 'Travel tips', 'https://www.onthegotours.com/au/Namibia/Guides/Travel-Tips-and-Useful-Info'],
  [/night|dark|after sunset|animals on the road/i,
    'Try **not to drive at night**: roads are unlit and animals (kudu, cattle, donkeys) wander onto them. Plan long drives to arrive before sunset.', 'Canada travel advice', 'https://travel.gc.ca/destinations/south-africa'],
  [/fuel|petrol|diesel|filling|garage|gas station/i,
    'Fuel stations are **full service**: an attendant fills up and often cleans the windscreen; a small tip is normal. In Namibia **fill up whenever you can**, towns can be 200+ km apart. Ask me “fuel in Ondangwa” (any town) for the closest stations.', '', ''],
  [/safe|crime|danger|rob|hijack|security/i,
    'Namibia is calm by regional standards; use normal city sense in Windhoek after dark. South Africa: governments advise a **high degree of caution**, not avoidance. Keep doors locked in town, don’t show valuables, and use the **M3/N2** to and from Cape Town airport (not the R300). Gqeberha to Addo: **N2 via Colchester**, not the R335.', 'Canada travel advice', 'https://travel.gc.ca/destinations/south-africa'],
  [/emergency|police|ambulance|accident|hospital number|help number/i,
    '**Namibia:** police **10111**. **South Africa:** police **10111**, ambulance **10177**, from a mobile **112**. Save them before you drive.', '', ''],
  [/\bsim\b|airtime|mobile data|e-?sim|network coverage|wi-?fi/i,
    '**Namibia:** MTC and TN Mobile. **South Africa:** Vodacom and MTN have the best coverage (Cell C and Telkom too). Buy a SIM at the airport; you’ll need your **passport** to register it (RICA in South Africa). eSIMs work but local SIMs are usually cheaper for longer stays.', 'Travel tips', 'https://biggestleaftravel.com/destinations/southern-africa/south-africa/south-africa-travel-advice'],
  [/plug|socket|adapter|adaptor|voltage|charger/i,
    'Both use **220–230 V**. Most sockets take the big **three round-pin plug (Type M)**; South Africa also has the smaller Type N. Universal adapters often don’t fit, so buy one at a supermarket when you land.', 'Plug guide', 'https://atcnews.org/travelcomments-com-southern-africa-plug-types-explained-travel-adapter-guide-for-south-africa-namibia-zimbabwe-more/'],
  [/tipping|should i tip|how much (do i |to )?tip|gratuity/i,
    'Tip **10–15%** in restaurants in both countries. Lodges often have a staff tip box. Car guards and fuel attendants get a few coins (N$/R5–10).', 'Travel tips', 'https://www.porini.com/south-africa-travel-information/'],
  [/malaria|mosquito/i,
    '**Namibia:** malaria risk in the north (Kavango, Kunene, Ohangwena, Omusati, **Oshana (Ondangwa)**, Oshikoto, Otjozondjupa, Zambezi), mostly in the rainy season; **no risk in Windhoek**. **South Africa:** most of the country is malaria-free (Cape Town, Garden Route); ask a doctor if you’re going to **Kruger** or northern KwaZulu-Natal, ideally 6–8 weeks before.', 'Travel tips', 'https://www.onthegotours.com/au/Namibia/Guides/Travel-Tips-and-Useful-Info'],
  [/water|drink.*tap|tap water/i,
    'Tap water in the main towns is treated and most people drink it. In remote areas and lodges, ask, or stick to bottled or filtered water.', '', ''],
  [/best time|when to (go|visit)|season|weather in (summer|winter)|rain(y)? season/i,
    '**Namibia:** May–October is dry and best for wildlife at waterholes; November–April brings heat and summer rains in the north (green, baby animals, fewer people). The coast (Swakopmund) is cool all year. **South Africa:** Cape Town is best in dry summer (Dec–Feb); Kruger is best in dry winter (May–Sep).', '', ''],
  [/etosha|park gate|game drive|safari rule/i,
    'Etosha gates open at **sunrise** and close at **sunset**; be inside a camp before the gate closes. Stay **in your car** except at marked spots, keep to 60 km/h, and pay the park fee at the gate. Waterholes near Okaukuejo, Halali and Namutoni are great at dusk.', '', ''],
  [/border|cross.*(namibia|south africa)|noordoewer|ariamsvlei|vioolsdrif/i,
    'Main road crossings: **Noordoewer / Vioolsdrif** (B1 / N7, toward Cape Town) and **Ariamsvlei / Nakop** (toward Upington). Bring your passport; hire cars need a **letter of permission** from the rental company. Check opening hours before you drive.', '', ''],
  [/rental|hire car|car hire|4x4/i,
    'Book early for December. For gravel roads a high-clearance car or 4x4 is worth it; check the tyre cover and the number of spare wheels (two is wise in Namibia). Taking it across a border needs the rental company’s **letter and fee**.', '', ''],
  // the app
  [/stamp|collect|passport book/i, 'Add a memory in a town and its **gold stamp** appears in your profile’s **Stamps** tab. There are 56 towns, plus ★ rare stamps for parks like Sossusvlei and Kruger.', '', ''],
  [/postcard/i, 'A new **Postcard of the day** waits on Home every morning: one hidden place, a photo and a fun fact. Opening it gives **+10 XP**.', '', ''],
  [/xp|level|streak|quest|badge/i, 'You earn **XP** for exploring towns, opening places, adding memories and converting money. Open the app daily to grow your 🔥 streak. Levels go from Wanderer to **Namib Legend**.', '', ''],
  [/wrapped|recap/i, 'Open your **Profile** and tap **✦ My Wrapped** for a story of your month: memories, places, km and stamps. You can share it.', '', ''],
  [/premium|subscription|upgrade|how (do i|to) pay|n\$149/i, '**Premium** is **N$149/month** or N$1,399/year: full town guides, more Nami questions, news briefs and the Ocean Blue and Rose Quartz themes. Pay by FNB EFT from **Account → Plans**.', '', ''],
  [/business account|my business|lodge owner|list my/i, 'Turn on **Business account** in Settings (⚙ on your profile): you get a category badge, Book / Call / WhatsApp / Directions buttons and view counts.', '', ''],
  [/heads.?up|warn other|road report/i, 'Post a **heads-up** (tip, warning, road or safety) on your profile or in any Town Guide. Others see it; you can edit or delete yours.', '', ''],
  [/theme|dark mode|change (the )?colou?r/i, 'Tap **🎨 Theme** on your profile: Dune Gold, Ember Sport, and (Premium) Ocean Blue and Rose Quartz.', '', ''],
  [/delete (my )?account|my data|privacy/i, 'Go to **Account → Settings**: “Download my data” and “Delete account” are there. Read our [Privacy Policy](../privacy.html).', '', ''],
];
const LATEST = /news|today|tonight|this (week|weekend|month)|right now|latest|current|open now|price of|cost now|2026|2027|event|concert|festival|strike|load ?shedding/i;
const TOWN_ASK = [[/eat|food|restaurant|lunch|dinner|breakfast|cafe|coffee/i, 'eat', 'to eat'], [/stay|sleep|hotel|lodge|guest ?house|camp|b&b|accommodation/i, 'sleep', 'to stay'],
  [/see|visit|do\b|things|attraction|museum|sight|activit|fun|tour|tips?\b/i, 'see', 'to see and do'], [/bar|drink|night ?life|club|pub/i, 'drink', 'for a drink'], [/shop|mall|market|craft|buy/i, 'buy', 'to shop'],
  [/fuel|petrol|diesel|garage|filling/i, 'fuel', 'for fuel']];
const TOWNS = [...STAMP_TOWNS.map((t) => t[0]), 'Port Elizabeth', 'Ongwediva', 'Oshikango', 'Eenhana', 'Ruacana'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cache = new Map();

export const townIn = (text) => TOWNS.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(text)) || null;

/** Returns { text, src, url, town } from the app's own knowledge, or null to ask the live assistant. */
export async function answerLocal(q, lastTown) {
  if (LATEST.test(q)) return null; // current info: let the assistant search the web
  const named = townIn(q); const town = named === 'Port Elizabeth' ? 'Gqeberha' : named || (/\b(there|that town|it)\b/i.test(q) ? lastTown : null);
  const ask = TOWN_ASK.find(([re]) => re.test(q));
  if (town && ask) {
    const [, key, what] = ask;
    try {
      if (key === 'fuel') {
        const geo = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(town)}&limit=1&lang=en&bbox=11.5,-35.0,33.0,-16.9`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
        const f = geo.features?.[0]; if (!f) return null;
        const list = await overpass({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }, CATS.find((c) => c[0] === 'fuel'));
        if (!list.length) return null;
        return { town, src: 'OpenStreetMap', text: `Closest fuel in **${esc(town)}**:\n${list.slice(0, 4).map((p) => `- **${esc(p.name)}**, ${p.dist < 1 ? Math.round(p.dist * 1000) + ' m' : p.dist.toFixed(1) + ' km'} from the centre`).join('\n')}\n\nFill up before long stretches; the next town can be far.` };
      }
      if (!cache.has(town)) cache.set(town, await wikivoyage(town).catch(() => null));
      const g = cache.get(town); const types = key === 'see' ? ['see', 'do'] : [key];
      const arr = (g?.listings || []).filter((x) => types.includes(x.type)).slice(0, 4);
      if (!arr.length) return null;
      return { town, src: 'Wikivoyage', url: g.url, text: `Good picks ${what} in **${esc(town)}**:\n${arr.map((x) => `- **${esc(x.name)}**${x.text ? `: ${esc(x.text.split('. ')[0].slice(0, 110))}` : ''}${x.price ? ` (${esc(x.price.slice(0, 30))})` : ''}`).join('\n')}\n\nThe full list is in the ${esc(town)} guide.` };
    } catch { return null; }
  }
  const hit = FAQ.find(([re]) => re.test(q));
  if (hit) return { town, text: hit[1], src: hit[2] ? `${hit[2]} · checked ${CHECKED}` : `SpeedCurrency · checked ${CHECKED}`, url: hit[3] };
  return null;
}
