// Czat na żywo. Wiadomości zapisuje i rozsyła serwer (klucz serwisowy), a klienci nasłuchują kanału Realtime room-<token>.
// Token pokoju (32 znaki) zna tylko klient i panel admina, więc to on chroni rozmowę.
import { SBURL, hdr, j, rnd, sb, admin } from '../_lib/util.js';
const bc = (env, token, event, payload) => fetch(SBURL(env) + '/realtime/v1/api/broadcast', { method: 'POST',
  headers: { ...hdr(env.SUPABASE_SERVICE_KEY), 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ topic: 'room-' + token, event, payload, private: false }] }) }).catch(() => {});
async function avail(env) { // ktoś ze statusem „Dostępny” i aktywnością w ostatnich 90 s
  const since = encodeURIComponent(new Date(Date.now() - 90000).toISOString());
  const a = await (await sb(env, `staff_status?select=user_id&available=eq.true&updated_at=gte.${since}&limit=1`)).json();
  return Array.isArray(a) && a[0] ? a[0].user_id : null;
}
const TOK = /^[a-z0-9]{32}$/, UUID = /^[0-9a-f-]{36}$/;
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), a = u.searchParams.get('a');
  if (a === 'avail') return j({ available: !!(await avail(env)) });
  if (a === 'room') {
    const t = u.searchParams.get('token') || '';
    if (!TOK.test(t)) return j({ error: 'nf' }, 404);
    const [r] = await (await sb(env, `chat_rooms?select=id,status,subject&token=eq.${t}`)).json();
    if (!r) return j({ error: 'nf' }, 404);
    const m = await (await sb(env, `chat_messages?select=id,sender,body,created_at&room_id=eq.${r.id}&order=created_at.asc&limit=500`)).json();
    return j({ status: r.status, subject: r.subject, messages: m });
  }
  return j({ error: 'bad' }, 400);
}
export async function onRequestPost({ request, env }) {
  let d; try { d = await request.json(); } catch { return j({ error: 'bad' }, 400); }
  if (d.a === 'start') {
    if (d.website) return j({ error: 'bad' }, 400);
    const subject = String(d.subject || '').trim().slice(0, 120), name = String(d.name || '').trim().slice(0, 60), email = String(d.email || '').trim().slice(0, 120);
    if (!subject || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return j({ error: 'invalid' }, 422);
    const uid = await avail(env);
    if (!uid) return j({ error: 'unavailable' }, 409);
    const since = encodeURIComponent(new Date(Date.now() - 600000).toISOString());
    const recent = await (await sb(env, `chat_rooms?select=id&email=eq.${encodeURIComponent(email)}&created_at=gte.${since}`)).json();
    if (Array.isArray(recent) && recent.length >= 3) return j({ error: 'rate' }, 429);
    const token = rnd(32);
    const r = await sb(env, 'chat_rooms', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ token, subject, name, email, status: 'active', assigned_to: uid }) });
    return r.ok ? j({ token }, 201) : j({ error: 'db' }, 502);
  }
  if (d.a === 'send') {
    const body = String(d.body || '').trim().slice(0, 1000);
    if (!body) return j({ error: 'empty' }, 422);
    let room, sender;
    if (d.token) {
      if (!TOK.test(d.token)) return j({ error: 'bad' }, 400);
      [room] = await (await sb(env, `chat_rooms?select=id,token,status&token=eq.${d.token}`)).json(); sender = 'client';
    } else {
      if (!await admin(env, request)) return j({ error: 'auth' }, 401);
      if (!UUID.test(d.room_id || '')) return j({ error: 'bad' }, 400);
      [room] = await (await sb(env, `chat_rooms?select=id,token,status&id=eq.${d.room_id}`)).json(); sender = 'staff';
    }
    if (!room) return j({ error: 'nf' }, 404);
    if (room.status !== 'active') return j({ error: 'closed' }, 409);
    const [m] = await (await sb(env, 'chat_messages', { method: 'POST', body: JSON.stringify({ room_id: room.id, sender, body }) })).json();
    await sb(env, `chat_rooms?id=eq.${room.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_msg_at: new Date().toISOString() }) });
    await bc(env, room.token, 'msg', m);
    return j(m, 201);
  }
  if (d.a === 'close') {
    if (!await admin(env, request)) return j({ error: 'auth' }, 401);
    if (!UUID.test(d.room_id || '')) return j({ error: 'bad' }, 400);
    const [room] = await (await sb(env, `chat_rooms?id=eq.${d.room_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString() }) })).json();
    if (!room) return j({ error: 'nf' }, 404);
    await bc(env, room.token, 'closed', { at: new Date().toISOString() });
    return j({ ok: true });
  }
  return j({ error: 'bad' }, 400);
}
