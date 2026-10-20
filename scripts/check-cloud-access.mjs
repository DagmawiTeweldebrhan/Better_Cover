import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

async function readEnv(path) {
  try { return parseEnv(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
const provisioning = Object.fromEntries(Object.entries(await readEnv('.env.provision')).filter(([, value]) => value.trim() !== ''));
const env = { ...await readEnv('apps/api/.env'), ...provisioning, ...process.env };
const configured = key => typeof env[key] === 'string' && env[key].trim() !== '' && !/your-|YOUR_|your_|example|placeholder/i.test(env[key]);
const required = ['SUPABASE_ACCESS_TOKEN', 'RENDER_API_KEY', 'OPENAI_API_KEY'];
const missing = required.filter(key => !configured(key));
if (missing.length) {
  console.error(`Missing credentials: ${missing.join(', ')}. Fill .env.provision locally; do not send secrets in chat.`);
  process.exitCode = 1;
} else {
  const checks = [
    { name: 'Supabase', url: 'https://api.supabase.com/v1/organizations', key: 'SUPABASE_ACCESS_TOKEN' },
    { name: 'Render', url: 'https://api.render.com/v1/owners?limit=20', key: 'RENDER_API_KEY' },
  ];
  const results = await Promise.allSettled(checks.map(async check => {
    const response = await fetch(check.url, {
      headers: { Authorization: `Bearer ${env[check.key]}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`${check.name} access check returned HTTP ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error(`${check.name} token exposes no organizations or workspaces.`);
    console.log(`${check.name}: account access verified (${data.length} organization/workspace entries).`);
  }));
  for (const result of results) if (result.status === 'rejected') {
    console.error(result.reason instanceof Error ? result.reason.message : 'Cloud access check failed.');
    process.exitCode = 1;
  }
  console.log('OpenAI: server key is present; this check does not make a paid generation request.');
}
