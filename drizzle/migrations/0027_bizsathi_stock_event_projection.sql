-- 0027: approval-gated SKU-pooled stock event projection from BizSathi.
-- No product, variant, stock or baseline data is written by this migration.

CREATE TABLE public.bizsathi_sync_control (
  id smallint PRIMARY KEY DEFAULT 1 CHECK(id=1),
  catalogue_enabled boolean NOT NULL DEFAULT false,
  stock_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bizsathi_sync_control(id,catalogue_enabled,stock_enabled)
VALUES(1,false,false) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.bizsathi_sync_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bizsathi_sync_control FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.bizsathi_sync_control TO service_role;

CREATE OR REPLACE FUNCTION public.claim_bizsathi_catalogue_outbox(_lease uuid,_limit integer DEFAULT 25)
RETURNS SETOF public.bizsathi_catalogue_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR _lease IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Service authorization and valid lease required';
  END IF;
  IF NOT coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),false) THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.bizsathi_catalogue_outbox o
     WHERE ((o.status='pending' AND o.available_at<=now()) OR (o.status='processing' AND o.locked_until<now()))
       AND NOT EXISTS (
         SELECT 1 FROM public.bizsathi_catalogue_outbox earlier
          WHERE earlier.sku=o.sku AND earlier.id<o.id AND earlier.status<>'delivered'
       )
     ORDER BY id FOR UPDATE SKIP LOCKED LIMIT _limit
  )
  UPDATE public.bizsathi_catalogue_outbox o
     SET status='processing',lease_token=_lease,locked_until=now()+interval '2 minutes',attempts=attempts+1
    FROM picked WHERE o.id=picked.id RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION public.bizsathi_stock_event_sync_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce((SELECT stock_enabled FROM public.bizsathi_sync_control WHERE id=1),false);
$$;
REVOKE ALL ON FUNCTION public.bizsathi_stock_event_sync_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bizsathi_stock_event_sync_enabled() TO service_role;

CREATE TABLE public.bizsathi_stock_baselines (
  bizsathi_variant_id uuid PRIMARY KEY,
  bizsathi_product_id uuid NOT NULL,
  auraluxe_product_id uuid NOT NULL,
  auraluxe_variant_id uuid NOT NULL UNIQUE,
  sku text NOT NULL UNIQUE CHECK(length(btrim(sku)) BETWEEN 1 AND 80),
  baseline_quantity integer NOT NULL CHECK(baseline_quantity>=0),
  bizsathi_ledger_quantity integer NOT NULL CHECK(bizsathi_ledger_quantity>=0 AND bizsathi_ledger_quantity=baseline_quantity),
  last_version bigint NOT NULL DEFAULT 0 CHECK(last_version>=0),
  verification_reference text NOT NULL CHECK(length(btrim(verification_reference)) BETWEEN 1 AND 200),
  verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bizsathi_stock_baselines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bizsathi_stock_baselines FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.bizsathi_stock_baselines TO service_role;

CREATE TABLE public.bizsathi_stock_events (
  event_id uuid PRIMARY KEY,
  source_table text NOT NULL CHECK(source_table IN ('stock_movements','commerce_stock_movements','website_inventory_movements','website_inventory_return_movements')),
  source_id uuid NOT NULL,
  bizsathi_product_id uuid NOT NULL,
  bizsathi_variant_id uuid NOT NULL,
  auraluxe_product_id uuid NOT NULL,
  auraluxe_variant_id uuid NOT NULL,
  sku text NOT NULL CHECK(length(btrim(sku)) BETWEEN 1 AND 80),
  sku_version bigint NOT NULL CHECK(sku_version>=1),
  delta integer NOT NULL CHECK(delta<>0),
  occurred_at timestamptz NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_table,source_id),
  UNIQUE(bizsathi_variant_id,sku_version)
);
ALTER TABLE public.bizsathi_stock_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bizsathi_stock_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.bizsathi_stock_events TO service_role;

CREATE OR REPLACE FUNCTION public.block_bizsathi_stock_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'BizSathi stock events are immutable';
END $$;
REVOKE ALL ON FUNCTION public.block_bizsathi_stock_event_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bizsathi_stock_events_immutable
  BEFORE UPDATE OR DELETE ON public.bizsathi_stock_events
  FOR EACH ROW EXECUTE FUNCTION public.block_bizsathi_stock_event_mutation();

CREATE OR REPLACE FUNCTION public.register_bizsathi_stock_baseline(
  _bizsathi_product_id uuid,
  _bizsathi_variant_id uuid,
  _auraluxe_product_id uuid,
  _auraluxe_variant_id uuid,
  _sku text,
  _quantity integer,
  _bizsathi_ledger_quantity integer,
  _verification_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; v public.product_variants; existing public.bizsathi_stock_baselines;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Auraluxe administrator access required';
  END IF;
  IF _quantity IS NULL OR _quantity<0 OR _bizsathi_ledger_quantity IS NULL OR _bizsathi_ledger_quantity<0 OR _quantity<>_bizsathi_ledger_quantity OR coalesce(length(btrim(_verification_reference)),0) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Physical count, matching BizSathi ledger quantity and count reference are required';
  END IF;
  IF coalesce((SELECT stock_enabled FROM public.bizsathi_sync_control WHERE id=1),false) THEN
    RAISE EXCEPTION 'Disable stock event delivery before registering or correcting a baseline';
  END IF;
  IF public.website_inventory_authority_enabled() THEN
    RAISE EXCEPTION 'Register physical baselines before enabling BizSathi inventory authority';
  END IF;
  SELECT * INTO v FROM public.product_variants
   WHERE id=_auraluxe_variant_id AND bizsathi_variant_id=_bizsathi_variant_id
     AND lower(btrim(sku))=lower(btrim(_sku)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved SKU and BizSathi variant mapping is required'; END IF;
  SELECT * INTO p FROM public.products
   WHERE id=_auraluxe_product_id AND id=v.product_id
     AND bizsathi_product_id=_bizsathi_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved product and BizSathi product mapping is required'; END IF;
  SELECT * INTO existing FROM public.bizsathi_stock_baselines
   WHERE bizsathi_variant_id=_bizsathi_variant_id FOR UPDATE;
  IF FOUND THEN
    IF existing.sku=lower(btrim(_sku)) AND existing.baseline_quantity=_quantity
       AND existing.auraluxe_variant_id=_auraluxe_variant_id
       AND existing.verification_reference=btrim(_verification_reference) THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'baselineQuantity',existing.baseline_quantity);
    END IF;
    RAISE EXCEPTION 'A baseline already exists; a reviewed recount workflow is required';
  END IF;
  PERFORM set_config('app.stock_sync_origin','bizsathi',true);
  UPDATE public.products SET stock=_quantity,updated_at=now() WHERE id=_auraluxe_product_id;
  UPDATE public.product_variants SET stock=_quantity WHERE id=_auraluxe_variant_id;
  INSERT INTO public.bizsathi_stock_baselines(
    bizsathi_product_id,bizsathi_variant_id,auraluxe_product_id,auraluxe_variant_id,
    sku,baseline_quantity,bizsathi_ledger_quantity,last_version,verification_reference,verified_by
  ) VALUES (
    _bizsathi_product_id,_bizsathi_variant_id,_auraluxe_product_id,_auraluxe_variant_id,
    lower(btrim(_sku)),_quantity,_bizsathi_ledger_quantity,0,btrim(_verification_reference),auth.uid()
  );
  RETURN jsonb_build_object('ok',true,'duplicate',false,'baselineQuantity',_quantity);
END $$;
REVOKE ALL ON FUNCTION public.register_bizsathi_stock_baseline(uuid,uuid,uuid,uuid,text,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_bizsathi_stock_baseline(uuid,uuid,uuid,uuid,text,integer,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_bizsathi_stock_event(
  _event_id uuid,
  _source_table text,
  _source_id uuid,
  _bizsathi_product_id uuid,
  _bizsathi_variant_id uuid,
  _auraluxe_product_id uuid,
  _auraluxe_variant_id uuid,
  _sku text,
  _sku_version bigint,
  _delta integer,
  _occurred_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE baseline public.bizsathi_stock_baselines; prior public.bizsathi_stock_events;
        p public.products; v public.product_variants;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service authorization required'; END IF;
  IF NOT coalesce((SELECT stock_enabled FROM public.bizsathi_sync_control WHERE id=1),false)
     OR NOT public.website_inventory_authority_enabled() THEN
    RAISE EXCEPTION 'Transactional BizSathi stock event sync is not enabled';
  END IF;
  IF _event_id IS NULL OR _source_id IS NULL
     OR _source_table NOT IN ('stock_movements','commerce_stock_movements','website_inventory_movements','website_inventory_return_movements')
     OR _sku_version IS NULL OR _sku_version<1 OR _delta IS NULL OR _delta=0 OR _occurred_at IS NULL
     OR coalesce(length(btrim(_sku)),0) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid BizSathi stock event';
  END IF;

  SELECT * INTO prior FROM public.bizsathi_stock_events
   WHERE event_id=_event_id OR (source_table=_source_table AND source_id=_source_id)
   FOR UPDATE;
  IF FOUND THEN
    IF prior.event_id=_event_id AND prior.source_table=_source_table AND prior.source_id=_source_id
       AND prior.bizsathi_product_id=_bizsathi_product_id AND prior.bizsathi_variant_id=_bizsathi_variant_id
       AND prior.auraluxe_product_id=_auraluxe_product_id AND prior.auraluxe_variant_id=_auraluxe_variant_id
       AND prior.sku=lower(btrim(_sku)) AND prior.sku_version=_sku_version AND prior.delta=_delta AND prior.occurred_at=_occurred_at THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'sku',prior.sku,'delta',prior.delta);
    END IF;
    RAISE EXCEPTION 'Stock event identifier was reused with different content';
  END IF;

  SELECT * INTO baseline FROM public.bizsathi_stock_baselines
   WHERE bizsathi_variant_id=_bizsathi_variant_id AND auraluxe_variant_id=_auraluxe_variant_id
     AND bizsathi_product_id=_bizsathi_product_id AND auraluxe_product_id=_auraluxe_product_id
     AND sku=lower(btrim(_sku)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verified physical stock baseline and approved mapping are required'; END IF;
  IF _sku_version<>baseline.last_version+1 THEN
    RAISE EXCEPTION 'Out-of-order stock event: expected version %, received %',baseline.last_version+1,_sku_version;
  END IF;

  SELECT * INTO v FROM public.product_variants
   WHERE id=_auraluxe_variant_id AND product_id=_auraluxe_product_id
     AND bizsathi_variant_id=_bizsathi_variant_id AND lower(btrim(sku))=lower(btrim(_sku))
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mapped Auraluxe variant no longer exists'; END IF;
  SELECT * INTO p FROM public.products WHERE id=_auraluxe_product_id
    AND bizsathi_product_id=_bizsathi_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mapped Auraluxe product no longer exists'; END IF;
  IF p.stock+_delta<0 OR v.stock+_delta<0 THEN RAISE EXCEPTION 'Stock event would make Auraluxe stock negative'; END IF;

  PERFORM set_config('app.stock_sync_origin','bizsathi',true);
  UPDATE public.products SET stock=stock+_delta,updated_at=now() WHERE id=_auraluxe_product_id;
  UPDATE public.product_variants SET stock=stock+_delta WHERE id=_auraluxe_variant_id;
  INSERT INTO public.bizsathi_stock_events(
    event_id,source_table,source_id,bizsathi_product_id,bizsathi_variant_id,
    auraluxe_product_id,auraluxe_variant_id,sku,sku_version,delta,occurred_at
  ) VALUES (
    _event_id,_source_table,_source_id,_bizsathi_product_id,_bizsathi_variant_id,
    _auraluxe_product_id,_auraluxe_variant_id,lower(btrim(_sku)),_sku_version,_delta,_occurred_at
  );
  UPDATE public.bizsathi_stock_baselines SET last_version=_sku_version,updated_at=now()
   WHERE bizsathi_variant_id=_bizsathi_variant_id;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'sku',lower(btrim(_sku)),'delta',_delta,'version',_sku_version);
END $$;
REVOKE ALL ON FUNCTION public.apply_bizsathi_stock_event(uuid,text,uuid,uuid,uuid,uuid,uuid,text,bigint,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bizsathi_stock_event(uuid,text,uuid,uuid,uuid,uuid,uuid,text,bigint,integer) TO service_role;

-- Auraluxe checkout selects a size as a merchandising attribute, but BizSathi
-- holds pooled SKU quantity. If there is no size/colour-specific mapping, use
-- exactly one generic mapped variant; never invent per-size stock allocations.
DO $patch_pooled_size_checkout$
DECLARE body text; old_block text; new_block text; changed text;
BEGIN
  SELECT pg_get_functiondef('public.place_order(text,text,jsonb,jsonb,text,uuid)'::regprocedure) INTO body;
  old_block := $old$
    IF v_bizsathi_product_id IS NOT NULL THEN
      SELECT count(*) INTO v_mapped_variant_count
        FROM public.product_variants pv
       WHERE pv.product_id = v_product.id
         AND pv.bizsathi_variant_id IS NOT NULL
         AND pv.size IS NOT DISTINCT FROM nullif(coalesce(v_item->>'size', ''), '')
         AND pv.color IS NOT DISTINCT FROM nullif(coalesce(v_item->>'color', ''), '');
      IF v_mapped_variant_count <> 1 THEN
        RAISE EXCEPTION 'Inventory mapping is missing or ambiguous for %; please contact the store', v_product.name;
      END IF;
      SELECT pv.bizsathi_variant_id, pv.sku
        INTO v_bizsathi_variant_id, v_bizsathi_sku
        FROM public.product_variants pv
       WHERE pv.product_id = v_product.id
         AND pv.bizsathi_variant_id IS NOT NULL
         AND pv.size IS NOT DISTINCT FROM nullif(coalesce(v_item->>'size', ''), '')
         AND pv.color IS NOT DISTINCT FROM nullif(coalesce(v_item->>'color', ''), '');
    END IF;
$old$;
  new_block := $new$
    IF v_bizsathi_product_id IS NOT NULL THEN
      SELECT count(*) INTO v_mapped_variant_count
        FROM public.product_variants pv
       WHERE pv.product_id = v_product.id
         AND pv.bizsathi_variant_id IS NOT NULL
         AND pv.size IS NOT DISTINCT FROM nullif(coalesce(v_item->>'size', ''), '')
         AND pv.color IS NOT DISTINCT FROM nullif(coalesce(v_item->>'color', ''), '');
      IF v_mapped_variant_count = 0 THEN
        SELECT count(*) INTO v_mapped_variant_count
          FROM public.product_variants pv
         WHERE pv.product_id = v_product.id
           AND pv.bizsathi_variant_id IS NOT NULL
           AND pv.size IS NULL AND pv.color IS NULL;
      END IF;
      IF v_mapped_variant_count <> 1 THEN
        RAISE EXCEPTION 'Inventory mapping is missing or ambiguous for %; please contact the store', v_product.name;
      END IF;
      SELECT pv.bizsathi_variant_id, pv.sku
        INTO v_bizsathi_variant_id, v_bizsathi_sku
        FROM public.product_variants pv
       WHERE pv.product_id = v_product.id
         AND pv.bizsathi_variant_id IS NOT NULL
         AND (
           (pv.size IS NOT DISTINCT FROM nullif(coalesce(v_item->>'size', ''), '')
            AND pv.color IS NOT DISTINCT FROM nullif(coalesce(v_item->>'color', ''), ''))
           OR (pv.size IS NULL AND pv.color IS NULL)
         )
       ORDER BY CASE WHEN pv.size IS NOT DISTINCT FROM nullif(coalesce(v_item->>'size', ''), '')
                       AND pv.color IS NOT DISTINCT FROM nullif(coalesce(v_item->>'color', ''), '')
                     THEN 0 ELSE 1 END
       LIMIT 1;
    END IF;
$new$;
  IF position(old_block in body)=0 THEN RAISE EXCEPTION 'Could not locate checkout SKU/size mapping block'; END IF;
  changed:=replace(body,old_block,new_block);
  EXECUTE changed;
END $patch_pooled_size_checkout$;


-- Return exact cross-system IDs from each SKU upsert so BizSathi can persist
-- the approved Auraluxe mapping before a stock movement is eligible to publish.
DO $patch_catalogue_mapping_response$
DECLARE body text; changed text;
BEGIN
  SELECT pg_get_functiondef('public.upsert_shared_catalogue_from_bizsathi(jsonb)'::regprocedure) INTO body;
  changed:=replace(body,
    E'BEGIN\n  IF auth.uid() IS NOT NULL THEN',
    E'BEGIN\n  IF NOT coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),false) THEN RAISE EXCEPTION ''Catalogue sync is disabled''; END IF;\n  IF auth.uid() IS NOT NULL THEN');
  changed:=replace(changed,
    '  v_updated_variants integer := 0;',
    E'  v_updated_variants integer := 0;\n  v_mappings jsonb := ''[]''::jsonb;');
  changed:=replace(changed,
    E'    END IF;\n  END LOOP;\n\n  RETURN jsonb_build_object(',
    E'    END IF;\n    v_mappings:=v_mappings||jsonb_build_array(jsonb_build_object(\n      ''sku'',v_sku,''auraluxe_product_id'',v_product_id,''auraluxe_variant_id'',v_variant_id,\n      ''bizsathi_product_id'',v_remote_product_id,''bizsathi_variant_id'',v_remote_variant_id));\n  END LOOP;\n\n  RETURN jsonb_build_object(');
  changed:=replace(changed,
    E'''website_enrichment_preserved'',true);',
    E'''website_enrichment_preserved'',true,''mappings'',v_mappings);');
  IF changed=body OR position('mappings' in changed)=0 THEN
    RAISE EXCEPTION 'Could not install catalogue mapping response';
  END IF;
  EXECUTE changed;
END $patch_catalogue_mapping_response$;

COMMENT ON TABLE public.bizsathi_stock_baselines IS
  'Owner-approved physical count baseline for one pooled SKU. Event delivery cannot start until this record exists.';
COMMENT ON TABLE public.bizsathi_stock_events IS
  'Immutable, idempotent BizSathi movement events applied to the Auraluxe SKU-level stock projection.';
COMMENT ON TABLE public.bizsathi_sync_control IS
  'Fail-closed catalogue and stock sync switches. Both default false pending mapping and physical-count approval.';
