import { createTemplateDraft, generateSchema, resumeSchema, type Generation, type Profile, type Resume } from '@better-cover/shared';

type Workspace = { resumes: Resume[]; history: Generation[] };
const key = 'localWorkspace';
let queue: Promise<unknown> = Promise.resolve();
export function localRequest(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const operation = queue.then(async () => {
    const stored = await chrome.storage.local.get(key);
    const workspace: Workspace = (stored[key] as Workspace | undefined) || { resumes: [], history: [] };
    const url = new URL(path, 'https://local.invalid/');
    const [resource, id] = url.pathname.slice(1).split('/');
    let result: unknown;
    let changed = false;
    if (path === 'users/me' && method === 'GET') {
      return { id: 'local', email: 'Stored on this browser', credits: 0, user_type: 'premium' } satisfies Profile;
    }
    if (resource === 'resumes' && !id && method === 'GET') return workspace.resumes;
    if (resource === 'resumes' && method === 'POST' && !id) {
      const input = resumeSchema.parse(body); const now = new Date().toISOString();
      result = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now } satisfies Resume;
      workspace.resumes.unshift(result as Resume); changed = true;
    } else if (resource === 'resumes' && id && ['PUT', 'DELETE'].includes(method)) {
      const index = workspace.resumes.findIndex(resume => resume.id === id);
      if (index < 0) throw new Error('Resume not found.');
      if (method === 'DELETE') workspace.resumes.splice(index, 1);
      else {
        result = { ...workspace.resumes[index], ...resumeSchema.parse(body), updated_at: new Date().toISOString() };
        workspace.resumes.splice(index, 1); workspace.resumes.unshift(result as Resume);
      }
      changed = true;
    } else if (resource === 'generations' && method === 'GET' && !id) {
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid history page.');
      return workspace.history.slice(offset, offset + 20);
    } else if (resource === 'generations' && id && method === 'DELETE') {
      const index = workspace.history.findIndex(item => item.id === id);
      if (index < 0) throw new Error('Letter not found.');
      workspace.history.splice(index, 1); changed = true;
    } else if (path === 'generate' && method === 'POST') {
      const parsed = generateSchema.parse(body);
      const resume = workspace.resumes.find(item => item.id === parsed.resumeId);
      if (!resume) throw new Error('Choose a saved resume first.');
      const coverLetter = createTemplateDraft(parsed, resume.content);
      workspace.history.unshift({ id: crypto.randomUUID(), job_title: parsed.jobTitle, company_name: parsed.companyName, platform: parsed.platform, cover_letter_output: coverLetter, created_at: new Date().toISOString() });
      result = { success: true, coverLetter, creditsRemaining: 0 }; changed = true;
    } else throw new Error('Unsupported local workspace request.');
    if (changed) await chrome.storage.local.set({ [key]: workspace });
    return result;
  });
  queue = operation.catch(() => undefined);
  return operation;
}
