// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Business accounts: lodges, restaurants, tour guides, shops and transport get a business profile:
// category badge, contact buttons (Call, WhatsApp, Directions, Website, Book) and simple insights.
// Columns + functions: migration 015. Until it runs, everything here stays hidden.
export const CATS = { lodge: '🛏 Lodge & stay', restaurant: '🍽 Restaurant & café', tour: '🧭 Tours & activities', shop: '🛍 Shop', transport: '🚐 Transport & car hire', guide: '🎒 Local guide', other: '✦ Business' };
const digits = (p) => String(p || '').replace(/[^\d+]/g, '');
const https = (u) => (/^https:\/\//.test(u || '') ? u : '');

/** Contact strip shown on a business profile. */
export function businessBlock(a, esc, gmaps) {
  if (!a || a.account_type !== 'business') return '';
  const wa = digits(a.biz_whatsapp).replace(/^\+/, '');
  const btn = (href, label, ext) => `<a class="biz-btn" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  return `<section class="biz">
    <div class="biz-top"><span class="biz-badge">${esc(CATS[a.biz_category] || CATS.other)}</span>${a.biz_town ? `<small>📍 ${esc(a.biz_town)}</small>` : ''}${a.biz_hours ? `<small>🕒 ${esc(a.biz_hours)}</small>` : ''}</div>
    <div class="biz-btns">
      ${https(a.biz_booking) ? btn(a.biz_booking, '📅 Book', true) : ''}
      ${a.biz_phone ? btn(`tel:${digits(a.biz_phone)}`, '📞 Call') : ''}
      ${wa ? btn(`https://wa.me/${wa}`, '💬 WhatsApp', true) : ''}
      ${a.biz_town ? btn(gmaps(`${a.display_name || ''} ${a.biz_town}`), '🧭 Directions', true) : ''}
      ${https(a.biz_website) ? btn(a.biz_website, '🌐 Website', true) : ''}
      ${a.biz_email ? btn(`mailto:${a.biz_email}`, '✉️ Email') : ''}
    </div></section>`;
}

/** Owner-only insights: profile views in the last 7 / 30 days. */
export async function businessInsights(el, sb) {
  if (!el) return;
  const { data, error } = await sb.rpc('my_profile_views');
  if (error || !data?.[0]) { el.remove(); return; }
  const v = data[0];
  el.innerHTML = `<div class="biz-ins"><span><b>${v.last_7}</b>views · 7 days</span><span><b>${v.last_30}</b>views · 30 days</span><span><b>${v.total}</b>all time</span></div>`;
}

/** Settings card: switch to a business account and fill in the details. */
export function businessSettings(el, { sb, S, esc, toast }) {
  const p = S.profile || {};
  if (!('account_type' in p)) { el.innerHTML = '<p class="small muted" style="margin:0">Business accounts are coming soon.</p>'; return; }
  const on = p.account_type === 'business';
  const f = (k, label, type = 'text', ph = '') => `<label class="stack" style="gap:4px"><span class="small"><b>${label}</b></span><input class="input" name="${k}" type="${type}" value="${esc(p[k] || '')}" placeholder="${esc(ph)}"></label>`;
  el.innerHTML = `<div class="row between"><h3 style="margin:0">💼 Business account</h3><label class="row small" style="gap:8px"><input type="checkbox" id="bizon" ${on ? 'checked' : ''}> I'm a business</label></div>
    <p class="small muted" style="margin:0">For lodges, restaurants, guides, shops and transport: a category badge, Call / WhatsApp / Directions / Book buttons on your profile, and view insights.</p>
    <form id="bizform" class="stack" ${on ? '' : 'hidden'}>
      <label class="stack" style="gap:4px"><span class="small"><b>Category</b></span><select class="input" name="biz_category">${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${p.biz_category === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${f('biz_town', 'Town', 'text', 'e.g. Ondangwa')}${f('biz_hours', 'Opening hours', 'text', 'e.g. Mon–Sat 08:00–18:00')}
      ${f('biz_phone', 'Phone', 'tel', '+264 81 000 0000')}${f('biz_whatsapp', 'WhatsApp', 'tel', '+264 81 000 0000')}${f('biz_email', 'Email', 'email', 'bookings@…')}
      ${f('biz_website', 'Website (https://)', 'url', 'https://')}${f('biz_booking', 'Booking link (https://)', 'url', 'https://')}
      <button class="btn small primary" style="align-self:flex-start">Save business details</button></form>`;
  const form = el.querySelector('#bizform');
  el.querySelector('#bizon').onchange = async (e) => {
    const account_type = e.target.checked ? 'business' : 'personal'; form.hidden = !e.target.checked;
    const { error } = await sb.from('profiles').update({ account_type }).eq('id', S.user.id);
    if (error) { toast(error.message); e.target.checked = !e.target.checked; form.hidden = !e.target.checked; return; }
    S.profile.account_type = account_type; toast(account_type === 'business' ? 'You are now a business account' : 'Back to a personal account');
  };
  form.onsubmit = async (e) => {
    e.preventDefault(); const patch = {};
    for (const [k, v] of new FormData(form)) patch[k] = String(v).trim() || null;
    for (const k of ['biz_phone', 'biz_whatsapp']) if (patch[k]) patch[k] = patch[k].replace(/[^\d+ ]/g, ''); // 081-123 (4567) -> 081123 4567
    const { error } = await sb.from('profiles').update(patch).eq('id', S.user.id);
    if (error) { toast(/check/i.test(error.message) ? 'Please check the phone, email and links (links must start with https://).' : error.message); return; }
    Object.assign(S.profile, patch); toast('Business details saved');
  };
}
