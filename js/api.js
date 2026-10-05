// Talks to the project: sign in, read, and the two actions (Emergency stop / Resume, Run a search now).
// No outside libraries. The owner's session lives in this browser only; it is never printed, logged or put in an address.
// Everything is checked by the database against the signed-in person's own membership - this file decides nothing about who may do what.
import { SUPABASE_URL, ANON_KEY } from "./config.js";

const KEY = "ava_owner_dashboard_v3_session_v1";
let session = load();
let refreshing = null;
const signedOutListeners = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && typeof s.access_token === "string" && typeof s.refresh_token === "string" ? s : null;
  } catch { return null; }
}
function save(s) {
  session = s;
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private window: the session just lives in memory */ }
}
function keep(j) {
  const exp = typeof j.expires_at === "number" ? j.expires_at : Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600);
  save({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: exp });
}

export const isSignedIn = () => session !== null;
export const onSignedOut = (fn) => { signedOutListeners.add(fn); };
function forceSignedOut() { save(null); signedOutListeners.forEach((f) => { try { f(); } catch { /* ignore */ } }); }

async function authPost(path, body) {
  return fetch(`${SUPABASE_URL}/auth/v1/${path}`, { method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** Never says which part was wrong. */
export async function signIn(email, password) {
  try {
    const r = await authPost("token?grant_type=password", { email, password });
    if (!r.ok) return { ok: false, network: false };
    const j = await r.json();
    if (!j?.access_token || !j?.refresh_token) return { ok: false, network: false };
    keep(j);
    return { ok: true };
  } catch { return { ok: false, network: true }; }
}

async function refresh() {
  if (!session?.refresh_token) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await authPost("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
        if (!r.ok) { return false; }
        const j = await r.json();
        if (!j?.access_token) return false;
        keep(j);
        return true;
      } catch { return false; } finally { refreshing = null; }
    })();
  }
  return refreshing;
}

export async function signOut() {
  const token = session?.access_token;
  save(null);
  if (token) {
    try { await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } }); } catch { /* the local session is already gone */ }
  }
}

async function bearer() {
  if (!session) return null;
  if (session.expires_at - 60 < Date.now() / 1000) { if (!(await refresh())) { forceSignedOut(); return null; } }
  return session.access_token;
}

/** One authorized request; on a 401 it refreshes once and tries again. Returns { ok, status, data }. */
async function authed(url, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await bearer();
    if (!token) return { ok: false, status: 401, data: null };
    let res;
    try {
      res = await fetch(url, { ...init, headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    } catch { return { ok: false, status: 0, data: null }; }
    if (res.status === 401 && attempt === 0) { if (await refresh()) continue; forceSignedOut(); return { ok: false, status: 401, data: null }; }
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { ok: res.ok, status: res.status, data };
  }
  return { ok: false, status: 401, data: null };
}

export function select(path) {
  return authed(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { Accept: "application/json" } });
}

export function rpc(name, args) {
  return authed(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args) });
}

/** Calls a search helper. Only ids are sent: never a provider, a run, a page or a limit. */
export function callHelper(functionName, body) {
  return authed(`${SUPABASE_URL}/functions/v1/${encodeURIComponent(functionName)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** The owner's first name if the sign-in already carries one (read from the sign-in itself; nothing is fetched, and an email address is never used). */
export function ownerFirstName() {
  try {
    const part = session?.access_token?.split(".")[1];
    if (!part) return "";
    const json = JSON.parse(decodeURIComponent(escape(atob(part.replace(/-/g, "+").replace(/_/g, "/")))));
    const m = json?.user_metadata && typeof json.user_metadata === "object" ? json.user_metadata : {};
    const raw = [m.first_name, m.given_name, m.full_name, m.name].find((x) => typeof x === "string" && x.trim() !== "");
    const first = raw ? raw.trim().split(/\s+/)[0] : "";
    return /^[\p{L}][\p{L}'’-]{0,30}$/u.test(first) && !first.includes("@") ? first : "";
  } catch { return ""; }
}
