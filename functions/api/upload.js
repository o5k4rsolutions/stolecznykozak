// POST {type} + Authorization: Bearer <sesja admina> -> {uploadUrl, publicUrl}
// Env: B2_KEY_ID, B2_APP_KEY (Secret), B2_BUCKET, B2_ENDPOINT, B2_PUBLIC_URL
import { admin, j, rnd } from '../_lib/util.js';
import { presign } from '../_lib/b2.js';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export async function onRequestPost({ request, env }) {
  if (!await admin(env, request)) return j({ error: 'auth' }, 401);
  if (!env.B2_KEY_ID || !env.B2_APP_KEY || !env.B2_BUCKET || !env.B2_ENDPOINT || !env.B2_PUBLIC_URL) return j({ error: 'b2 not configured' }, 500);
  const { type } = await request.json().catch(() => ({}));
  const ext = EXT[type];
  if (!ext) return j({ error: 'type' }, 415);
  const n = new Date(), key = `img/${n.getUTCFullYear()}/${String(n.getUTCMonth() + 1).padStart(2, '0')}/${rnd(14)}.${ext}`;
  return j({ uploadUrl: await presign(env, 'PUT', key, 600), publicUrl: env.B2_PUBLIC_URL.replace(/\/$/, '') + '/' + key });
}
