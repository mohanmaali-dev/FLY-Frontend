-- ============================================================================
-- FLY — Supabase schema
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). It is idempotent: re-running it is safe.
--
-- Pairing backend:
--   sessions  -> public.pairing_sessions (device list lives in Realtime
--                Presence, messages in Realtime Broadcast — no table needed)
--   files     -> private `pairing-files` Storage bucket
-- ============================================================================

-- ---------------------------------------------------------------------------
-- pairing_sessions
--
-- Only the session's existence and expiry live here. The connected device list
-- is Realtime Presence and the shared items are Realtime Broadcast, so neither
-- needs a table — which also means shared content is never written to disk.
--
-- Note there is deliberately NO blanket SELECT policy: a session is readable
-- only through get_pairing_session(uuid), so knowing the id is required. A
-- plain `select * from pairing_sessions` returns nothing.
-- ---------------------------------------------------------------------------

create table if not exists public.pairing_sessions (
  id         uuid primary key default gen_random_uuid(),
  status     text not null default 'waiting' check (status in ('waiting', 'paired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

-- Short human-typeable join code, so a second laptop can pair without anyone
-- retyping a 36-character UUID. Added separately so re-running this file over
-- an existing database works.
alter table public.pairing_sessions
  add column if not exists code text;

create unique index if not exists pairing_sessions_code_key
  on public.pairing_sessions (code);

create index if not exists pairing_sessions_expires_at_idx
  on public.pairing_sessions (expires_at);

alter table public.pairing_sessions enable row level security;

-- Crockford base32: no I, L, O or U, so nothing is misread off a screen.
-- 32^6 = 1.07 billion combinations. Six digits would only be a million, which
-- a script could enumerate — and the code grants full access to the session.
--
-- Randomness comes from gen_random_uuid()'s bytes rather than random(), which
-- is a seeded PRNG. 256 divides evenly by 32, so the modulo introduces no bias.
create or replace function public.generate_pairing_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := '';
  i integer;
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;

  return code;
end;
$$;

-- There are deliberately NO table policies at all: every access goes through
-- the SECURITY DEFINER functions below. A direct select/insert/update from the
-- browser returns nothing, which is what keeps sessions unlistable.
--
-- (Creation must be a function rather than a plain insert, because PostgREST's
-- `insert().select()` needs a SELECT policy to return the new row — and adding
-- one would make every session readable.)

-- These are dropped rather than replaced because their RETURNS TABLE shape has
-- changed (the `code` column was added). CREATE OR REPLACE can change a
-- function's body but never its return type — it fails with
-- "cannot change return type of existing function". Dropping first keeps this
-- file re-runnable over an older database.
drop function if exists public.create_pairing_session();
drop function if exists public.get_pairing_session(uuid);
drop function if exists public.get_pairing_session_by_code(text);

-- FLY has no account requirement, so anonymous visitors may open a session.
create or replace function public.create_pairing_session()
returns table (
  id uuid,
  code text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
-- The RETURNS TABLE columns become OUT variables that shadow the identically
-- named table columns; this tells plpgsql to read them as columns.
#variable_conflict use_column
declare
  attempt integer := 0;
begin
  -- Codes are random, so a collision with a live session is possible even if
  -- vanishingly unlikely. Retry rather than fail the request.
  loop
    attempt := attempt + 1;

    begin
      return query
      insert into public.pairing_sessions (code)
      values (public.generate_pairing_code())
      returning
        pairing_sessions.id,
        pairing_sessions.code,
        pairing_sessions.status,
        pairing_sessions.created_at,
        pairing_sessions.expires_at;

      return;
    exception when unique_violation then
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

grant execute on function public.create_pairing_session() to anon, authenticated;

-- Joining by the short code. Same shape and same guarantees as looking up by
-- id: one row, only while the session is live.
create or replace function public.get_pairing_session_by_code(session_code text)
returns table (
  id uuid,
  code text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.code, s.status, s.created_at, s.expires_at
  from public.pairing_sessions s
  where s.code = upper(regexp_replace(coalesce(session_code, ''), '[^0-9A-Za-z]', '', 'g'))
    and s.expires_at > now();
$$;

grant execute on function public.get_pairing_session_by_code(text) to anon, authenticated;

-- Reading a session by id. SECURITY DEFINER so it bypasses the (absent) select
-- policy, but it can only ever return the single row whose id you already have.
create or replace function public.get_pairing_session(session_id uuid)
returns table (
  id uuid,
  code text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.code, s.status, s.created_at, s.expires_at
  from public.pairing_sessions s
  where s.id = session_id
    and s.expires_at > now();
$$;

grant execute on function public.get_pairing_session(uuid) to anon, authenticated;

-- Called when a second device joins, so the QR page and dashboard agree on
-- status and an active pairing does not expire out from under its devices.
create or replace function public.touch_pairing_session(
  session_id uuid,
  device_count integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pairing_sessions
  set status = case when device_count > 1 then 'paired' else 'waiting' end,
      expires_at = now() + interval '10 minutes'
  where id = session_id
    and expires_at > now();
$$;

grant execute on function public.touch_pairing_session(uuid, integer) to anon, authenticated;

-- Ends a session explicitly (the Disconnect button). Files are removed by the
-- client first, while the session is still live — the storage policy requires
-- that — and this drops the row afterwards so the id stops working.
create or replace function public.end_pairing_session(session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pairing_sessions where id = session_id;
$$;

grant execute on function public.end_pairing_session(uuid) to anon, authenticated;

-- Used by the storage policies below: may this path be written or cleared?
create or replace function public.is_live_pairing_session(session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  parsed uuid;
begin
  -- Folder names are attacker-controlled; a bad cast must not raise.
  begin
    parsed := session_id::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.pairing_sessions
    where id = parsed
      and expires_at > now()
  );
end;
$$;

grant execute on function public.is_live_pairing_session(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Production gateway rate limits
--
-- Only the server-side Vercel function may call this. The browser never sees
-- the service-role key and cannot reset or bypass the atomic attempt counter.
-- ---------------------------------------------------------------------------

create table if not exists public.pairing_rate_limits (
  request_key  text not null,
  action       text not null check (action in ('create', 'resolve')),
  window_start timestamptz not null default now(),
  attempts     integer not null default 1,
  primary key (request_key, action)
);

alter table public.pairing_rate_limits enable row level security;

create or replace function public.check_pairing_rate_limit(
  p_request_key text,
  p_request_action text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if length(p_request_key) <> 64
     or p_request_action not in ('create', 'resolve')
     or p_max_attempts < 1
     or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.pairing_rate_limits as limits (
    request_key, action, window_start, attempts
  ) values (
    p_request_key, p_request_action, now(), 1
  )
  on conflict (request_key, action) do update
  set attempts = case
        when limits.window_start <= now() - make_interval(secs => p_window_seconds)
          then 1
        else limits.attempts + 1
      end,
      window_start = case
        when limits.window_start <= now() - make_interval(secs => p_window_seconds)
          then now()
        else limits.window_start
      end
  returning limits.attempts <= p_max_attempts into allowed;

  return allowed;
end;
$$;

revoke all on function public.check_pairing_rate_limit(text, text, integer, integer) from public;
revoke all on function public.check_pairing_rate_limit(text, text, integer, integer) from anon, authenticated;
grant execute on function public.check_pairing_rate_limit(text, text, integer, integer) to service_role;

-- Housekeeping. Call manually, or schedule with pg_cron:
--   select cron.schedule('fly-cleanup', '*/15 * * * *',
--                        $$select public.cleanup_expired_pairing_sessions()$$);
create or replace function public.cleanup_expired_pairing_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  -- Storage objects must be deleted through the Storage API, not raw SQL.
  -- Preserve expired session rows which still own files so the scheduled
  -- Vercel cleanup can identify and remove their objects safely.
  delete from public.pairing_sessions s
  where s.expires_at < now() - interval '1 hour'
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'pairing-files'
        and (storage.foldername(o.name))[1] = s.id::text
    );
  get diagnostics removed = row_count;

  delete from public.pairing_rate_limits
  where window_start < now() - interval '1 day';

  return removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('pairing-files', 'pairing-files', false)
on conflict (id) do update set public = false;

-- pairing-files: uploads must land in a folder named after a LIVE session, so
-- an open bucket cannot be used as free storage. This is stricter than the old
-- /pairing/upload endpoint, which accepted anything from anyone.
drop policy if exists "upload into a live pairing session" on storage.objects;
create policy "upload into a live pairing session"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'pairing-files'
    and public.is_live_pairing_session((storage.foldername(name))[1])
  );

drop policy if exists "pairing files are publicly readable" on storage.objects;
drop policy if exists "read files of a live pairing session" on storage.objects;
create policy "read files of a live pairing session"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'pairing-files'
    and public.is_live_pairing_session((storage.foldername(name))[1])
  );

-- Disconnecting wipes the session's files. Scoped the same way as upload, so
-- you can only clear a folder belonging to a session whose id you hold.
drop policy if exists "clear files of a live pairing session" on storage.objects;
create policy "clear files of a live pairing session"
  on storage.objects for delete
  to anon, authenticated
  using (
    bucket_id = 'pairing-files'
    and public.is_live_pairing_session((storage.foldername(name))[1])
  );
