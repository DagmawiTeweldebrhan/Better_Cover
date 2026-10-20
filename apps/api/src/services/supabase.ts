import { createClient } from '@supabase/supabase-js';
import type { GenerateInput, Generation, Profile, Resume } from '@better-cover/shared';
import type { Config } from '../config';
import { HttpError, type Services } from './contracts';
import { createWriter } from './llm';

export function createServices(config: Config): Services {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const db = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, options);
  // Each password/refresh operation gets a separate client: sessions must never be shared across requests.
  const auth = () => createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, options);
  const write = createWriter(config.OPENAI_API_KEY, config.OPENAI_MODEL);
  function check(error: { message: string; code?: string } | null) {
    if (!error) return;
    if (error.message.includes('NO_CREDITS')) throw new HttpError(402, 'No credits remaining this month.');
    if (error.message.includes('RESUME_NOT_FOUND')) throw new HttpError(404, 'Resume not found.');
    if (error.code === 'PGRST116') throw new HttpError(404, 'Record not found.');
    throw new HttpError(503, 'Storage is temporarily unavailable. Please try again.');
  }
  return {
    async authenticate(token) {
      const { data, error } = await auth().auth.getUser(token);
      if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
      return { id: data.user.id };
    },
    async login(email, password) {
      const { data, error } = await auth().auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new HttpError(401, 'Could not sign in. Check your credentials and email confirmation.');
      return data.session;
    },
    async signup(email, password) {
      const { data, error } = await auth().auth.signUp({ email, password });
      if (error) throw new HttpError(400, 'Could not create account. Check your details or try signing in.');
      return { confirmationRequired: !data.session, session: data.session };
    },
    async refresh(refreshToken) {
      const { data, error } = await auth().auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) throw new HttpError(401, 'Session expired. Please sign in again.');
      return data.session;
    },
    async profile(userId) {
      const { data, error } = await db.rpc('get_profile', { p_user: userId }); check(error);
      return data as Profile;
    },
    async resumes(userId) {
      const { data, error } = await db.from('resumes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }); check(error);
      return data as Resume[];
    },
    async saveResume(userId, input, id) {
      const query = id ? db.from('resumes').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
        : db.from('resumes').insert({ ...input, user_id: userId });
      const { data, error } = await query.select().single(); check(error); return data as Resume;
    },
    async deleteResume(userId, id) {
      const { data, error } = await db.from('resumes').delete().eq('id', id).eq('user_id', userId).select('id').single(); check(error);
      if (!data) throw new HttpError(404, 'Resume not found.');
    },
    async history(userId, offset) {
      const { data, error } = await db.from('generations').select('id,job_title,company_name,platform,cover_letter_output,created_at')
        .eq('user_id', userId).eq('status', 'completed').order('created_at', { ascending: false }).range(offset, offset + 19);
      check(error); return data as Generation[];
    },
    async deleteGeneration(userId, id) {
      const { error } = await db.from('generations').delete().eq('id', id).eq('user_id', userId).eq('status', 'completed').select('id').single(); check(error);
    },
    async generate(userId, input: GenerateInput) {
      const { data: resume, error: resumeError } = await db.from('resumes').select('content').eq('id', input.resumeId).eq('user_id', userId).single();
      check(resumeError);
      const { data: reservation, error } = await db.rpc('reserve_generation', {
        p_user: userId, p_resume: input.resumeId, p_title: input.jobTitle, p_company: input.companyName, p_platform: input.platform,
      }); check(error);
      try {
        const coverLetter = await write(input, resume!.content);
        const { data: credits, error: finishError } = await db.rpc('finish_generation', { p_user: userId, p_id: reservation, p_output: coverLetter });
        check(finishError);
        return { coverLetter, creditsRemaining: credits as number };
      } catch (error) {
        const { error: refundError } = await db.rpc('refund_generation', { p_user: userId, p_id: reservation });
        if (refundError) console.error('Credit refund deferred to expiry recovery.');
        throw error;
      }
    },
  };
}
