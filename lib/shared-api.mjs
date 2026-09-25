const apiBase = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const anonKey = () => process.env.SUPABASE_ANON_KEY;
export const configured = () => Boolean(apiBase() && anonKey());
export const json = (res, status, data) => res.status(status).setHeader('Cache-Control', 'no-store').json(data);

export function requireSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin || new URL(origin).host !== req.headers.host) throw new Error('Invalid request origin');
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('JSON request required');
}

const parseCookies = (raw = '') => Object.fromEntries(raw.split(';').map(c => {
  const [key, ...parts] = c.trim().split('=');
  try { return [key, decodeURIComponent(parts.join('='))]; } catch { return [key, '']; }
}));
const cookie = (name, value, maxAge) => `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=${maxAge}`;
export const setSession = (res, data) => res.setHeader('Set-Cookie', [
  cookie('myteam_access', data.access_token, Math.min(data.expires_in || 3600, 3600)),
  cookie('myteam_refresh', data.refresh_token, 60 * 60 * 24 * 30)
]);
export const clearSession = res => res.setHeader('Set-Cookie', [cookie('myteam_access', '', 0), cookie('myteam_refresh', '', 0)]);

export async function authToken(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.myteam_access) return cookies.myteam_access;
  if (!cookies.myteam_refresh) return null;
  const refreshed = await authFetch('token?grant_type=refresh_token', {refresh_token:cookies.myteam_refresh});
  if (!refreshed.ok) { clearSession(res); return null; }
  setSession(res, refreshed.data);
  return refreshed.data.access_token;
}

export async function authFetch(path, data) {
  if (!configured()) return {ok:false,error:'Shared workspace is not configured'};
  const response = await fetch(`${apiBase()}/auth/v1/${path}`, {
    method:'POST', headers:{apikey:anonKey(),'Content-Type':'application/json'}, body:JSON.stringify(data)
  });
  const result = await response.json().catch(() => ({}));
  return {ok:response.ok,data:result,error:result.msg || result.error_description || result.error || 'Authentication failed'};
}

export async function rpc(name, token, payload = {}) {
  const response = await fetch(`${apiBase()}/rest/v1/rpc/${name}`, {
    method:'POST', headers:{apikey:anonKey(),Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  return {ok:response.ok,data:result,error:result.message || 'Cover request failed'};
}
