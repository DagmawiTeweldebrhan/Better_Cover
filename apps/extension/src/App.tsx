import { useEffect, useState, type FormEvent } from 'react';
import { generateSchema, resumeSchema, type Generation, type GenerateInput, type GenerateResult, type Job, type Profile, type Resume } from '@better-cover/shared';
import { api, message } from './lib/client';

type Tab = 'write' | 'resumes' | 'history';
const localMode = import.meta.env.VITE_DRAFT_MODE !== 'cloud';
const emptyJob: Job = { jobTitle: '', companyName: '', jobDescription: '', platform: 'Manual' };
const emptyResume = { title: '', content: '' };
type Draft = { job: Job; selectedResume: string; tone: GenerateInput['tone']; length: GenerateInput['length']; custom: string; output: string };
const failMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('write');
  const [profile, setProfile] = useState<Profile>();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [history, setHistory] = useState<Generation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [job, setJob] = useState<Job>(emptyJob);
  const [selectedResume, setSelectedResume] = useState('');
  const [tone, setTone] = useState<GenerateInput['tone']>('professional');
  const [length, setLength] = useState<GenerateInput['length']>('medium');
  const [custom, setCustom] = useState('');
  const [output, setOutput] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [editingResume, setEditingResume] = useState<string>();
  const [resumeForm, setResumeForm] = useState(emptyResume);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string>();

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (error) { setError(failMessage(error)); }
    finally { setBusy(''); }
  }
  async function loadAccount() {
    const [user, saved] = await Promise.all([api<Profile>('users/me'), api<Resume[]>('resumes')]);
    setProfile(user); setResumes(saved);
    setSelectedResume(current => saved.some(r => r.id === current) ? current : saved[0]?.id || '');
  }
  useEffect(() => {
    void (async () => {
      try {
        const status = await message<{ signedIn: boolean }>('AUTH_STATUS');
        setSignedIn(status.signedIn);
        if (status.signedIn) await loadAccount();
      } catch (error) { setError(failMessage(error)); }
      finally { setInitializing(false); }
    })();
    if (globalThis.chrome?.storage?.session) {
      void chrome.storage.session.get('draft').then(({ draft }) => {
        if (draft) {
          const d = draft as Draft;
          setJob(d.job || emptyJob); setSelectedResume(d.selectedResume || ''); setTone(d.tone || 'professional');
          setLength(d.length || 'medium'); setCustom(d.custom || ''); setOutput(d.output || '');
        }
        setDraftReady(true);
      });
    } else setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady || !signedIn || !globalThis.chrome?.storage?.session) return;
    const timer = setTimeout(() => { void chrome.storage.session.set({ draft: { job, selectedResume, tone, length, custom, output } }); }, 350);
    return () => clearTimeout(timer);
  }, [draftReady, signedIn, job, selectedResume, tone, length, custom, output]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    await run(signup ? 'Creating account…' : 'Signing in…', async () => {
      const result = await message<{ signedIn: boolean; confirmationRequired?: boolean }>(signup ? 'SIGNUP' : 'LOGIN', { email, password });
      setPassword(''); setSignedIn(result.signedIn);
      if (result.confirmationRequired) { setSignup(false); setNotice('Check your email to confirm your account, then sign in.'); }
      if (result.signedIn) await loadAccount();
    });
  }
  async function logout() {
    await message('LOGOUT');
    await chrome.storage.session.remove('draft');
    setSignedIn(false); setProfile(undefined); setResumes([]); setHistory([]); setOutput('');
    setJob(emptyJob); setSelectedResume(''); setResumeForm(emptyResume); setEditingResume(undefined); setPassword(''); setCustom('');
  }
  async function saveResume(event: FormEvent) {
    event.preventDefault();
    await run('Saving resume…', async () => {
      const parsed = resumeSchema.safeParse(resumeForm);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const saved = await api<Resume>(editingResume ? `resumes/${editingResume}` : 'resumes', editingResume ? 'PUT' : 'POST', parsed.data);
      await loadAccount(); setSelectedResume(saved.id); setResumeForm(emptyResume); setEditingResume(undefined); setNotice('Resume saved.');
    });
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    await run('Writing your letter…', async () => {
      const parsed = generateSchema.safeParse({ ...job, resumeId: selectedResume, tone, length, customInstructions: custom });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const result = await api<GenerateResult>('generate', 'POST', parsed.data);
      setOutput(result.coverLetter); setProfile(current => current && { ...current, credits: result.creditsRemaining });
      setNotice(localMode ? 'Your template draft is ready. Review the matched excerpts and apply any editing notes before sending.' : 'Your letter is ready. Review the details before sending.');
    });
  }
  async function loadHistory(more = false) {
    const items = await api<Generation[]>(`generations?offset=${more ? history.length : 0}`);
    setHistory(current => more ? [...current, ...items] : items); setHasMore(items.length === 20);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `cover-letter-${job.companyName || 'draft'}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const disabled = !!busy;
  const words = output.trim() ? output.trim().split(/\s+/).length : 0;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('write'); }} aria-label="Better Cover home"><span className="brand-mark">b<span>c</span></span><span>better<span className="font-normal">cover</span><small>A LITTLE CLOSER TO YOUR NEXT CHAPTER</small></span></a>
      {signedIn && !localMode && <button className="text-button" disabled={disabled} onClick={() => void run('Signing out…', logout)}>Sign out</button>}
    </header>
    {error && <div role="alert" className="message error">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
    {notice && <div role="status" className="message success">{notice}</div>}
    {initializing ? <main className="loading" aria-busy="true"><span className="spinner"/> Opening your workspace…</main> : !signedIn ? <main className="auth-view">
      <div className="eyebrow"><span className="dot"/> YOUR EXPERIENCE. THE RIGHT WORDS.</div>
      <h1>Your next chapter<br/>starts with <em>hello.</em></h1>
      <p className="intro">A thoughtful cover letter, grounded in your experience and tailored to the opportunity.</p>
      <div className="auth-card"><h2>{signup ? 'Create your workspace' : 'Welcome back'}</h2><p className="muted">{signup ? 'Start with 10 free letters each month.' : 'Make your next application feel like you.'}</p>
        <form onSubmit={authenticate}><label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label>Password<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          <button className="primary w-full" disabled={disabled}>{busy || (signup ? 'Create account →' : 'Sign in →')}</button>
        </form><div className="divider">or</div>
        <button className="secondary w-full" disabled={disabled} onClick={() => void run('Opening Google…', async () => { await message('OAUTH'); setSignedIn(true); await loadAccount(); })}>Continue with Google</button>
        <p className="auth-switch">{signup ? 'Already have an account?' : 'New here?'} <button disabled={disabled} className="text-button" onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Sign in' : 'Create an account'}</button></p>
      </div><p className="footnote">Your resume stays in your account. Job details are read only when you ask.</p>
    </main> : <>
      <div className="account-strip"><span className="truncate">{localMode ? 'Private workspace on this browser' : profile?.email || 'Your workspace'}</span><span className="credit-pill"><span className="dot"/>{localMode ? 'Free local drafts' : profile?.user_type === 'premium' ? 'Unlimited letters' : `${profile?.credits ?? '—'} letters left`}</span></div>
      <nav className="tabs" aria-label="Workspace"><button disabled={disabled} className={tab === 'write' ? 'active' : ''} onClick={() => setTab('write')}>Write a letter</button><button disabled={disabled} className={tab === 'resumes' ? 'active' : ''} onClick={() => setTab('resumes')}>My resumes <span>{resumes.length}</span></button><button disabled={disabled} className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); void run('Loading history…', () => loadHistory()); }}>History</button></nav>
      <main className="workspace">
      {localMode && <p className="muted">Template mode: no account, AI service, or generation fees. Resumes and history stay in this browser. Templates use matching skills and resume excerpts; review and edit every draft.</p>}
      {tab === 'write' && <>
        <div className="page-heading"><div className="eyebrow">MAKE A GOOD FIRST IMPRESSION</div><h1>Open the <em>right door.</em></h1><p className="muted">Your experience, shaped for this opportunity.</p></div>
        <form onSubmit={generate}>
          <section className="card"><div className="section-heading"><span className="step">01</span><h2>The opportunity</h2><span className="tag">{job.platform}</span></div>
            <button type="button" className="scrape-button" disabled={disabled} onClick={() => void run('Reading job details…', async () => {
              const data = await message<Job>('SCRAPE'); setJob(data);
              setNotice(data.jobDescription.length >= 50 ? 'Job details imported. Check the fields below.' : 'Some details could not be read. Fill in the missing fields below.');
            })}><span>↙</span> Use job from current tab <span className="ml-auto">↗</span></button>
            <div className="field-grid"><label>Job title<input required maxLength={200} value={job.jobTitle} onChange={e => setJob({ ...job, jobTitle: e.target.value })} placeholder="e.g. Product Designer"/></label><label>Company<input required maxLength={200} value={job.companyName} onChange={e => setJob({ ...job, companyName: e.target.value })} placeholder="e.g. Acme"/></label></div>
            <label>Job description<textarea required minLength={50} maxLength={40000} rows={6} value={job.jobDescription} onChange={e => setJob({ ...job, jobDescription: e.target.value })} placeholder="Paste the job description, or import it from a supported job board…"/></label>
            <div className="field-hint">LinkedIn · Indeed · Greenhouse · Lever · Handshake</div>
          </section>
          <section className="card"><div className="section-heading"><span className="step">02</span><h2>Your experience</h2></div>
            {resumes.length ? <label>Choose a resume<select value={selectedResume} required onChange={e => setSelectedResume(e.target.value)}>{resumes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label> : <div className="empty-state small"><p>Add your resume to give your letter something real to draw from.</p><button className="secondary" type="button" disabled={disabled} onClick={() => setTab('resumes')}>+ Add your first resume</button></div>}
          </section>
          <section className="card"><div className="section-heading"><span className="step">03</span><h2>Make it sound like you</h2></div>
            <label>Tone<div className="segmented">{(['professional', 'friendly', 'confident'] as const).map(value => <button type="button" key={value} className={tone === value ? 'selected' : ''} aria-pressed={tone === value} onClick={() => setTone(value)}>{value}</button>)}</div></label>
            <label>Letter length <span className="muted font-normal">{localMode ? `${({ short: 1, medium: 2, long: 3 })[length]} matching resume excerpt${length === 'short' ? '' : 's'} maximum` : `${({ short: '150–200', medium: '250–350', long: '400–500' })[length]} words`}</span><input aria-label="Letter length" type="range" min="0" max="2" step="1" value={['short', 'medium', 'long'].indexOf(length)} onChange={e => setLength((['short', 'medium', 'long'] as const)[Number(e.target.value)])}/><div className="range-labels"><span>Brief</span><span>Balanced</span><span>Detailed</span></div></label>
            <label>{localMode ? 'Editing notes' : 'Anything else?'} <span className="muted font-normal">Optional</span><textarea maxLength={2000} rows={3} value={custom} onChange={e => setCustom(e.target.value)} placeholder="Focus on my leadership experience. Keep the opening direct…"/></label>
            {localMode && <p className="field-hint">Notes are reminders for your edits. Templates do not interpret custom instructions automatically.</p>}
          </section>
          <button className="primary generate-button" disabled={disabled || !resumes.length || (!localMode && profile?.credits === 0 && profile.user_type !== 'premium')}>{busy === 'Writing your letter…' ? <><span className="spinner"/> Writing your letter…</> : <>✦ {localMode ? 'Create my template draft' : 'Generate my cover letter'} <span>→</span></>}</button>
          <p className="footnote">{localMode ? 'Free to use. Your resume and job details stay in this browser.' : 'One letter, one credit. Your experience is the source of every claim.'}</p>
        </form>
        {output && <section className="card result-card"><div className="section-heading"><span className="dot"/><h2>Your next introduction</h2><span className="tag">{words} words</span></div><label className="sr-only" htmlFor="letter">Edit your cover letter</label><textarea id="letter" className="letter-editor" value={output} rows={18} onChange={e => setOutput(e.target.value)}/><div className="result-actions"><button className="primary" disabled={disabled} onClick={() => void run('Copying…', async () => { await navigator.clipboard.writeText(output); setNotice('Letter copied to clipboard.'); })}>Copy letter</button><button className="secondary" onClick={download}>Download .txt</button></div><p className="field-hint">Edits are kept in this browser session. History keeps the original generated letter.</p></section>}
      </>}
      {tab === 'resumes' && <>
        <div className="page-heading"><div className="eyebrow">THE EXPERIENCE BEHIND THE WORDS</div><h1>Your story, <em>on file.</em></h1><p className="muted">Keep a version for every direction you want to go.</p></div>
        <div className="resume-list">{resumes.map(resume => <article className="resume-item" key={resume.id}><span className="document-icon">≡</span><div className="min-w-0 flex-1"><h3 className="truncate">{resume.title}</h3><p className="muted">Updated {new Date(resume.updated_at).toLocaleDateString()}</p></div><button className="text-button" disabled={disabled} onClick={() => { setEditingResume(resume.id); setResumeForm({ title: resume.title, content: resume.content }); }}>Edit</button><button className="text-button danger" disabled={disabled} onClick={() => setConfirmDelete(resume.id)}>Delete</button>
          {confirmDelete === resume.id && <div className="delete-confirm"><span>Delete this resume? Saved letters will remain.</span><button className="danger text-button" disabled={disabled} onClick={() => void run('Deleting…', async () => { await api(`resumes/${resume.id}`, 'DELETE'); await loadAccount(); setConfirmDelete(undefined); if (editingResume === resume.id) { setEditingResume(undefined); setResumeForm(emptyResume); } })}>Delete resume</button><button className="text-button" onClick={() => setConfirmDelete(undefined)}>Cancel</button></div>}
        </article>)}</div>
        <section className="card"><h2>{editingResume ? 'Edit resume' : 'Add a resume'}</h2><p className="muted mb-5">Paste your resume text or import a .txt / .md file.</p><form onSubmit={saveResume}>
          <label>Resume name<input required maxLength={120} value={resumeForm.title} onChange={e => setResumeForm({ ...resumeForm, title: e.target.value })} placeholder="e.g. Frontend engineering"/></label>
          <label className="file-upload">Import a text file<input type="file" accept=".txt,.md,text/plain,text/markdown" disabled={disabled} onChange={e => {
            const file = e.target.files?.[0]; if (!file) return;
            void run('Reading resume…', async () => {
              if (file.size > 160000) throw new Error('Choose a text file smaller than 160 KB.');
              const text = await file.text(); if (text.length > 40000 || text.includes('\u0000')) throw new Error('Use a text or Markdown resume up to 40,000 characters.');
              setResumeForm(current => ({ title: current.title || file.name.replace(/\.(txt|md)$/i, '').slice(0, 120), content: text }));
            }); e.target.value = '';
          }}/></label>
          <label>Resume content<textarea required minLength={50} maxLength={40000} rows={12} value={resumeForm.content} onChange={e => setResumeForm({ ...resumeForm, content: e.target.value })} placeholder="Your experience, education, skills, and achievements…"/></label><div className="result-actions"><button className="primary" disabled={disabled}>{busy || (editingResume ? 'Save changes' : 'Save resume')}</button>{editingResume && <button type="button" className="secondary" disabled={disabled} onClick={() => { setEditingResume(undefined); setResumeForm(emptyResume); }}>Cancel</button>}</div>
        </form></section>
      </>}
      {tab === 'history' && <>
        <div className="page-heading"><div className="eyebrow">EVERY OPPORTUNITY, REMEMBERED</div><h1>The letters <em>so far.</em></h1><p className="muted">Revisit an introduction. Find your next starting point.</p></div>
        {!history.length && <div className="empty-state"><span className="empty-symbol">↗</span><h2>A fresh page.</h2><p>Your generated letters will appear here.</p><button className="secondary" disabled={disabled} onClick={() => setTab('write')}>Write your first letter</button></div>}
        {history.map(item => <article className="card history-item" key={item.id}><div className="eyebrow">{item.platform} · {new Date(item.created_at).toLocaleDateString()}</div><h2>{item.job_title}</h2><p className="muted">{item.company_name}</p><p className="letter-preview">{item.cover_letter_output.slice(0, 170)}…</p><div className="result-actions"><button className="secondary" disabled={disabled} onClick={() => { setOutput(item.cover_letter_output); setJob({ ...emptyJob, jobTitle: item.job_title, companyName: item.company_name, platform: item.platform }); setTab('write'); }}>Open letter ↗</button><button className="text-button danger" disabled={disabled} onClick={() => setConfirmDelete(item.id)}>Delete</button></div>
          {confirmDelete === item.id && <div className="delete-confirm"><span>Delete this saved letter?</span><button className="danger text-button" disabled={disabled} onClick={() => void run('Deleting…', async () => { await api(`generations/${item.id}`, 'DELETE'); setHistory(current => current.filter(x => x.id !== item.id)); setConfirmDelete(undefined); })}>Delete letter</button><button className="text-button" onClick={() => setConfirmDelete(undefined)}>Cancel</button></div>}
        </article>)}{hasMore && <button className="secondary w-full" disabled={disabled} onClick={() => void run('Loading history…', () => loadHistory(true))}>Load more letters</button>}
      </>}
      </main><footer className="workspace-footer"><span className="brand-dot">bc.</span><span>A better beginning.</span><span>Made for your next move ↗</span></footer>
    </>}
    {busy && <div className="activity" role="status"><span className="spinner"/>{busy}</div>}
  </div>;
}
