// Publiczny podgląd zdjęć z PRYWATNEGO bucketu B2: /img/RRRR/MM/xxxxxxxxxxxxxx.jpg
// Funkcja podpisuje krótkotrwały adres S3, pobiera plik i oddaje go z długim cache (cache Cloudflare odciąża B2).
import { presign } from '../_lib/b2.js';
export async function onRequestGet({ request, env, params, waitUntil }) {
  const key = 'img/' + [].concat(params.path || []).join('/');
  if (!/^img\/\d{4}\/\d{2}\/[a-z0-9]{14}\.(jpg|png|webp|gif)$/.test(key)) return new Response('Not found', { status: 404 });
  if (!env.B2_KEY_ID || !env.B2_APP_KEY || !env.B2_BUCKET || !env.B2_ENDPOINT) return new Response('b2 not configured', { status: 500 });
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(request); if (hit) return hit; }
  const r = await fetch(await presign(env, 'GET', key, 60));
  if (!r.ok) return new Response('Not found', { status: 404 });
  const res = new Response(r.body, { status: 200, headers: {
    'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  if (cache && waitUntil) waitUntil(cache.put(request, res.clone()));
  return res;
}
