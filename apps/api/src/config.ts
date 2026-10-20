import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  ALLOWED_ORIGINS: z.string().min(1).transform(s => s.split(',').map(x => x.trim()).filter(Boolean))
    .refine(origins => origins.length > 0 && origins.every(origin => /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)), 'Use exact extension IDs or localhost development origins.'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env = process.env): Config { return schema.parse(env); }
