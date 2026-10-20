import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let db: PGlite;
const user = 'a1111111-1111-4111-8111-111111111111';
const other = 'b1111111-1111-4111-8111-111111111111';
const resume = 'c1111111-1111-4111-8111-111111111111';
async function scalar(sql: string, params: unknown[] = []) {
  const result = await db.query<Record<string, any>>(sql, params);
  return Object.values(result.rows[0])[0];
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('./migrations/202610200001_initial.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [user, 'one@example.com', other, 'two@example.com']);
  await db.query('insert into public.resumes(id,user_id,title,content) values ($1,$2,$3,$4)', [resume, user, 'Resume', 'Real experience in engineering and building useful applications.']);
}, 30000);
afterAll(async () => { await db?.close(); });
describe('database integrity and credit accounting', () => {
  it('creates an initial private profile with ten credits', async () => {
    expect(await scalar('select credits from public.users where id=$1', [user])).toBe(10);
  });
  it('rejects another account’s resume without charging', async () => {
    await expect(db.query('select public.reserve_generation($1,$2,$3,$4,$5)', [other, resume, 'Role', 'Company', 'Manual'])).rejects.toThrow('RESUME_NOT_FOUND');
    expect(await scalar('select credits from public.users where id=$1', [other])).toBe(10);
  });
  it('reserves, completes, and never refunds a completed generation', async () => {
    const id = await scalar('select public.reserve_generation($1,$2,$3,$4,$5)', [user, resume, 'Role', 'Company', 'Manual']);
    expect(await scalar('select credits from public.users where id=$1', [user])).toBe(9);
    expect(await scalar('select public.finish_generation($1,$2,$3)', [user, id, 'Dear hiring manager, here is my letter.'])).toBe(9);
    await db.query('select public.refund_generation($1,$2)', [user, id]);
    expect(await scalar('select credits from public.users where id=$1', [user])).toBe(9);
  });
  it('refunds failures only once', async () => {
    const id = await scalar('select public.reserve_generation($1,$2,$3,$4,$5)', [user, resume, 'Role', 'Company', 'Manual']);
    await db.query('select public.refund_generation($1,$2)', [user, id]);
    await db.query('select public.refund_generation($1,$2)', [user, id]);
    expect(await scalar('select credits from public.users where id=$1', [user])).toBe(9);
  });
  it('recovers abandoned reservations', async () => {
    const id = await scalar('select public.reserve_generation($1,$2,$3,$4,$5)', [user, resume, 'Role', 'Company', 'Manual']);
    await db.query("update public.generations set created_at=now()-interval '11 minutes' where id=$1", [id]);
    expect((await scalar('select public.get_profile($1)', [user])).credits).toBe(9);
    expect(await scalar('select status from public.generations where id=$1', [id])).toBe('failed');
  });
  it('prevents generation at zero credits', async () => {
    await db.query('update public.users set credits=0 where id=$1', [user]);
    await expect(db.query('select public.reserve_generation($1,$2,$3,$4,$5)', [user, resume, 'Role', 'Company', 'Manual'])).rejects.toThrow('NO_CREDITS');
  });
  it('renews credits on a new UTC month', async () => {
    await db.query("update public.users set credits_period=(date_trunc('month',now())-interval '1 month')::date where id=$1", [user]);
    expect((await scalar('select public.get_profile($1)', [user])).credits).toBe(10);
  });
  it('does not decrement premium credits', async () => {
    await db.query("update public.users set user_type='premium' where id=$1", [user]);
    await scalar('select public.reserve_generation($1,$2,$3,$4,$5)', [user, resume, 'Role', 'Company', 'Manual']);
    expect(await scalar('select credits from public.users where id=$1', [user])).toBe(10);
  });
  it('keeps history after a resume is deleted', async () => {
    await db.query('delete from public.resumes where id=$1', [resume]);
    expect(await scalar("select count(*)::int from public.generations where user_id=$1 and status='completed' and resume_id is null", [user])).toBe(1);
  });
  it('enforces row ownership and denies direct credit mutation and privileged RPCs', async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
    await db.exec('set role authenticated');
    try {
      expect(await scalar('select count(*)::int from public.users')).toBe(1);
      expect(await scalar('select count(*)::int from public.generations')).toBe(0);
      await expect(db.query('update public.users set credits=999')).rejects.toThrow('permission denied');
      await expect(db.query('select public.get_profile($1)', [user])).rejects.toThrow('permission denied');
    } finally { await db.exec('reset role'); }
  });
});
