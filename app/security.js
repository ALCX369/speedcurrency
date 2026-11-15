// Password checks used when a member sets or changes a password.
// Leaked-password check: Have I Been Pwned "range" API with k-anonymity. Only the first 5 characters
// of the password's SHA-1 hash leave the device; the password itself is never sent anywhere.

const COMMON = /^(password|passw0rd|qwerty|letmein|welcome|iloveyou|admin|namibia|speedcurrency|123456|abc123)/i;

/** Returns a sentence explaining what is wrong with the password, or '' when it is fine. */
export function passwordProblem(pw, confirm) {
  if (pw.length < 10) return 'Use at least 10 characters. A short sentence is easy to remember and hard to guess.';
  if (COMMON.test(pw) || /^(.)\1+$/.test(pw) || /^\d+$/.test(pw)) return 'That password is too easy to guess. Try a few unrelated words.';
  if (confirm !== undefined && pw !== confirm) return 'The two passwords are different. Type the same password twice.';
  return '';
}

/** How many times the password appears in known data breaches (0 = not found, -1 = check unavailable). */
export async function breachCount(pw) {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const r = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return -1;
    const line = (await r.text()).split('\n').find((l) => l.startsWith(hex.slice(5)));
    return line ? Number(line.split(':')[1]) || 0 : 0;
  } catch { return -1; }
}

/** Full check: '' when the password can be used, otherwise the reason it cannot. */
export async function checkNewPassword(pw, confirm) {
  const problem = passwordProblem(pw, confirm);
  if (problem) return problem;
  const n = await breachCount(pw);
  if (n > 0) return `This password has appeared in ${n.toLocaleString()} data breaches, so criminals try it first. Please choose a different one.`;
  return '';
}
