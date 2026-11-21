// Komentarze trafiają do moderacji (pending); IP czytane po stronie serwera.
import { j, sb } from '../_lib/util.js';
export async function onRequestPost({ request, env }) {
  let d; try { d = await request.json(); } catch { return j({ error: 'bad' }, 400); }
  if (d.website) return new Response(null, { status: 204 }); // honeypot
  const name = String(d.name || '').trim().slice(0, 60), email = String(d.email || '').trim().slice(0, 120), body = String(d.body || '').trim().slice(0, 2000);
  if (!name || !body || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^[0-9a-f-]{36}$/.test(d.article_id || '')) return j({ error: 'invalid' }, 422);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const since = encodeURIComponent(new Date(Date.now() - 600000).toISOString());
  const recent = await (await sb(env, `comments?select=id&ip=eq.${encodeURIComponent(ip)}&created_at=gte.${since}`)).json();
  if (Array.isArray(recent) && recent.length >= 5) return j({ error: 'rate' }, 429);
  const r = await sb(env, 'comments', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ article_id: d.article_id, name, email, body, ip, status: 'pending' }) });
  return new Response(null, { status: r.ok ? 201 : 502 });
}
