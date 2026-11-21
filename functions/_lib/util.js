export const SBURL = e => e.SUPABASE_URL || 'https://vvrfnzkaloyntqobwpet.supabase.co';
export const ANON = e => e.SUPABASE_ANON_KEY || 'sb_publishable_V8b7cwSDKqPER6ikrz54wQ_62yx_5ZF';
// Nowe klucze sb_* nie są JWT, więc wysyłamy je tylko w nagłówku apikey
export const hdr = k => (k || '').startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
export const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
export const sb = (env, path, o = {}) => fetch(SBURL(env) + '/rest/v1/' + path, { ...o, headers: { ...hdr(env.SUPABASE_SERVICE_KEY), 'Content-Type': 'application/json', Prefer: 'return=representation', ...(o.headers || {}) } });
// Weryfikacja sesji administratora (token użytkownika Supabase Auth). Zwraca użytkownika albo null.
export async function admin(env, request) {
  const t = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!t) return null;
  const r = await fetch(SBURL(env) + '/auth/v1/user', { headers: { apikey: ANON(env), Authorization: 'Bearer ' + t } });
  return r.ok ? r.json() : null;
}
