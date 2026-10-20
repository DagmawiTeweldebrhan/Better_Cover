// Served only by the localhost demo server; never included in the extension build.
(() => {
  const key = 'better-cover-demo-v1';
  const now = new Date().toISOString();
  const job = { jobTitle: 'Frontend Engineer', companyName: 'Acme Studio', platform: 'LinkedIn', jobDescription: 'Join Acme Studio to build thoughtful, accessible web applications. Work with designers and engineers on React and TypeScript interfaces, improve performance, and deliver reliable experiences. We value collaboration, clear communication, and attention to usability.' };
  const initial = {
    signedIn: true,
    profile: { id: 'a1111111-1111-4111-8111-111111111111', email: 'demo@example.com', credits: 10, user_type: 'standard' },
    resumes: [{ id: 'b1111111-1111-4111-8111-111111111111', title: 'Frontend engineering — sample resume', content: 'Alex Morgan\nFrontend engineer\n\nBuilt accessible React and TypeScript applications. Worked with product designers to improve navigation and usability. Developed reusable UI components and collaborated with backend engineers on API integrations.\n\nSkills: React, TypeScript, HTML, CSS, accessibility, Git.', created_at: now, updated_at: now }],
    history: [],
    store: { draft: { job, selectedResume: 'b1111111-1111-4111-8111-111111111111', tone: 'professional', length: 'medium', custom: '', output: '' } },
  };
  let state;
  try { state = JSON.parse(sessionStorage.getItem(key)) || initial; } catch { state = initial; }
  const save = () => sessionStorage.setItem(key, JSON.stringify(state));
  const copy = data => data === undefined ? undefined : structuredClone(data);
  async function sendMessage(msg) {
    try {
      let data;
      if (msg.type === 'AUTH_STATUS') data = { signedIn: state.signedIn };
      else if (msg.type === 'LOGIN' || msg.type === 'SIGNUP') {
        state.signedIn = true; data = { signedIn: true };
      } else if (msg.type === 'OAUTH') throw new Error('Google sign-in requires configured Supabase credentials. Use the sample email sign-in in this preview.');
      else if (msg.type === 'LOGOUT') { state.signedIn = false; data = { signedIn: false }; }
      else if (msg.type === 'SCRAPE') data = job;
      else if (msg.type === 'API') {
        if (!state.signedIn) throw new Error('Sign in to the demo first.');
        const method = msg.method || 'GET';
        const url = new URL(msg.path, 'http://demo/');
        const [resource, id] = url.pathname.slice(1).split('/');
        if (resource === 'users') data = state.profile;
        else if (resource === 'resumes') {
          if (method === 'GET') data = state.resumes;
          else if (method === 'POST') {
            data = { ...msg.body, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            state.resumes.unshift(data);
          } else {
            const index = state.resumes.findIndex(item => item.id === id);
            if (index < 0) throw new Error('Resume not found.');
            if (method === 'DELETE') state.resumes.splice(index, 1);
            else if (method === 'PUT') { data = { ...state.resumes[index], ...msg.body, updated_at: new Date().toISOString() }; state.resumes[index] = data; }
          }
        } else if (resource === 'generations') {
          if (method === 'DELETE') state.history = state.history.filter(item => item.id !== id);
          else { const offset = Number(url.searchParams.get('offset') || 0); data = state.history.slice(offset, offset + 20); }
        } else if (resource === 'generate') {
          if (state.profile.credits < 1) throw new Error('Demo credits used. Open a fresh browser tab to reset this sample workspace.');
          await new Promise(resolve => setTimeout(resolve, 700));
          const coverLetter = `Dear Hiring Manager,\n\nI am writing to express my interest in the ${msg.body.jobTitle} position at ${msg.body.companyName}. My experience building accessible React and TypeScript applications aligns with the work described in this sample opportunity.\n\nIn my previous work, I collaborated with product designers to improve navigation and usability and developed reusable interface components. I also partnered with backend engineers on API integrations. These experiences gave me a practical foundation for contributing to thoughtful, reliable web products.\n\nI would welcome the opportunity to discuss how my frontend engineering experience could support your team. Thank you for your time and consideration.\n\nSincerely,\nAlex Morgan`;
          state.profile.credits--;
          state.history.unshift({ id: crypto.randomUUID(), job_title: msg.body.jobTitle, company_name: msg.body.companyName, platform: msg.body.platform, cover_letter_output: coverLetter, created_at: new Date().toISOString() });
          data = { success: true, coverLetter, creditsRemaining: state.profile.credits };
        } else throw new Error('This operation is unavailable in the sample preview.');
      } else throw new Error('Unknown demo action.');
      save(); return { ok: true, data: copy(data) };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  window.chrome = {
    runtime: { id: 'better-cover-local-demo', sendMessage },
    storage: { session: {
      get: async name => ({ [name]: copy(state.store[name]) }),
      set: async values => { Object.assign(state.store, copy(values)); save(); },
      remove: async name => { delete state.store[name]; save(); },
    } },
  };
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.textContent = 'DEMO PREVIEW · Sample data and letters · No live AI calls · Use sample information only';
    banner.style.cssText = 'background:#e9efdc;color:#435b30;text-align:center;padding:12px 18px;font:12px/1.6 system-ui;border-bottom:1px solid #c9d5b7';
    document.body.prepend(banner);
    document.title = 'Better Cover — sample preview';
  });
})();
