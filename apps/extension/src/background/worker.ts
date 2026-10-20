import { createClient } from '@supabase/supabase-js';
import { extractorFor } from '../content/extractors';
import contentScript from '../content/job-content.ts?script';

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
type Session = { access_token: string; refresh_token: string; expires_at: number };
let refreshInFlight: Promise<Session> | undefined;
let authEpoch = 0;
const refreshKey = 'refreshToken';
const sessionKey = 'session';

async function restrictStorage() {
  await Promise.all([
    chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  ]);
}
const storageReady = restrictStorage();
chrome.runtime.onInstalled.addListener(() => { void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); });
chrome.runtime.onStartup.addListener(() => { void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); });

async function storeSession(value: Session, epoch = authEpoch) {
  if (!value.access_token || !value.refresh_token) throw new Error('Authentication did not return a session.');
  if (epoch !== authEpoch) throw new Error('Authentication was cancelled.');
  await storageReady;
  await chrome.storage.session.set({ [sessionKey]: value });
  await chrome.storage.local.set({ [refreshKey]: value.refresh_token });
}
async function clearSession() {
  authEpoch++;
  refreshInFlight = undefined;
  await Promise.all([chrome.storage.session.remove(sessionKey), chrome.storage.local.remove(refreshKey)]);
}
async function decodeResponse(response: Response) {
  if (response.status === 204) return undefined;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}
async function publicRequest(path: string, body: unknown) {
  return decodeResponse(await fetch(`${apiUrl}/api/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  }));
}
async function getSession(force = false): Promise<Session | undefined> {
  await storageReady;
  const stored = await chrome.storage.session.get(sessionKey);
  const session = stored[sessionKey] as Session | undefined;
  if (!force && session && session.expires_at > Date.now() / 1000 + 60) return session;
  const local = await chrome.storage.local.get(refreshKey);
  if (!local[refreshKey]) return undefined;
  if (!refreshInFlight) {
    const epoch = authEpoch;
    refreshInFlight = (async () => {
      const value: Session = await publicRequest('refresh', { refreshToken: local[refreshKey] });
      await storeSession(value, epoch);
      return value;
    })().finally(() => { refreshInFlight = undefined; });
  }
  return refreshInFlight;
}
const allowedRoutes = /^(?:users\/me|resumes(?:\/[0-9a-f-]{36})?|generations(?:\/[0-9a-f-]{36})?(?:\?offset=\d+)?|generate)$/;
async function apiRequest(path: string, method = 'GET', body?: unknown) {
  if (!allowedRoutes.test(path) || !['GET', 'POST', 'PUT', 'DELETE'].includes(method)) throw new Error('Unsupported API request.');
  let session = await getSession();
  if (!session) throw new Error('Please sign in to continue.');
  const send = (value: Session) => fetch(`${apiUrl}/api/${path}`, {
    method, headers: { Authorization: `Bearer ${value.access_token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(path === 'generate' ? 90000 : 20000),
  });
  let response = await send(session);
  if (response.status === 401) {
    session = await getSession(true);
    if (!session) throw new Error('Please sign in again.');
    response = await send(session);
  }
  return decodeResponse(response);
}
async function oauthLogin() {
  const epoch = authEpoch;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) throw new Error('Google sign-in is not configured. Use email sign-in.');
  const client = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' } });
  const redirectTo = chrome.identity.getRedirectURL('auth');
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw new Error('Could not start Google sign-in.');
  const callback = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  if (!callback || !callback.startsWith(redirectTo + '?')) throw new Error('Sign-in was cancelled.');
  const url = new URL(callback);
  const code = url.searchParams.get('code');
  if (!code) throw new Error(url.searchParams.get('error_description') || 'Sign-in did not return a code.');
  const result = await client.auth.exchangeCodeForSession(code);
  if (result.error || !result.data.session) throw new Error('Could not complete sign-in.');
  await storeSession(result.data.session as Session, epoch);
}
async function handle(message: Record<string, any>) {
  switch (message.type) {
    case 'AUTH_STATUS': return { signedIn: !!(await getSession()) };
    case 'LOGIN': {
      const epoch = authEpoch;
      await storeSession(await publicRequest('login', { email: message.email, password: message.password }), epoch);
      return { signedIn: true };
    }
    case 'SIGNUP': {
      const epoch = authEpoch;
      const result = await publicRequest('signup', { email: message.email, password: message.password });
      if (result.session) await storeSession(result.session, epoch);
      return { signedIn: !!result.session, confirmationRequired: result.confirmationRequired };
    }
    case 'OAUTH': await oauthLogin(); return { signedIn: true };
    case 'LOGOUT': await clearSession(); return { signedIn: false };
    case 'API': return apiRequest(message.path, message.method, message.body);
    case 'SCRAPE': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || !extractorFor(new URL(tab.url).hostname)) throw new Error('Open a job on LinkedIn, Indeed, Greenhouse, Lever, or Handshake, or enter details manually.');
      let result;
      try { result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB' }); }
      catch {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [contentScript] });
        result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB' });
      }
      if (!result?.ok) throw new Error(result?.error || 'Could not read job details. Please enter them manually.');
      return result.data;
    }
    default: throw new Error('Unknown message.');
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Sender URLs are browser supplied: content scripts have the host page URL.
  // Extension pages may themselves be open in a tab (for setup or accessibility).
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')) || message?.type === 'EXTRACT_JOB') return;
  void handle(message).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message || 'Request failed. Please try again.' }));
  return true;
});
