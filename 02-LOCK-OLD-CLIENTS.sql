-- Run ONLY AFTER the v1.2.0 migration succeeded and all devices have v1.2.0.
-- Stop legacy v1.1.x apps from saving to the old JSON document.
-- The legacy cloud document is kept read-only for recovery.
BEGIN;
REVOKE UPDATE ON TABLE public.shared_vault FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.save_shared_vault(jsonb,bigint) FROM authenticated;
COMMIT;
SELECT id,revision,updated_at FROM public.shared_vault WHERE id='main';
