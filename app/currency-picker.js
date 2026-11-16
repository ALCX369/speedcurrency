// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Country search for the converter: type a country ("Namibia"), a currency ("dollar") or a code ("NAD"),
// pick from a list with flags. Flags are SVGs from the flag-icons package (they show on Windows too,
// where flag emoji do not). The input keeps working with a plain 3-letter code as before.

const FLAG_CDN = 'https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/';

// ISO country code -> currency it uses (2026). EU = the euro area as one entry.
const MAP = ('EU:EUR AD:EUR AE:AED AF:AFN AG:XCD AL:ALL AM:AMD AO:AOA AR:ARS AT:EUR AU:AUD AW:AWG AZ:AZN BA:BAM BB:BBD '
  + 'BD:BDT BE:EUR BF:XOF BG:EUR BH:BHD BI:BIF BJ:XOF BM:BMD BN:BND BO:BOB BR:BRL BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD '
  + 'CA:CAD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CY:EUR CZ:CZK DE:EUR '
  + 'DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FR:EUR GA:XAF GB:GBP '
  + 'GD:XCD GE:GEL GH:GHS GM:GMD GN:GNF GQ:XAF GR:EUR GT:GTQ GW:XOF GY:GYD HK:HKD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR '
  + 'IE:EUR IL:ILS IN:INR IQ:IQD IR:IRR IS:ISK IT:EUR JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KM:KMF KN:XCD KR:KRW '
  + 'KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR '
  + 'MD:MDL ME:EUR MG:MGA MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MR:MRU MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN '
  + 'NA:NAD NE:XOF NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NZ:NZD OM:OMR PA:PAB PE:PEN PG:PGK PH:PHP PK:PKR PL:PLN PR:USD '
  + 'PT:EUR PY:PYG QA:QAR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SI:EUR SK:EUR SL:SLE '
  + 'SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SZ:SZL TD:XAF TG:XOF TH:THB TJ:TJS TL:USD TM:TMT TN:TND TO:TOP TR:TRY '
  + 'TT:TTD TW:TWD TZ:TZS UA:UAH UG:UGX US:USD UY:UYU UZ:UZS VC:XCD VE:VES VN:VND VU:VUV WS:WST XK:EUR YE:YER ZA:ZAR '
  + 'ZM:ZMW ZW:USD').split(' ').map((p) => p.split(':'));

const regionName = (() => { try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return (c) => (c === 'EU' ? 'Euro area' : c === 'XK' ? 'Kosovo' : d.of(c) || c); } catch { return (c) => c; } })();
const currencyName = (() => { try { const d = new Intl.DisplayNames(['en'], { type: 'currency' }); return (c) => d.of(c) || c; } catch { return (c) => c; } })();

export const COUNTRIES = MAP.map(([cc, cur]) => ({ cc, cur, name: regionName(cc), curName: currencyName(cur) }))
  .sort((a, b) => (a.cc === 'EU' ? -1 : b.cc === 'EU' ? 1 : a.name.localeCompare(b.name)));

const flag = (cc, esc) => `<img class="cp-flag" src="${FLAG_CDN}${esc(cc.toLowerCase())}.svg" alt="" width="24" height="18" loading="lazy">`;
const label = (c) => `${c.name} · ${c.cur}`;

/** The 3-letter code an input stands for: its picked country, or a typed code. */
export function codeOf(input) {
  if (input.dataset.code && input.value === input.dataset.label) return input.dataset.code;
  const v = input.value.trim();
  if (/^[a-z]{3}$/i.test(v)) return v.toUpperCase();
  const hit = COUNTRIES.find((c) => c.name.toLowerCase() === v.toLowerCase());
  return hit ? hit.cur : '';
}

/** Best country to show for a currency code (the user's home country first). */
export function countryFor(code, homeCc) {
  const c = String(code || '').toUpperCase();
  return COUNTRIES.find((x) => x.cc === homeCc && x.cur === c) || COUNTRIES.find((x) => x.cur === c && x.cc === c.slice(0, 2))
    || COUNTRIES.find((x) => x.cur === c) || null;
}

function search(q, hasRate) {
  const s = q.trim().toLowerCase();
  const ok = (c) => !hasRate || hasRate(c.cur);
  // Empty box: the whole list, A-Z, to scroll through.
  if (!s) return COUNTRIES.filter(ok);
  const score = (c) => {
    const n = c.name.toLowerCase();
    if (c.cur.toLowerCase() === s || c.cc.toLowerCase() === s) return 0;
    if (n.startsWith(s)) return 1;
    if (n.split(/[\s-]+/).some((w) => w.startsWith(s))) return 2; // "africa" finds South Africa
    if (n.includes(s)) return 3;
    if (c.curName.toLowerCase().includes(s)) return 4;
    return 9;
  };
  return COUNTRIES.filter(ok).map((c) => [score(c), c]).filter(([sc]) => sc < 9)
    // ties: the currency's home country first (US for USD, AU for AUD), then A-Z
    .sort((a, b) => a[0] - b[0] || (b[1].cur.startsWith(b[1].cc) - a[1].cur.startsWith(a[1].cc)) || a[1].name.localeCompare(b[1].name))
    .map(([, c]) => c);
}

/**
 * Turns a text input into a country/currency search box with a flag.
 * opts: { esc, initial (currency code), homeCc, hasRate(code) -> bool, onPick() }
 */
export function attachCurrencyPicker(input, opts) {
  const { esc, onPick } = opts;
  const wrap = document.createElement('div'); wrap.className = 'cp';
  input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
  const flagBox = document.createElement('span'); flagBox.className = 'cp-lead'; flagBox.setAttribute('aria-hidden', 'true');
  wrap.insertBefore(flagBox, input);
  const list = document.createElement('ul'); list.className = 'cp-list'; list.id = input.id + '-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
  wrap.appendChild(list);
  input.removeAttribute('maxlength'); input.removeAttribute('list'); input.setAttribute('autocapitalize', 'words');
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false'); input.setAttribute('autocomplete', 'off');
  input.placeholder = 'Country or currency';

  let items = []; let active = -1;
  const set = (c) => {
    input.dataset.code = c.cur; input.dataset.label = label(c); input.value = label(c);
    flagBox.innerHTML = flag(c.cc, esc);
  };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const paint = () => {
    list.innerHTML = items.length
      ? items.map((c, i) => `<li role="option" id="${list.id}-${i}" aria-selected="${i === active}" data-i="${i}">${flag(c.cc, esc)}<span><b>${esc(c.name)}</b><small>${esc(c.curName)} · ${esc(c.cur)}</small></span></li>`).join('')
      : '<li class="cp-none" aria-disabled="true">No match. Try a country or a code like NAD.</li>';
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (active >= 0) { input.setAttribute('aria-activedescendant', `${list.id}-${active}`); list.children[active]?.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };
  const open = () => { items = search(input.value === input.dataset.label ? '' : input.value, opts.hasRate); active = items.length ? 0 : -1; paint(); };
  const pick = (i) => { const c = items[i]; if (!c) return; set(c); close(); onPick?.(); };

  input.addEventListener('focus', () => { input.select(); open(); });
  input.addEventListener('input', () => { delete input.dataset.label; flagBox.innerHTML = ''; open(); });
  input.addEventListener('keydown', (e) => {
    if (list.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { open(); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, items.length - 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); paint(); e.preventDefault(); }
    else if (e.key === 'Enter' && !list.hidden && active >= 0) { pick(active); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  // pointerdown so the pick lands before the input loses focus
  list.addEventListener('pointerdown', (e) => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pick(Number(li.dataset.i)); } });
  input.addEventListener('blur', () => setTimeout(() => {
    close();
    if (input.value !== input.dataset.label) { const c = countryFor(codeOf(input)); if (c) { set(c); onPick?.(); } }
  }, 120));

  const start = countryFor(opts.initial, opts.homeCc);
  if (start) set(start);
  return { set: (code) => { const c = countryFor(code, opts.homeCc); if (c) set(c); }, code: () => codeOf(input) };
}
