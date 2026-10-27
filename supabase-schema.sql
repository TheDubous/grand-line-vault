-- Grand Line Vault v1: run in your own Supabase project's SQL Editor.
-- Stores one versioned JSON document per authenticated user; no service secret goes in the browser.
-- Execute once. Re-running is safe.

create table if not exists public.user_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint vault_document_is_object check (jsonb_typeof(document) = 'object'),
  constraint vault_revision_positive check (revision >= 1)
);

alter table public.user_vaults enable row level security;

-- Signed-out visitors have no read or write access.
revoke all on table public.user_vaults from public, anon;
grant select, insert, update on table public.user_vaults to authenticated;

-- RLS policies do not grant cross-user access.
drop policy if exists vault_select_own on public.user_vaults;
create policy vault_select_own on public.user_vaults
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists vault_insert_own on public.user_vaults;
create policy vault_insert_own on public.user_vaults
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists vault_update_own on public.user_vaults;
create policy vault_update_own on public.user_vaults
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Optimistic concurrency: saving against an older revision fails rather than overwrites.
create or replace function public.save_vault(
  p_document jsonb,
  p_expected_revision bigint
) returns bigint
language plpgsql security invoker
set search_path = ''
as $$
declare v_revision bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before syncing';
  end if;
  if p_document is null or jsonb_typeof(p_document) <> 'object' then
    raise exception 'Expected a JSON object';
  end if;
  if pg_column_size(p_document) > 8000000 then
    raise exception 'Collection exceeds the 8 MB cloud document limit';
  end if;
  if p_expected_revision = 0 then
    insert into public.user_vaults (user_id,document,revision)
      values ((select auth.uid()),p_document,1)
      on conflict (user_id) do nothing
      returning revision into v_revision;
  elsif p_expected_revision > 0 then
    update public.user_vaults
      set document=p_document,revision=revision+1,updated_at=now()
      where user_id=(select auth.uid()) and revision=p_expected_revision
      returning revision into v_revision;
  end if;
  if v_revision is null then
    raise exception 'Sync conflict: remote collection changed. Refresh and choose which version to keep.';
  end if;
  return v_revision;
end;
$$;

revoke all on function public.save_vault(jsonb,bigint) from public,anon;
grant execute on function public.save_vault(jsonb,bigint) to authenticated;
