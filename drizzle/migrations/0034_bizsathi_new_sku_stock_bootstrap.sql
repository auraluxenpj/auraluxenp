-- 0034: safely initialize stock state for new BizSathi SKUs and bootstrap the
-- four existing zero-stock website variants from the BizSathi authoritative ledger.
-- New SKU baselines start at zero because every opening movement is retained in
-- BizSathi's ordered stock outbox, including movements created before SKU mapping.

ALTER TABLE public.bizsathi_stock_baselines
  ALTER COLUMN verified_by DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS baseline_source text NOT NULL DEFAULT 'physical_count';

ALTER TABLE public.bizsathi_stock_baselines
  DROP CONSTRAINT IF EXISTS bizsathi_stock_baselines_baseline_source_check;
ALTER TABLE public.bizsathi_stock_baselines
  ADD CONSTRAINT bizsathi_stock_baselines_baseline_source_check
  CHECK (baseline_source IN ('physical_count','new_sku_zero','bizsathi_authoritative_bootstrap'));

-- The service-only bootstrap is deliberately limited to a currently zero-stock
-- Auraluxe variant with an exact approved BizSathi product/variant/SKU mapping.
CREATE OR REPLACE FUNCTION public.bootstrap_bizsathi_stock_baseline(
  _bizsathi_product_id uuid,
  _bizsathi_variant_id uuid,
  _auraluxe_product_id uuid,
  _auraluxe_variant_id uuid,
  _sku text,
  _quantity integer,
  _verification_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  p public.products;
  v public.product_variants;
  existing public.bizsathi_stock_baselines;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required';
  END IF;
  IF _quantity IS NULL OR _quantity < 0 OR _quantity > 1000000
     OR coalesce(length(btrim(_sku)),0) NOT BETWEEN 1 AND 80
     OR coalesce(length(btrim(_verification_reference)),0) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Valid BizSathi quantity, SKU and source reference are required';
  END IF;

  SELECT * INTO v
    FROM public.product_variants
   WHERE id=_auraluxe_variant_id
     AND product_id=_auraluxe_product_id
     AND bizsathi_variant_id=_bizsathi_variant_id
     AND lower(btrim(sku))=lower(btrim(_sku))
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact Auraluxe/BizSathi SKU and variant mapping is required';
  END IF;

  SELECT * INTO p
    FROM public.products
   WHERE id=_auraluxe_product_id
     AND bizsathi_product_id=_bizsathi_product_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact Auraluxe/BizSathi product mapping is required';
  END IF;

  SELECT * INTO existing
    FROM public.bizsathi_stock_baselines
   WHERE bizsathi_variant_id=_bizsathi_variant_id
   FOR UPDATE;
  IF FOUND THEN
    IF existing.baseline_source='bizsathi_authoritative_bootstrap'
       AND existing.baseline_quantity=_quantity
       AND existing.auraluxe_variant_id=_auraluxe_variant_id THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'quantity',existing.baseline_quantity);
    END IF;
    RAISE EXCEPTION 'A stock baseline already exists for this SKU';
  END IF;

  IF coalesce(v.stock,0)<>0 OR coalesce(p.stock,0)<>0 THEN
    RAISE EXCEPTION 'Automatic bootstrap is allowed only while the Auraluxe product and variant stock are both zero';
  END IF;

  PERFORM set_config('app.stock_sync_origin','bizsathi',true);
  UPDATE public.products
     SET stock=_quantity,updated_at=now()
   WHERE id=_auraluxe_product_id;
  UPDATE public.product_variants
     SET stock=_quantity
   WHERE id=_auraluxe_variant_id;

  INSERT INTO public.bizsathi_stock_baselines(
    bizsathi_product_id,bizsathi_variant_id,auraluxe_product_id,auraluxe_variant_id,
    sku,baseline_quantity,bizsathi_ledger_quantity,last_version,
    verification_reference,verified_by,baseline_source
  ) VALUES (
    _bizsathi_product_id,_bizsathi_variant_id,_auraluxe_product_id,_auraluxe_variant_id,
    lower(btrim(_sku)),_quantity,_quantity,0,btrim(_verification_reference),NULL,
    'bizsathi_authoritative_bootstrap'
  );

  RETURN jsonb_build_object('ok',true,'duplicate',false,'quantity',_quantity);
END
$function$;

REVOKE ALL ON FUNCTION public.bootstrap_bizsathi_stock_baseline(uuid,uuid,uuid,uuid,text,integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_bizsathi_stock_baseline(uuid,uuid,uuid,uuid,text,integer,text)
  TO service_role;

-- New Auraluxe variants created by the authenticated BizSathi catalogue receiver
-- begin with website stock zero. Their later opening movements arrive via the
-- deferred, ordered BizSathi stock event outbox.
DO $new_sku_zero_baseline$
DECLARE
  body text;
  anchor text := 'v_created_variants:=v_created_variants+1;';
  addition text := $patch$
      IF v_remote_product_id IS NOT NULL AND v_remote_variant_id IS NOT NULL THEN
        INSERT INTO public.bizsathi_stock_baselines(
          bizsathi_product_id,bizsathi_variant_id,auraluxe_product_id,auraluxe_variant_id,
          sku,baseline_quantity,bizsathi_ledger_quantity,last_version,
          verification_reference,verified_by,baseline_source
        ) VALUES (
          v_remote_product_id,v_remote_variant_id,v_product_id,v_variant_id,
          lower(btrim(v_sku)),0,0,0,
          'Automatic zero opening baseline for a newly created BizSathi SKU; opening movements are delivered as ordered stock events',
          NULL,'new_sku_zero'
        )
        ON CONFLICT (bizsathi_variant_id) DO NOTHING;
      END IF;
$patch$;
  changed text;
BEGIN
  SELECT pg_get_functiondef('public.upsert_shared_catalogue_from_bizsathi(jsonb)'::regprocedure)
    INTO body;
  IF position('new_sku_zero' in body)>0 THEN
    RETURN;
  END IF;
  IF position(anchor in body)=0 THEN
    RAISE EXCEPTION 'Could not locate new BizSathi variant creation branch';
  END IF;
  changed:=replace(body,anchor,anchor||E'\n'||addition);
  IF changed=body OR position('new_sku_zero' in changed)=0 THEN
    RAISE EXCEPTION 'Could not install new SKU zero-baseline creation';
  END IF;
  EXECUTE changed;
END
$new_sku_zero_baseline$;

COMMENT ON COLUMN public.bizsathi_stock_baselines.baseline_source IS
  'physical_count = owner-verified count; new_sku_zero = zero website opening state for a newly created SKU whose BizSathi opening movements are queued; bizsathi_authoritative_bootstrap = one-time initial quantity copied from the authoritative BizSathi ledger.';
