// Podpisane (presigned) adresy S3 dla Backblaze B2 (SigV4). Klucze tylko w zmiennych środowiskowych.
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const te = new TextEncoder();
const sha = async s => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
async function hmac(k, s) {
  const key = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(s)));
}
export async function presign(env, method, key, expires = 600) {
  const host = env.B2_ENDPOINT.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const region = env.B2_REGION || host.split('.')[1];
  const d = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = d.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`;
  const path = '/' + env.B2_BUCKET + '/' + key.split('/').map(enc).join('/');
  const q = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': env.B2_KEY_ID + '/' + scope, 'X-Amz-Date': d, 'X-Amz-Expires': String(expires), 'X-Amz-SignedHeaders': 'host' };
  const qs = Object.keys(q).sort().map(k => enc(k) + '=' + enc(q[k])).join('&');
  const canon = [method, path, qs, 'host:' + host + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const sts = ['AWS4-HMAC-SHA256', d, scope, await sha(canon)].join('\n');
  let k = await hmac(te.encode('AWS4' + env.B2_APP_KEY), day);
  k = await hmac(k, region); k = await hmac(k, 's3'); k = await hmac(k, 'aws4_request');
  return `https://${host}${path}?${qs}&X-Amz-Signature=${hex(await hmac(k, sts))}`;
}
