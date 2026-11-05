// Pelham Acres — cloud saves through Supabase (email code sign-in, one save per player).
// Talks to Supabase's REST endpoints directly, so there's no extra library to download.
import * as G from './game.js';

// Project URL and the *anon public* key (safe to ship in a web page; row-level security protects each save).
export const CLOUD = { url: 'https://khoikcuhtzchxcafelrk.supabase.co', key: 'sb_publishable_q25qJ-wDLhVXGUIiZR-ZWg_fGNQBrYu' };
export const cloudEnabled = () => !!(CLOUD.url && CLOUD.key);

const AUTH_KEY = 'pelhamAcres.auth';
let session = null;
try { session = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { session = null; }
const keep = () => { try { session ? localStorage.setItem(AUTH_KEY, JSON.stringify(session)) : localStorage.removeItem(AUTH_KEY); } catch (e) {} };
export const signedIn = () => !!(session && session.user);
export const userEmail = () => session?.user?.email || '';
export const lastSync = () => session?.lastSync || 0;

async function api(path, { method = 'GET', body, auth = false, headers = {}, keepalive = false } = {}) {
  const h = { apikey: CLOUD.key, 'Content-Type': 'application/json', ...headers };
  if (auth) { await freshToken(); h.Authorization = 'Bearer ' + session.access_token; }
  const r = await fetch(CLOUD.url.replace(/\/$/, '') + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, keepalive });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) throw new Error((data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + r.status));
  return data;
}
async function freshToken() {
  if (!session) throw new Error('Not signed in');
  if (Date.now() < (session.expires_at || 0) * 1000 - 60000) return;
  const d = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
  Object.assign(session, d); keep();
}

// Step 1: email a sign-in link (it leads back to the game).
const gameUrl = () => location.origin + location.pathname;
export const sendCode = email => api('/auth/v1/otp?redirect_to=' + encodeURIComponent(gameUrl()), { method: 'POST', body: { email, create_user: true } });
// Step 2 (home-screen app): paste the link from the email, or type a 6-digit code if the email has one.
export async function verifyInput(email, input) {
  const s = String(input).trim();
  let d;
  if (/^\d{6,10}$/.test(s)) d = await api('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: s } });
  else {
    let url; try { url = new URL(s); } catch (e) { throw new Error('Paste the whole sign-in link from the email'); }
    const token = url.searchParams.get('token') || url.searchParams.get('token_hash');
    if (!token) throw new Error("That doesn't look like the sign-in link");
    const type = url.searchParams.get('type') || 'magiclink';
    try { d = await api('/auth/v1/verify', { method: 'POST', body: { type, token_hash: token } }); }
    catch (e) { d = await api('/auth/v1/verify', { method: 'POST', body: { type: 'email', token_hash: token } }); }
  }
  session = { ...d, lastSync: 0 }; keep();
  return session.user;
}
// Step 2 (tapping the link): the game opens with the session in the address (#access_token=…); pick it up.
export async function consumeRedirect() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (h.get('error_description')) { history.replaceState(null, '', gameUrl()); throw new Error(h.get('error_description').replace(/\+/g, ' ')); }
  const at = h.get('access_token'); if (!at) return null;
  history.replaceState(null, '', gameUrl());   // tidy the address bar
  session = { access_token: at, refresh_token: h.get('refresh_token'), expires_at: +h.get('expires_at') || Math.floor(Date.now() / 1000) + (+h.get('expires_in') || 3600), lastSync: 0 };
  session.user = await api('/auth/v1/user', { headers: { Authorization: 'Bearer ' + at } });
  keep();
  return session.user;
}
export function signOut() { session = null; keep(); }

// The cloud copy of this player's farm, or null if they haven't saved one yet.
export async function fetchCloud() {
  const rows = await api(`/rest/v1/saves?select=data,updated_at&user_id=eq.${session.user.id}`, { auth: true });
  return rows && rows[0] ? rows[0].data : null;
}
let lastUploaded = 0, uploading = false;
export async function upload(force, keepalive) {
  if (!cloudEnabled() || !signedIn() || !G.S || uploading) return false;
  if (!force && G.S.saved && G.S.saved <= lastUploaded) return false;   // nothing new since the last upload
  uploading = true;
  try {
    G.save();
    await api('/rest/v1/saves', { method: 'POST', auth: true, keepalive,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { user_id: session.user.id, data: G.S, updated_at: new Date().toISOString() } });
    lastUploaded = G.S.saved; session.lastSync = Date.now(); keep();
    return true;
  } finally { uploading = false; }
}
// a one-line description of a save, for the "which farm?" choice
export const describe = s => s ? `Level ${s.level} · ${Math.round(s.coins).toLocaleString()} coins · saved ${new Date(s.saved || s.created).toLocaleString()}` : 'nothing yet';
