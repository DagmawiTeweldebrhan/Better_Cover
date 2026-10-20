import { chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

test('packaged extension creates and saves template drafts with no network or account', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'better-cover-test-'));
  const extension = resolve('apps/extension/dist');
  const context = await chromium.launchPersistentContext(directory, {
    channel: 'chromium', headless: true, viewport: { width: 400, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await worker.evaluate(() => {
      globalThis.fetch = (async () => { throw new Error('Network is unavailable in this test.'); }) as typeof fetch;
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/index.html`);
    await expect(page.getByText('Free local drafts')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await page.getByRole('button', { name: 'My resumes' }).click();
    await page.getByLabel('Resume name').fill('Frontend engineering');
    await page.getByLabel('Resume content').fill('Alex Morgan\nBuilt accessible React and TypeScript applications with product designers. Developed reusable UI components and tested keyboard navigation.');
    await page.getByRole('button', { name: 'Save resume', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Frontend engineering' })).toBeVisible();
    await page.getByRole('button', { name: 'Write a letter', exact: true }).click();
    await page.getByLabel('Job title', { exact: true }).fill('Frontend Engineer');
    await page.getByLabel('Company', { exact: true }).fill('Acme');
    await page.getByLabel('Job description', { exact: true }).fill('Build accessible React and TypeScript applications and reusable UI components with our product designers.');
    await page.getByRole('button', { name: 'Create my template draft' }).click();
    await expect(page.getByLabel('Edit your cover letter')).toHaveValue(/Frontend Engineer position at Acme/);
    await expect(page.getByLabel('Edit your cover letter')).toHaveValue(/Built accessible React and TypeScript applications/);
    const original = await page.getByLabel('Edit your cover letter').inputValue();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Frontend Engineer', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Free local drafts')).toBeVisible();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open letter' }).click();
    await expect(page.getByLabel('Edit your cover letter')).toHaveValue(original);
    const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions);
    expect(permissions).not.toContain('identity');
    const hosts = await worker.evaluate(() => chrome.runtime.getManifest().host_permissions);
    expect(hosts?.some(host => /localhost|supabase|onrender/.test(host))).toBe(false);
    await page.screenshot({ path: 'test-results/local-template-workspace.png', fullPage: true });
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
