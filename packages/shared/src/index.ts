import { z } from 'zod';

export const resumeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(50, 'Resume must contain at least 50 characters.').max(40000),
});
export const jobSchema = z.object({
  jobTitle: z.string().trim().min(1).max(200),
  companyName: z.string().trim().min(1).max(200),
  jobDescription: z.string().trim().min(50, 'Add at least 50 characters of job description.').max(40000),
  platform: z.string().trim().max(60).default('Manual'),
});
export const generateSchema = jobSchema.extend({
  resumeId: z.string().uuid(),
  tone: z.enum(['professional', 'friendly', 'confident']).default('professional'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  customInstructions: z.string().trim().max(2000).default(''),
});
export type GenerateInput = z.infer<typeof generateSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Resume = z.infer<typeof resumeSchema> & { id: string; created_at: string; updated_at: string };
export type Profile = { id: string; email: string; credits: number; user_type: 'standard' | 'student' | 'premium' };
export type Generation = { id: string; job_title: string; company_name: string; platform: string; cover_letter_output: string; created_at: string };
export type GenerateResult = { success: true; coverLetter: string; creditsRemaining: number };
