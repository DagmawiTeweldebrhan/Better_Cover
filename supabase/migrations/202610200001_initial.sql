-- Apply in Supabase SQL Editor or with `supabase db push`.
create type public.user_type as enum ('standard', 'student', 'premium');
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  credits integer not null default 10 check (credits >= 0),
  user_type public.user_type not null default 'standard',
  credits_period date not null default date_trunc('month', now() at time zone 'UTC')::date,
  created_at timestamptz not null default now()
);
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  content text not null check (length(content) between 50 and 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resumes_user_idx on public.resumes(user_id, updated_at desc);
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  job_title text not null,
  company_name text not null,
  platform text not null,
  cover_letter_output text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  charged boolean not null default true,
  credits_period date not null,
  created_at timestamptz not null default now()
);
create index generations_user_idx on public.generations(user_id, created_at desc);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id, email) values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
create function public.sync_user_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger on_auth_email_changed after update of email on auth.users
for each row execute function public.sync_user_email();
-- Also support users created before this migration.
insert into public.users(id, email) select id, email from auth.users where email is not null on conflict (id) do nothing;

alter table public.users enable row level security;
alter table public.resumes enable row level security;
alter table public.generations enable row level security;
revoke all on public.users, public.resumes, public.generations from anon, authenticated;
grant select on public.users, public.resumes, public.generations to authenticated;
create policy own_profile on public.users for select to authenticated using ((select auth.uid()) = id);
create policy own_resumes on public.resumes for select to authenticated using ((select auth.uid()) = user_id);
create policy own_generations on public.generations for select to authenticated using ((select auth.uid()) = user_id and status = 'completed');
grant all on public.users, public.resumes, public.generations to service_role;

-- Lock the profile before touching generation rows in every RPC to avoid deadlocks.
-- Expired reservations recover automatically on the next profile read or generation.
create function public.get_profile(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  profile public.users;
  recovered integer;
  period date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  select * into strict profile from public.users where id = p_user for update;
  if profile.credits_period < period then
    update public.users set credits = 10, credits_period = period where id = p_user returning * into profile;
  end if;
  with expired as (
    update public.generations set status = 'failed'
    where user_id = p_user and status = 'pending' and created_at < now() - interval '10 minutes'
    returning charged, credits_period
  ) select count(*) into recovered from expired where charged and credits_period = period;
  update public.users set credits = credits + recovered where id = p_user returning * into profile;
  return jsonb_build_object('id', profile.id, 'email', profile.email, 'credits', profile.credits, 'user_type', profile.user_type);
end;
$$;
create function public.reserve_generation(p_user uuid, p_resume uuid, p_title text, p_company text, p_platform text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare profile public.users; generation_id uuid;
begin
  perform public.get_profile(p_user);
  select * into strict profile from public.users where id = p_user for update;
  perform 1 from public.resumes where id = p_resume and user_id = p_user for key share;
  if not found then raise exception 'RESUME_NOT_FOUND'; end if;
  if profile.user_type <> 'premium' and profile.credits < 1 then raise exception 'NO_CREDITS'; end if;
  if profile.user_type <> 'premium' then update public.users set credits = credits - 1 where id = p_user; end if;
  insert into public.generations(user_id, resume_id, job_title, company_name, platform, charged, credits_period)
  values (p_user, p_resume, p_title, p_company, p_platform, profile.user_type <> 'premium', profile.credits_period)
  returning id into generation_id;
  return generation_id;
end;
$$;
create function public.finish_generation(p_user uuid, p_id uuid, p_output text) returns integer
language plpgsql security definer set search_path = '' as $$
declare remaining integer;
begin
  select credits into strict remaining from public.users where id = p_user for update;
  if length(trim(p_output)) = 0 then raise exception 'EMPTY_OUTPUT'; end if;
  update public.generations set cover_letter_output = p_output, status = 'completed'
  where id = p_id and user_id = p_user and status = 'pending';
  if not found then raise exception 'RESERVATION_NOT_PENDING'; end if;
  return remaining;
end;
$$;
create function public.refund_generation(p_user uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.generations; profile public.users;
begin
  select * into strict profile from public.users where id = p_user for update;
  update public.generations set status = 'failed' where id = p_id and user_id = p_user and status = 'pending' returning * into item;
  if found and item.charged and item.credits_period = profile.credits_period then
    update public.users set credits = credits + 1 where id = p_user;
  end if;
end;
$$;

-- Only the backend can mutate credits or invoke account-scoped RPCs.
revoke execute on function public.get_profile(uuid), public.reserve_generation(uuid,uuid,text,text,text),
  public.finish_generation(uuid,uuid,text), public.refund_generation(uuid,uuid),
  public.handle_new_user(), public.sync_user_email() from public, anon, authenticated;
grant execute on function public.get_profile(uuid), public.reserve_generation(uuid,uuid,text,text,text),
  public.finish_generation(uuid,uuid,text), public.refund_generation(uuid,uuid) to service_role;
