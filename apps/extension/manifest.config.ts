import { defineManifest } from '@crxjs/vite-plugin';

export const jobMatches = [
  '*://*.linkedin.com/*', '*://*.indeed.com/*', '*://*.greenhouse.io/*',
  '*://*.lever.co/*', '*://*.joinhandshake.com/*',
];
export function manifest(apiUrl: string, publicKey?: string) {
  const api = new URL(apiUrl);
  if (api.protocol !== 'https:' && !(api.protocol === 'http:' && api.hostname === 'localhost')) {
    throw new Error('API URL must use HTTPS (except localhost development).');
  }
  return defineManifest({
    manifest_version: 3, name: 'Better Cover', version: '1.0.0',
    description: 'Turn your experience and a job description into a tailored cover letter.',
    minimum_chrome_version: '116',
    ...(publicKey ? { key: publicKey } : {}),
    permissions: ['activeTab', 'storage', 'sidePanel', 'identity', 'scripting'],
    host_permissions: [...jobMatches, `${api.origin}/*`],
    action: { default_title: 'Open Better Cover' },
    side_panel: { default_path: 'index.html' },
    background: { service_worker: 'src/background/index.ts', type: 'module' },
    content_scripts: [{ matches: jobMatches, js: ['src/content/index.ts'], run_at: 'document_idle' }],
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
  });
}
