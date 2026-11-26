-- Auto Video Studio — team server on Supabase (free tier).
-- Paste ALL of this into Supabase → SQL Editor → Run. Safe to run again.
--
-- What it creates:
--   avs_licenses  one row per licence key (only a SHA-256 hash of the key is stored)
--   avs_packs     every "Publish data" from the admin (version, file list)
--   avs_check()   called by the app: checks a key, binds it to the first PC, returns status
--   avs_pack()    called by the app: returns the latest data pack, only for a valid key
--   storage bucket "avs-data" with the published files
-- The app's public (anon / publishable) key can ONLY call avs_check and avs_pack.
-- Creating / blocking keys and publishing data needs the secret (service_role) key, kept on the admin PC only.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.avs_licenses (
  id bigint generated always as identity primary key,
  key_hash text unique not null,
  key_hint text not null default '',
  name text not null default '',
  status text not null default 'active' check (status in ('active', 'blocked')),
  device_id text,
  device_name text,
  activated_at timestamptz,
  last_seen timestamptz,
  app_version text,
  logout_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.avs_packs (
  version int primary key,
  folder text not null,
  manifest jsonb not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.avs_licenses enable row level security;
alter table public.avs_packs enable row level security;
-- new Supabase projects do not expose tables to the Data API by default: the admin (secret / service_role key) needs these grants
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.avs_licenses, public.avs_packs to service_role;
grant usage, select on all sequences in schema public to service_role;
-- no policies on purpose: nobody except the service role can read or change these tables directly
revoke all on public.avs_licenses from anon, authenticated;
revoke all on public.avs_packs from anon, authenticated;

create or replace function public.avs_check(p_key text, p_device text, p_device_name text default '', p_version text default '')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.avs_licenses;
  h text := encode(extensions.digest(upper(trim(coalesce(p_key, ''))), 'sha256'), 'hex');
  latest int;
begin
  if coalesce(p_device, '') = '' then return jsonb_build_object('ok', false, 'reason', 'no_device'); end if;
  select * into r from public.avs_licenses where key_hash = h for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if r.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'blocked'); end if;
  if r.device_id is null then
    update public.avs_licenses set device_id = p_device, device_name = left(p_device_name, 80), activated_at = now() where id = r.id;
  elsif r.device_id <> p_device then
    return jsonb_build_object('ok', false, 'reason', 'other_device', 'device_name', r.device_name);
  end if;
  update public.avs_licenses set last_seen = now(), app_version = left(p_version, 20) where id = r.id;
  select max(version) into latest from public.avs_packs;
  return jsonb_build_object('ok', true, 'name', r.name, 'logout_at', r.logout_at, 'pack', coalesce(latest, 0), 'now', now());
end $$;

create or replace function public.avs_pack(p_key text, p_device text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.avs_licenses;
  p public.avs_packs;
  h text := encode(extensions.digest(upper(trim(coalesce(p_key, ''))), 'sha256'), 'hex');
begin
  select * into r from public.avs_licenses where key_hash = h;
  if not found or r.status <> 'active' or r.device_id is distinct from p_device then return jsonb_build_object('ok', false, 'reason', 'not_allowed'); end if;
  select * into p from public.avs_packs order by version desc limit 1;
  if not found then return jsonb_build_object('ok', true, 'version', 0); end if;
  return jsonb_build_object('ok', true, 'version', p.version, 'folder', p.folder, 'manifest', p.manifest, 'note', p.note, 'created_at', p.created_at);
end $$;

revoke all on function public.avs_check(text, text, text, text) from public;
revoke all on function public.avs_pack(text, text) from public;
grant execute on function public.avs_check(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.avs_pack(text, text) to anon, authenticated, service_role;

-- file storage (public bucket; files sit in a random folder name that only valid keys receive)
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('avs-data', 'avs-data', true) on conflict (id) do nothing;
  end if;
end $$;

-- make the Data API see the new tables and functions right away
notify pgrst, 'reload schema';
