// ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
// Profile pictures (public "avatars" bucket, migration 016) + business category labels.
// avatarUrl(path) -> public image address; avatarHtml(person) -> picture or the first letter;
// pickAvatar() lets you choose a photo, shrinks it to 512 px on the phone, uploads it and saves it on your profile.

export const BIZ = { lodge: '🛏 Lodge', restaurant: '🍽 Restaurant', tour: '🧭 Tours', shop: '🛍 Shop', transport: '🚐 Transport', guide: '🎒 Guide', other: '🏷 Business' };
export const bizLabel = (a) => (a?.account_type === 'business' ? BIZ[a.biz_category] || BIZ.other : '');

export function avatarUrl(path) {
  const base = window.SC_CONFIG?.SUPABASE_URL;
  if (!base || !path || !/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(path)) return '';
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

export const nameOf = (a) => (a ? a.display_name || '@' + (a.username || 'traveller') : 'Traveller');

export function avatarHtml(a, esc, cls = 'avatar') {
  const u = avatarUrl(a?.avatar_path);
  return u ? `<span class="${cls} has-pic" style="background-image:url('${esc(u)}')" aria-hidden="true"></span>`
    : `<span class="${cls}" aria-hidden="true">${esc(nameOf(a).replace('@', '')[0]?.toUpperCase() || '✦')}</span>`;
}

// shrink to a square 512 px WebP so uploads stay small on slow connections
async function square(file, size = 512) {
  const img = await createImageBitmap(file);
  const s = Math.min(img.width, img.height);
  const c = Object.assign(document.createElement('canvas'), { width: size, height: size });
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((res) => c.toBlob(res, 'image/webp', 0.85));
}

export function pickAvatar({ sb, S, DEMO, toast, onDone }) {
  if (DEMO) { toast('Profile pictures work once you are signed in online'); return; }
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
  inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast('Please pick a JPG, PNG or WebP photo'); return; }
    try {
      toast('Uploading your photo…');
      const blob = await square(f);
      const uid = S.user.id; const path = `${uid}/avatar-${Date.now()}.webp`;
      const up = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (up.error) throw up.error;
      const old = S.profile?.avatar_path;
      const { error } = await sb.from('profiles').update({ avatar_path: path }).eq('id', uid);
      if (error) throw error;
      if (old && old.startsWith(uid + '/')) sb.storage.from('avatars').remove([old]).catch(() => {});
      if (S.profile) S.profile.avatar_path = path;
      toast('Profile picture updated');
      onDone?.(path);
    } catch (e) { toast(/bucket|not found|row-level|policy/i.test(e.message || '') ? 'Profile pictures are switching on soon' : e.message); }
  };
  inp.click();
}
