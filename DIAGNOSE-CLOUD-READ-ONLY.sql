-- This is a READ-ONLY Supabase query. It will NOT change your collection.
-- Run in Supabase -> SQL Editor while signed in as the project owner.
select
  id,
  revision,
  updated_at,
  coalesce(jsonb_array_length(document->'locations'),0) as storage_locations,
  coalesce((select count(*) from jsonb_array_elements(coalesce(document->'locations','[]'::jsonb)) loc
    where loc->>'name' ~* '^Box [0-9]+$'),0) as numbered_boxes,
  coalesce(jsonb_array_length(document->'entries'),0) as inventory_records,
  coalesce((select sum((en->>'qty')::int) from jsonb_array_elements(coalesce(document->'entries','[]'::jsonb)) en),0) as owned_copies,
  coalesce(jsonb_array_length(document->'decks'),0) as saved_decks
from public.shared_vault
where id='main';
