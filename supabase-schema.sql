-- Grand Line Vault v1.0.1 -- PRIVATE SHARED VAULT
-- Run once as database administrator in Supabase SQL Editor.
-- The app's publishable key does NOT grant access. Only explicitly allowlisted emails
-- with a verified Supabase Auth session can read or update the ONE shared vault.
-- Do not add your friends to the Supabase organization: invite them as APP members below.

create table if not exists public.vault_members (
  email text primary key,
  role text not null default 'editor' check (role in ('owner','editor')),
  added_at timestamptz not null default now(),
  constraint vault_member_email_lower check (email = lower(trim(email)))
);

alter table public.vault_members enable row level security;
revoke all on table public.vault_members from public, anon, authenticated;
grant select on table public.vault_members to authenticated;

-- Each signed-in user can only see their own membership row. No browser user
-- can add, change or delete memberships (SQL Editor admin only).
drop policy if exists vault_member_see_self on public.vault_members;
create policy vault_member_see_self on public.vault_members
  for select to authenticated
  using ((select auth.uid()) is not null
         and email = lower((select auth.jwt()->>'email')));

create table if not exists public.shared_vault (
  id text primary key default 'main' check (id = 'main'),
  document jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint shared_vault_document_object check (jsonb_typeof(document) = 'object')
);

alter table public.shared_vault enable row level security;
revoke all on table public.shared_vault from public, anon, authenticated;
grant select, update on table public.shared_vault to authenticated;

-- Signed-in user must be allowlisted. Membership lookup is itself protected
-- by the preceding self-only policy; strangers cannot see other member emails.
drop policy if exists shared_vault_read on public.shared_vault;
create policy shared_vault_read on public.shared_vault
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.vault_members m
                where m.email = lower((select auth.jwt()->>'email'))
                  and m.role in ('owner','editor'))
  );

drop policy if exists shared_vault_update on public.shared_vault;
create policy shared_vault_update on public.shared_vault
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.vault_members m
                where m.email = lower((select auth.jwt()->>'email'))
                  and m.role in ('owner','editor'))
  )
  with check (
    (select auth.uid()) is not null
    and exists (select 1 from public.vault_members m
                where m.email = lower((select auth.jwt()->>'email'))
                  and m.role in ('owner','editor'))
  );

-- The admin creates the only row. Signed-in users can update but not insert
-- or delete rows. Revision matching avoids silent lost updates.
insert into public.shared_vault(id, document, revision)
  values ('main', '{}'::jsonb, 1)
  on conflict (id) do nothing;

create or replace function public.save_shared_vault(
  p_document jsonb,
  p_expected_revision bigint
) returns bigint
language plpgsql security invoker
set search_path = ''
as $$
declare v_revision bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in to sync';
  end if;
  if p_document is null or jsonb_typeof(p_document) <> 'object' then
    raise exception 'Expected a JSON object';
  end if;
  if pg_column_size(p_document) > 8000000 then
    raise exception 'Collection exceeds 8 MB document limit';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Refresh the shared vault before saving';
  end if;
  update public.shared_vault
     set document = p_document,
         revision = revision + 1,
         updated_at = now()
   where id = 'main' and revision = p_expected_revision
   returning revision into v_revision;
  if v_revision is null then
    raise exception 'Sync conflict or insufficient access. Refresh from cloud before editing further.';
  end if;
  return v_revision;
end;
$$;

revoke all on function public.save_shared_vault(jsonb,bigint) from public, anon;
grant execute on function public.save_shared_vault(jsonb,bigint) to authenticated;

-- IMPORTANT NEXT STEP: in a NEW SQL query, add your own app login email:
-- insert into public.vault_members(email,role)
-- values (lower('YOUR_REAL_EMAIL@example.com'), 'owner')
-- on conflict (email) do update set role='owner';
-- Add friends ONLY when you want them to share all inventory and decks:
-- insert into public.vault_members(email,role)
-- values (lower('FRIEND_EMAIL@example.com'), 'editor')
-- on conflict (email) do nothing;
-- To revoke access:
-- delete from public.vault_members where email=lower('FRIEND_EMAIL@example.com');
