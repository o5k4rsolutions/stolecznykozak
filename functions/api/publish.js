// POST {short_id} + sesja admina -> embed na Discorda. Env: DISCORD_WEBHOOK_URL (Secret), opcjonalnie SITE_URL
import { admin, j, sb } from '../_lib/util.js';
export async function onRequestPost({ request, env }) {
  if (!await admin(env, request)) return j({ error: 'auth' }, 401);
  if (!env.DISCORD_WEBHOOK_URL) return j({ error: 'webhook not configured' }, 500);
  const { short_id } = await request.json().catch(() => ({}));
  if (!/^[a-z0-9]{8}$/.test(short_id || '')) return j({ error: 'bad' }, 400);
  const [a] = await (await sb(env, `articles?select=short_id,slug,title,excerpt,cover_url,category&short_id=eq.${short_id}`)).json();
  if (!a) return j({ error: 'nf' }, 404);
  const site = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const embed = { title: a.title, url: `${site}/artykuly/${a.short_id}/${a.slug}`, description: a.excerpt || '', color: 0xD91F2E,
    author: { name: 'Stołeczny Kozak' }, footer: { text: a.category || 'Warszawa' }, timestamp: new Date().toISOString(), ...(a.cover_url ? { image: { url: a.cover_url } } : {}) };
  const r = await fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Stołeczny Kozak', embeds: [embed] }) });
  return new Response(null, { status: r.ok ? 204 : 502 });
}
