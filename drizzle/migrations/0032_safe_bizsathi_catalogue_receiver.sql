-- 0032: Guard BizSathi inbound catalogue imports and keep new imports unpublished.
-- Existing Auraluxe product names and publication state remain Auraluxe-owned.
DO $safe_bizsathi_catalogue_receiver$
DECLARE
  body text;
  changed text;
  auth_check text := 'IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION ''Server integration authentication required''; END IF;';
  publish_assignment text := 'v_published:=coalesce((r->>''published'')::boolean,false);';
BEGIN
  SELECT pg_get_functiondef('public.upsert_shared_catalogue_from_bizsathi(jsonb)'::regprocedure)
    INTO body;

  IF position(auth_check in body) = 0 THEN
    RAISE EXCEPTION 'Could not locate BizSathi receiver authentication guard';
  END IF;
  IF position(publish_assignment in body) = 0 THEN
    RAISE EXCEPTION 'Could not locate BizSathi publication assignment';
  END IF;

  changed := replace(
    body,
    auth_check,
    auth_check || E'\n  IF NOT coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),false) THEN\n    RAISE EXCEPTION ''BizSathi catalogue sync is disabled'';\n  END IF;'
  );
  changed := replace(changed, publish_assignment, 'v_published:=false;');

  IF changed = body
     OR position('BizSathi catalogue sync is disabled' in changed) = 0
     OR position('v_published:=false;' in changed) = 0 THEN
    RAISE EXCEPTION 'Safe BizSathi catalogue receiver patch was not applied';
  END IF;

  EXECUTE changed;
END
$safe_bizsathi_catalogue_receiver$;

COMMENT ON FUNCTION public.upsert_shared_catalogue_from_bizsathi(jsonb) IS
  'SKU-first catalogue import from BizSathi. Existing Auraluxe product names and publication state are preserved; new products are always unpublished drafts; catalogue sync must be enabled; stock is never imported.';
