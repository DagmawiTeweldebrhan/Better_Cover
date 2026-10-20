import type { GenerateInput, Generation, Profile, Resume } from '@better-cover/shared';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type ResumeInput = Pick<Resume, 'title' | 'content'>;
export interface Services {
  authenticate(token: string): Promise<{ id: string }>;
  login(email: string, password: string): Promise<unknown>;
  signup(email: string, password: string): Promise<{ confirmationRequired: boolean; session: unknown }>;
  refresh(refreshToken: string): Promise<unknown>;
  profile(userId: string): Promise<Profile>;
  resumes(userId: string): Promise<Resume[]>;
  saveResume(userId: string, input: ResumeInput, id?: string): Promise<Resume>;
  deleteResume(userId: string, id: string): Promise<void>;
  history(userId: string, offset: number): Promise<Generation[]>;
  deleteGeneration(userId: string, id: string): Promise<void>;
  generate(userId: string, input: GenerateInput): Promise<{ coverLetter: string; creditsRemaining: number }>;
}
