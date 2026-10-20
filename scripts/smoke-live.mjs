// Uses real configured services. Pass --skip-generation to avoid AI charges.
// Deletes only its own synthetic test account.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const config = { ...parseEnv(await readFile('apps/api/.env', 'utf8')), ...process.env };
const port = '34107';
const base = `http://127.0.0.1:${port}`;
const skipGeneration = process.argv.includes('--skip-generation');
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let userId;
let server;
try {
  server = spawn(process.execPath, ['dist/server.js'], { cwd: 'apps/api', env: { ...config, PORT: port, TRUST_PROXY_HOPS: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await Promise.race([
    once(server.stdout, 'data'),
    once(server, 'exit').then(() => { throw new Error('API could not start for the live smoke test.'); }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('API startup timed out.')), 20000); timer.unref(); }),
  ]);
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const email = `better-cover-smoke-${randomUUID()}@example.com`;
  const password = randomBytes(32).toString('base64url');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Test account creation failed (${created.error?.status ?? 'unknown'}).`);
  userId = created.data.user.id;
  async function request(path, method = 'GET', body, token) {
    const response = await fetch(`${base}/api/${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(90000),
    });
    const result = response.status === 204 ? undefined : await response.json();
    if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${result?.error || 'request failed'}`);
    return result;
  }
  const session = await request('auth/login', 'POST', { email, password });
  const token = session.access_token;
  assert.ok(token);
  const profile = await request('users/me', 'GET', undefined, token);
  assert.equal(profile.credits, 10);
  console.log('Verified real email/password sign-in and profile creation.');
  const resume = await request('resumes', 'POST', { title: 'Synthetic smoke-test resume', content: 'Alex Morgan is a frontend engineer who built accessible React and TypeScript interfaces, collaborated with product designers, and developed reusable UI components. Skills include HTML, CSS, React, TypeScript, Git, and API integration.' }, token);
  assert.equal((await request('resumes', 'GET', undefined, token))[0].id, resume.id);
  const updated = await request(`resumes/${resume.id}`, 'PUT', { title: 'Updated synthetic resume', content: resume.content }, token);
  assert.equal(updated.title, 'Updated synthetic resume');
  console.log('Verified real resume creation, listing, and editing.');
  if (!skipGeneration) {
  let result;
  try { result = await request('generate', 'POST', {
    resumeId: resume.id, jobTitle: 'Frontend Engineer', companyName: 'Example Company',
    jobDescription: 'Build accessible React and TypeScript interfaces with product designers. Develop reusable components, integrate APIs, and improve usability for customers.',
    tone: 'professional', length: 'short', platform: 'Manual', customInstructions: 'Use only the synthetic resume facts.',
  }, token); }
  catch (error) {
    assert.equal((await request('users/me', 'GET', undefined, token)).credits, 10, 'Failed generation must restore the reserved credit.');
    console.log('Verified that failed generation restores its reserved credit.');
    throw error;
  }
  assert.ok(result.coverLetter?.length > 100);
  assert.equal(result.creditsRemaining, 9);
  const history = await request('generations', 'GET', undefined, token);
  assert.equal(history[0].cover_letter_output, result.coverLetter);
  await request(`resumes/${resume.id}`, 'DELETE', undefined, token);
  assert.equal((await request('generations', 'GET', undefined, token)).length, 1);
  console.log('Verified real resume storage, OpenAI generation, credit charge, history, and resume deletion.');
  } else {
    await request(`resumes/${resume.id}`, 'DELETE', undefined, token);
    assert.equal((await request('resumes', 'GET', undefined, token)).length, 0);
    assert.equal((await request('generations', 'GET', undefined, token)).length, 0);
    assert.equal((await request('users/me', 'GET', undefined, token)).credits, 10);
    console.log('Verified resume deletion and empty history; no AI request was made.');
  }
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) { console.error('Test account cleanup failed; remove the synthetic smoke-test account in Supabase.'); process.exitCode = 1; }
    else console.log('Removed the synthetic test account and its associated data.');
  }
  server?.kill();
}
