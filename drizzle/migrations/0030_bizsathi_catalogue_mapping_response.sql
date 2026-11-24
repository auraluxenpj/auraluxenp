-- 0030: return verified source-to-target SKU mappings from full catalogue reconciliation.
-- The BizSathi publisher must persist every mapping before it can mark the snapshot complete.
CREATE OR REPLACE FUNCTION public.reconcile_bizsathi_catalogue(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  result jsonb;
  mappings jsonb := '[]'::jsonb;
  deactivated integer := 0;
  unpublished jsonb := '[]'::jsonb;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'BizSathi service authentication required';
  END IF;
  IF NOT coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),false) THEN
    RAISE EXCEPTION 'BizSathi catalogue authority is not enabled';
  END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_items) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Expected a complete BizSathi catalogue snapshot';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_items) e
    WHERE nullif(btrim(e.value->>'sku'),'') IS NULL
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(_items) e
    GROUP BY lower(btrim(e.value->>'sku')) HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Snapshot contains missing or duplicate SKU values';
  END IF;

  result := public.upsert_shared_catalogue_from_bizsathi(_items);

  -- Return only mappings whose SKU, BizSathi variant ID and BizSathi product ID
  -- all match the exact source row. If any row cannot be resolved, abort the
  -- whole transaction so the publisher cannot persist a partial mapping set.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'sku', btrim(e.value->>'sku'),
    'bizsathi_product_id', (e.value->>'product_id')::uuid,
    'bizsathi_variant_id', (e.value->>'variant_id')::uuid,
    'auraluxe_product_id', p.id,
    'auraluxe_variant_id', pv.id
  ) ORDER BY lower(btrim(e.value->>'sku'))), '[]'::jsonb)
    INTO mappings
    FROM jsonb_array_elements(_items) e
    JOIN public.product_variants pv
      ON lower(btrim(pv.sku))=lower(btrim(e.value->>'sku'))
     AND pv.bizsathi_variant_id=(e.value->>'variant_id')::uuid
    JOIN public.products p
      ON p.id=pv.product_id
     AND p.bizsathi_product_id=(e.value->>'product_id')::uuid;

  IF jsonb_array_length(mappings) <> jsonb_array_length(_items) THEN
    RAISE EXCEPTION 'Catalogue reconciliation could not resolve every source SKU mapping';
  END IF;

  -- Return an auditable list of products that will be unpublished.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'product_id',p.id,'name',p.name,
    'skus',(SELECT coalesce(jsonb_agg(pv.sku ORDER BY pv.sku),'[]'::jsonb)
              FROM public.product_variants pv WHERE pv.product_id=p.id)
  ) ORDER BY p.id),'[]'::jsonb)
    INTO unpublished
    FROM public.products p
   WHERE p.is_published=true
     AND (
       NOT EXISTS (SELECT 1 FROM public.product_variants pv WHERE pv.product_id=p.id)
       OR EXISTS (
         SELECT 1 FROM public.product_variants pv
          WHERE pv.product_id=p.id
            AND lower(btrim(pv.sku)) NOT IN (
              SELECT lower(btrim(e.value->>'sku')) FROM jsonb_array_elements(_items) e
            )
       )
     );

  -- Product remains listed only when every one of its variants is represented
  -- by the authoritative BizSathi snapshot. Never hard-delete or rewrite history.
  UPDATE public.products p
     SET is_published=false,updated_at=now()
   WHERE p.is_published=true
     AND (
       NOT EXISTS (SELECT 1 FROM public.product_variants pv WHERE pv.product_id=p.id)
       OR EXISTS (
         SELECT 1 FROM public.product_variants pv
          WHERE pv.product_id=p.id
            AND lower(btrim(pv.sku)) NOT IN (
              SELECT lower(btrim(e.value->>'sku')) FROM jsonb_array_elements(_items) e
            )
       )
     );
  GET DIAGNOSTICS deactivated=ROW_COUNT;

  RETURN result || jsonb_build_object(
    'mappings', mappings,
    'unpublished_products', deactivated,
    'unpublished_items', unpublished,
    'authority', 'bizsathi'
  );
END
$$;

REVOKE ALL ON FUNCTION public.reconcile_bizsathi_catalogue(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_bizsathi_catalogue(jsonb) TO service_role;

COMMENT ON FUNCTION public.reconcile_bizsathi_catalogue(jsonb) IS
  'Reconciles a complete BizSathi SKU snapshot, returns exact verified source-to-target mappings, and never imports stock.';
