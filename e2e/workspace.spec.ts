import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const id = 'a1111111-1111-4111-8111-111111111111';
    let signedIn = true;
    let resumes: any[] = [];
    const profile = { id, email: 'test@example.com', credits: 10, user_type: 'standard' };
    const store: Record<string, any> = {};
    (window as any).chrome = {
      storage: { session: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (data: object) => Object.assign(store, data), remove: async (key: string) => { delete store[key]; },
      } },
      runtime: { id: 'test-extension', sendMessage: async (msg: any) => {
        let data: any;
        if (msg.type === 'AUTH_STATUS') data = { signedIn };
        else if (msg.type === 'LOGIN') { signedIn = true; data = { signedIn }; }
        else if (msg.type === 'LOGOUT') { signedIn = false; data = { signedIn }; }
        else if (msg.type === 'SCRAPE') data = { jobTitle: 'Frontend Engineer', companyName: 'Acme', jobDescription: 'Build accessible React interfaces and reliable TypeScript applications with a collaborative team.', platform: 'LinkedIn' };
        else if (msg.type === 'API') {
          if (msg.path === 'users/me') data = profile;
          else if (msg.path === 'resumes' && msg.method === 'GET') data = resumes;
          else if (msg.path === 'resumes' && msg.method === 'POST') { data = { ...msg.body, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; resumes.push(data); }
          else if (msg.path.startsWith('resumes/') && msg.method === 'DELETE') { resumes = []; }
          else if (msg.path === 'generate') { data = { success: true, coverLetter: 'Dear Hiring Manager,\n\nI build accessible React interfaces and would bring that experience to Acme.\n\nThank you for your consideration.', creditsRemaining: 9 }; }
          else if (msg.path.startsWith('generations')) data = [];
        }
        return { ok: true, data };
      } },
    };
  });
  await page.goto('http://localhost:4173');
});
test('save resume, import job, draft, edit, download and inspect history', async ({ page }) => {
  await expect(page.getByText('Free local drafts')).toBeVisible();
  await page.getByRole('button', { name: 'My resumes' }).click();
  await page.getByLabel('Resume name').fill('Frontend engineering');
  await page.getByLabel('Resume content').fill('Built accessible React applications and TypeScript APIs. Led usability improvements and collaborated with product designers.');
  await page.getByRole('button', { name: 'Save resume', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Frontend engineering' })).toBeVisible();
  await page.getByRole('button', { name: 'Write a letter', exact: true }).click();
  await page.getByRole('button', { name: 'Use job from current tab' }).click();
  await expect(page.getByLabel('Job title', { exact: true })).toHaveValue('Frontend Engineer');
  await page.getByRole('button', { name: 'friendly', exact: true }).click();
  await page.getByRole('button', { name: 'Create my template draft' }).click();
  await expect(page.getByLabel('Edit your cover letter')).toHaveValue(/Dear Hiring Manager/);
  await expect(page.getByText('Free local drafts')).toBeVisible();
  await page.getByLabel('Edit your cover letter').fill('My edited letter for Acme.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .txt' }).click();
  expect((await download).suggestedFilename()).toBe('cover-letter-Acme.txt');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A fresh page.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
});
test('fits a narrow side panel without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.getByText('Free local drafts')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
