import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { generateSchema, resumeSchema } from '@better-cover/shared';
import type { Config } from './config';
import { HttpError, type Services } from './services/contracts';

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
const uuid = z.string().uuid();
export function createApp(config: Pick<Config, 'ALLOWED_ORIGINS' | 'TRUST_PROXY_HOPS'>, services: Services) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(cors({ origin(origin, done) {
    if (!origin || config.ALLOWED_ORIGINS.includes(origin)) done(null, true);
    else done(new HttpError(403, 'Origin is not allowed.'));
  } }));
  app.use(express.json({ limit: '256kb' }));
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many authentication attempts. Try again later.' } });
  app.use('/api/auth', authLimiter);
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    res.json(await services.login(email, password));
  });
  app.post('/api/auth/signup', async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    res.status(201).json(await services.signup(email, password));
  });
  app.post('/api/auth/refresh', async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1).max(4096) }).parse(req.body);
    res.json(await services.refresh(refreshToken));
  });
  app.use('/api', async (req, res, next) => {
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new HttpError(401, 'Sign in to continue.');
    const user = await services.authenticate(match[1]);
    res.locals.userId = user.id;
    next();
  });
  app.get('/api/users/me', async (_req, res) => { res.json(await services.profile(res.locals.userId)); });
  app.get('/api/resumes', async (_req, res) => { res.json(await services.resumes(res.locals.userId)); });
  app.post('/api/resumes', async (req, res) => { res.status(201).json(await services.saveResume(res.locals.userId, resumeSchema.parse(req.body))); });
  app.put('/api/resumes/:id', async (req, res) => { res.json(await services.saveResume(res.locals.userId, resumeSchema.parse(req.body), uuid.parse(req.params.id))); });
  app.delete('/api/resumes/:id', async (req, res) => {
    await services.deleteResume(res.locals.userId, uuid.parse(req.params.id)); res.status(204).end();
  });
  app.get('/api/generations', async (req, res) => {
    const offset = z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
    res.json(await services.history(res.locals.userId, offset));
  });
  app.delete('/api/generations/:id', async (req, res) => {
    await services.deleteGeneration(res.locals.userId, uuid.parse(req.params.id)); res.status(204).end();
  });
  app.post('/api/generate', rateLimit({ windowMs: 60 * 1000, limit: 5, keyGenerator: (_req, res) => res.locals.userId,
    standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Generation limit reached. Wait a minute and try again.' } }), async (req, res) => {
    const result = await services.generate(res.locals.userId, generateSchema.parse(req.body));
    res.json({ success: true, ...result });
  });
  app.use((_req, _res, next) => { next(new HttpError(404, 'Route not found.')); });
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) { res.status(400).json({ error: err.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ') }); return; }
    const status = err instanceof HttpError ? err.status : err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
    if (status >= 500) console.error('Request failed:', err.name ?? 'Error', err.code ?? 'internal');
    res.status(status).json({ error: err instanceof HttpError ? err.message : status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid JSON.' : 'The request could not be completed. Please try again.' });
  };
  app.use(errors);
  return app;
}
