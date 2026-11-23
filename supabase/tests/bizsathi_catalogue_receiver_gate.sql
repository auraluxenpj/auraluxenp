-- The Auraluxe catalogue receiver must be disabled by default and service-only.
DO $test$
DECLARE
  fn text;
  trigger_count integer;
BEGIN
  fn := pg_get_functiondef('public.guard_bizsathi_catalogue_receiver()'::regprocedure);
  SELECT count(*) INTO trigger_count
    FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgname IN ('bizsathi_catalogue_receiver_gate_products','bizsathi_catalogue_receiver_gate_variants');

  IF trigger_count <> 2 THEN
    RAISE EXCEPTION 'Both product and variant catalogue receiver gates must exist';
  END IF;
  IF position('auth.role()' IN fn)=0 OR position('service_role' IN fn)=0
     OR position('catalogue_enabled' IN fn)=0 THEN
    RAISE EXCEPTION 'Catalogue receiver gate must require service_role and the receiver switch';
  END IF;
  IF coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),true) THEN
    RAISE EXCEPTION 'BizSathi catalogue receiver must remain disabled until cutover approval';
  END IF;
  IF has_function_privilege('anon','public.upsert_shared_catalogue_from_bizsathi(jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.upsert_shared_catalogue_from_bizsathi(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Browser roles must not execute shared catalogue writes';
  END IF;
  IF NOT has_function_privilege('service_role','public.upsert_shared_catalogue_from_bizsathi(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Service role must retain shared catalogue receiver access';
  END IF;

  CREATE TEMP TABLE receiver_gate_probe(id integer);
  CREATE TRIGGER receiver_gate_probe_trigger
    BEFORE INSERT OR UPDATE ON receiver_gate_probe
    FOR EACH ROW EXECUTE FUNCTION public.guard_bizsathi_catalogue_receiver();

  PERFORM set_config('app.catalogue_sync_origin','bizsathi',true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN
    INSERT INTO receiver_gate_probe VALUES (1);
    RAISE EXCEPTION 'A browser JWT must not spoof the BizSathi catalogue origin marker';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'BizSathi catalogue receiver requires service authorization%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  BEGIN
    INSERT INTO receiver_gate_probe VALUES (2);
    RAISE EXCEPTION 'Service writes must remain blocked while the receiver switch is off';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'BizSathi catalogue receiver is disabled%' THEN RAISE; END IF;
  END;

  UPDATE public.bizsathi_sync_control SET catalogue_enabled=true WHERE id=1;
  INSERT INTO receiver_gate_probe VALUES (3);
  UPDATE public.bizsathi_sync_control SET catalogue_enabled=false WHERE id=1;
END
$test$;
