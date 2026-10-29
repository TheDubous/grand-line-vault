-- GRAND LINE VAULT 1.2.0: cloud-first data structure + safe, one-time import
-- Run in the SAME Supabase project as v1.1.5, using SQL Editor (admin).
-- Important: Before running, export ALL distinct local JSON collections and
-- a copy of the public.shared_vault document. Stop edits on old clients.
-- This script DOES NOT delete, change or truncate public.shared_vault or auth.
BEGIN;

CREATE TABLE IF NOT EXISTS public.vault_v12_locations (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.vault_v12_inventory (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  card_id text NOT NULL,
  location_id text NOT NULL,
  slot text NOT NULL DEFAULT '',
  qty integer NOT NULL CHECK (qty >= 1 AND qty <= 999999),
  name text NOT NULL DEFAULT '',
  rarity text NOT NULL DEFAULT '',
  colors text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id,location_id,slot)
);
CREATE INDEX IF NOT EXISTS vault_v12_inventory_card ON public.vault_v12_inventory(card_id);
CREATE INDEX IF NOT EXISTS vault_v12_inventory_loc ON public.vault_v12_inventory(location_id);
CREATE TABLE IF NOT EXISTS public.vault_v12_decks (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.vault_v12_presets (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.vault_v12_requests (
  id uuid PRIMARY KEY,
  actor uuid NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.vault_v12_meta (
  id text PRIMARY KEY CHECK (id='main'),
  source_revision bigint NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

-- Each user may READ if approved. All WRITES go through the single, atomic RPC.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vault_v12_locations','vault_v12_inventory','vault_v12_decks','vault_v12_presets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated',t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',t);
    EXECUTE format('DROP POLICY IF EXISTS v12_read_member ON public.%I',t);
    EXECUTE format($q$CREATE POLICY v12_read_member ON public.%I FOR SELECT TO authenticated USING (
      (select auth.uid()) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.vault_members m
         WHERE m.email=lower((select auth.jwt()->>'email'))
           AND m.role IN ('owner','editor')))$q$,t);
  END LOOP;
END $$;
ALTER TABLE public.vault_v12_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_v12_meta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_v12_requests,public.vault_v12_meta FROM public,anon,authenticated;

-- Only one migration, and only from the EXISTING shared cloud document.
-- Re-running the script is safe. Never silently merge old local copies.
DO $migration$
DECLARE d jsonb; r bigint; x jsonb; n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(120042);
  IF EXISTS(SELECT 1 FROM public.vault_v12_meta WHERE id='main') THEN
    RAISE NOTICE 'v1.2.0 migration already complete. No data copied.';
    RETURN;
  END IF;
  SELECT document,revision INTO d,r FROM public.shared_vault WHERE id='main' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'shared_vault main record missing: stop and restore backup'; END IF;
  IF jsonb_typeof(d->'entries') IS DISTINCT FROM 'array' OR jsonb_typeof(d->'locations') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Legacy cloud document not in expected format; do not initialize over it. Inspect shared_vault backup.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.vault_v12_inventory) OR EXISTS(SELECT 1 FROM public.vault_v12_locations) OR EXISTS(SELECT 1 FROM public.vault_v12_decks) OR EXISTS(SELECT 1 FROM public.vault_v12_presets) THEN
    RAISE EXCEPTION 'v1.2 tables not empty but migration not marked. Stop and investigate before continuing.';
  END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(d->'locations') LOOP
    IF coalesce(x->>'id','')<>'' THEN
      INSERT INTO public.vault_v12_locations(id,payload) VALUES(x->>'id',x) ON CONFLICT(id) DO NOTHING;
    END IF;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(d->'entries') LOOP
    IF coalesce(x->>'cardId','')<>'' AND (x->>'qty') ~ '^[0-9]+$' AND (x->>'qty')::integer>0 THEN
      INSERT INTO public.vault_v12_inventory(id,card_id,location_id,slot,qty,name,rarity,colors,note)
      VALUES(coalesce(nullif(x->>'id',''),gen_random_uuid()::text),upper(x->>'cardId'),
             coalesce(nullif(x->>'locationId',''),'unsorted'),lower(trim(coalesce(x->>'slot',''))),
             (x->>'qty')::integer,coalesce(x->>'name',''),coalesce(x->>'rarity',''),coalesce(x->>'colors',''),coalesce(x->>'note',''))
      ON CONFLICT (card_id,location_id,slot) DO UPDATE SET
        qty=public.vault_v12_inventory.qty+excluded.qty;
    END IF;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(d->'decks','[]'::jsonb)) LOOP
    IF coalesce(x->>'id','')<>'' THEN
      INSERT INTO public.vault_v12_decks(id,payload) VALUES(x->>'id',x) ON CONFLICT(id) DO NOTHING;
    END IF;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(d->'presets','[]'::jsonb)) LOOP
    IF coalesce(x->>'id','')<>'' THEN
      INSERT INTO public.vault_v12_presets(id,payload) VALUES(x->>'id',x) ON CONFLICT(id) DO NOTHING;
    END IF;
  END LOOP;
  -- Abort the entire transaction if totals do not match the original cloud.
  -- Duplicate legacy rows can be grouped, so compare COPY quantities, not
  -- only record counts.
  IF (SELECT coalesce(sum((item->>'qty')::integer),0)
       FROM jsonb_array_elements(d->'entries') item)
     <> (SELECT coalesce(sum(qty),0) FROM public.vault_v12_inventory)
     OR jsonb_array_length(d->'locations') <> (SELECT count(*) FROM public.vault_v12_locations)
     OR jsonb_array_length(coalesce(d->'decks','[]'::jsonb)) <> (SELECT count(*) FROM public.vault_v12_decks)
     OR jsonb_array_length(coalesce(d->'presets','[]'::jsonb)) <> (SELECT count(*) FROM public.vault_v12_presets)
  THEN RAISE EXCEPTION 'Migration count mismatch: no changes committed. Inspect legacy backup.'; END IF;
  INSERT INTO public.vault_v12_meta(id,source_revision) VALUES('main',r);
  RAISE NOTICE 'Migrated and validated from shared_vault revision %',r;
END $migration$;

-- Atomic operations; the operation ID makes retries idempotent.
-- A negative delta cannot subtract more cards than exist in that box.
CREATE OR REPLACE FUNCTION public.vault_v12_apply(p_request_id uuid, p_ops jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE op jsonb; k text; card text; box text; sl text; delta integer;
  oldval jsonb; beforeval jsonb; afterval jsonb; rowid text; affected integer; currentqty integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.vault_members m WHERE m.email=lower(auth.jwt()->>'email') AND m.role IN ('owner','editor')
  ) THEN RAISE EXCEPTION 'Not an approved vault member'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vault_v12_meta WHERE id='main') THEN
    RAISE EXCEPTION 'v1.2 database migration not completed'; END IF;
  IF jsonb_typeof(p_ops) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ops)>2000 OR pg_column_size(p_ops)>2000000 THEN
    RAISE EXCEPTION 'Invalid or oversized operation batch'; END IF;
  INSERT INTO public.vault_v12_requests(id,actor) VALUES(p_request_id,auth.uid()) ON CONFLICT(id) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'duplicate',true); END IF;
  FOR op IN SELECT value FROM jsonb_array_elements(p_ops) LOOP
    k:=op->>'kind';
    IF k='inventory' THEN
      card:=upper(trim(coalesce(op->>'cardId','')));
      box:=coalesce(op->>'locationId','');
      sl:=lower(trim(coalesce(op->>'slot','')));
      delta:=(op->>'delta')::integer;
      IF card !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' OR length(box)>100 OR box='' OR length(sl)>100
           OR delta=0 OR abs(delta)>999999 THEN RAISE EXCEPTION 'Invalid card quantity operation'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.vault_v12_locations WHERE id=box) THEN RAISE EXCEPTION 'Storage box does not exist'; END IF;
      IF delta>0 THEN
        INSERT INTO public.vault_v12_inventory(card_id,location_id,slot,qty,name,rarity,colors,note)
        VALUES(card,box,sl,delta,left(coalesce(op->>'name',card),150),left(coalesce(op->>'rarity',''),45),
          left(coalesce(op->>'colors',''),100),left(coalesce(op->>'note',''),1000))
        ON CONFLICT(card_id,location_id,slot) DO UPDATE SET
          qty=public.vault_v12_inventory.qty+excluded.qty,updated_at=now();
      ELSE
        SELECT qty INTO currentqty FROM public.vault_v12_inventory
          WHERE card_id=card AND location_id=box AND slot=sl FOR UPDATE;
        IF currentqty IS NULL OR currentqty < -delta THEN
          RAISE EXCEPTION 'Not enough copies available in the shared box. Refresh and retry.';
        END IF;
        IF currentqty = -delta THEN
          DELETE FROM public.vault_v12_inventory WHERE card_id=card AND location_id=box AND slot=sl;
        ELSE
          UPDATE public.vault_v12_inventory SET qty=qty+delta,updated_at=now()
            WHERE card_id=card AND location_id=box AND slot=sl;
        END IF;
      END IF;
    ELSIF k='inventory_meta' THEN
      card:=upper(trim(coalesce(op->>'cardId','')));box:=op->>'locationId';sl:=lower(trim(coalesce(op->>'slot','')));
      beforeval:=op->'before';afterval:=op->'after';
      UPDATE public.vault_v12_inventory SET
        name=left(coalesce(afterval->>'name',card),150),
        note=left(coalesce(afterval->>'note',''),1000),
        rarity=left(coalesce(afterval->>'rarity',''),45),
        colors=left(coalesce(afterval->>'colors',''),100),updated_at=now()
      WHERE card_id=card AND location_id=box AND slot=sl
        AND name=coalesce(beforeval->>'name','')
        AND note=coalesce(beforeval->>'note','')
        AND rarity=coalesce(beforeval->>'rarity','')
        AND colors=coalesce(beforeval->>'colors','');
      GET DIAGNOSTICS affected=ROW_COUNT;
      IF affected<>1 THEN RAISE EXCEPTION 'Card details changed elsewhere. Refresh before editing.'; END IF;
    ELSIF k IN ('locations','decks','presets') THEN
      rowid:=op->>'id'; beforeval:=nullif(op->'before','null'::jsonb); afterval:=nullif(op->'after','null'::jsonb);
      IF rowid IS NULL OR length(rowid)>100 OR rowid='' OR (afterval IS NOT NULL AND jsonb_typeof(afterval)<>'object') THEN
        RAISE EXCEPTION 'Invalid object operation'; END IF;
      IF k='locations' THEN SELECT payload INTO oldval FROM public.vault_v12_locations WHERE id=rowid FOR UPDATE;
      ELSIF k='decks' THEN SELECT payload INTO oldval FROM public.vault_v12_decks WHERE id=rowid FOR UPDATE;
      ELSE SELECT payload INTO oldval FROM public.vault_v12_presets WHERE id=rowid FOR UPDATE; END IF;
      IF oldval IS DISTINCT FROM beforeval THEN RAISE EXCEPTION 'This box, deck or preset changed on another device. Refresh.'; END IF;
      IF afterval IS NULL THEN
        IF k='locations' THEN
          IF EXISTS(SELECT 1 FROM public.vault_v12_inventory WHERE location_id=rowid) THEN RAISE EXCEPTION 'Move cards before deleting this box'; END IF;
          DELETE FROM public.vault_v12_locations WHERE id=rowid;
        ELSIF k='decks' THEN DELETE FROM public.vault_v12_decks WHERE id=rowid;
        ELSE DELETE FROM public.vault_v12_presets WHERE id=rowid; END IF;
      ELSE
        IF k='locations' THEN INSERT INTO public.vault_v12_locations(id,payload) VALUES(rowid,afterval) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=now();
        ELSIF k='decks' THEN INSERT INTO public.vault_v12_decks(id,payload) VALUES(rowid,afterval) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=now();
        ELSE INSERT INTO public.vault_v12_presets(id,payload) VALUES(rowid,afterval) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=now(); END IF;
      END IF;
    ELSE RAISE EXCEPTION 'Unknown operation kind'; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'operations',jsonb_array_length(p_ops));
END $fn$;
REVOKE ALL ON FUNCTION public.vault_v12_apply(uuid,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.vault_v12_apply(uuid,jsonb) TO authenticated;

-- Enable real-time notifications for the four independently editable tables.
DO $$ DECLARE t text; BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['vault_v12_locations','vault_v12_inventory','vault_v12_decks','vault_v12_presets'] LOOP
      IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
      END IF;
    END LOOP;
  END IF;
END $$;
COMMIT;

-- Read-only validation: compare the old cloud and migrated tables.
SELECT 'Old shared cloud' AS source,
       jsonb_array_length(coalesce(document->'entries','[]'::jsonb)) AS inventory_rows,
       (SELECT sum((x->>'qty')::integer) FROM jsonb_array_elements(coalesce(document->'entries','[]'::jsonb)) x) AS physical_copies,
       jsonb_array_length(coalesce(document->'locations','[]'::jsonb)) AS boxes,
       jsonb_array_length(coalesce(document->'decks','[]'::jsonb)) AS decks
FROM public.shared_vault WHERE id='main'
UNION ALL
SELECT 'New v1.2' AS source,
       (SELECT count(*) FROM public.vault_v12_inventory),
       (SELECT sum(qty) FROM public.vault_v12_inventory),
       (SELECT count(*) FROM public.vault_v12_locations),
       (SELECT count(*) FROM public.vault_v12_decks);
