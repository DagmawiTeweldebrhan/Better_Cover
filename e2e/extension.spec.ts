import { chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

test('packaged extension starts, keeps tokens private, refreshes sessions and signs out', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'better-cover-test-'));
  const extension = resolve('apps/extension/dist');
  const context = await chromium.launchPersistentContext(directory, {
    channel: 'chromium', headless: true,
    viewport: { width: 400, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).hostname;
    // Mock only the external API boundary; Chrome messaging and storage are real.
    await worker.evaluate(() => {
      const session = { access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600 };
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === '/api/auth/login' || path === '/api/auth/refresh') return Response.json(session);
        if (path === '/api/users/me') {
          if (new Headers(init?.headers).get('Authorization') !== 'Bearer test-access-token') return Response.json({ error: 'Invalid token' }, { status: 401 });
          return Response.json({ id: 'test-user', email: 'test@example.com', credits: 10, user_type: 'standard' });
        }
        if (path === '/api/resumes') return Response.json([]);
        return Response.json({ error: 'Unexpected test API call' }, { status: 404 });
      }) as typeof fetch;
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    const result = await page.evaluate(async () => {
      return (window as any).chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
    });
    expect(result).toEqual({ ok: true, data: { signedIn: false } });
    await page.screenshot({ path: 'test-results/extension-login.png', fullPage: true });
    await page.getByLabel('Email', { exact: true }).fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in →', exact: true }).click();
    await expect(page.getByText('10 letters left')).toBeVisible();
    // Simulate MV3 suspension/restart: persistent refresh token restores access.
    await worker.evaluate(async () => { await chrome.storage.session.remove('session'); });
    const restored = await page.evaluate(async () => chrome.runtime.sendMessage({ type: 'API', path: 'users/me' }));
    expect(restored.data.email).toBe('test@example.com');
    expect(restored.data.access_token).toBeUndefined();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    const persisted = await worker.evaluate(async () => chrome.storage.local.get('refreshToken'));
    expect(persisted.refreshToken).toBeUndefined();
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
