// POST {id} + sesja admina: kasuje pliki zdjęć z B2, a potem artykuł (komentarze znikają kaskadowo).
import { admin, j, sb } from '../_lib/util.js';
import { presign } from '../_lib/b2.js';
export async function onRequestPost({ request, env }) {
  if (!await admin(env, request)) return j({ error: 'auth' }, 401);
  const { id } = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/.test(id || '')) return j({ error: 'bad' }, 400);
  const [a] = await (await sb(env, `articles?select=cover_url,blocks&id=eq.${id}`)).json();
  if (!a) return j({ error: 'nf' }, 404);
  const urls = [a.cover_url, ...(a.blocks || []).filter(b => b.type === 'img').map(b => b.url)].filter(Boolean);
  const base = (env.B2_PUBLIC_URL || '').replace(/\/$/, '') + '/';
  let files = 0;
  if (env.B2_KEY_ID && base.length > 1) {
    for (const u of urls) {
      if (!u.startsWith(base)) continue;
      const key = decodeURIComponent(u.slice(base.length).split('?')[0]);
      if (!/^img\/[\w\/.-]+$/.test(key)) continue;
      try { await fetch(await presign(env, 'DELETE', key, 60), { method: 'DELETE' }); files++; } catch {}
    }
  }
  const r = await sb(env, `articles?id=eq.${id}`, { method: 'DELETE' });
  return j({ ok: r.ok, files }, r.ok ? 200 : 502);
}
