-- 0028: BizSathi is the sole catalogue authority for Auraluxe.
-- Keep historical outbox rows for audit, but stop Auraluxe-origin catalogue publication.
DROP TRIGGER IF EXISTS bizsathi_catalogue_variant_outbox ON public.product_variants;
DROP TRIGGER IF EXISTS bizsathi_catalogue_product_outbox ON public.products;

CREATE OR REPLACE FUNCTION public.claim_bizsathi_catalogue_outbox(_lease uuid,_limit integer DEFAULT 50)
RETURNS SETOF public.bizsathi_catalogue_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' OR _lease IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Service authorization and valid lease required';
  END IF;
  -- Auraluxe is a read-only storefront for catalogue data. Preserve old queue
  -- records, but never send Auraluxe-origin edits back into BizSathi.
  RETURN;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_bizsathi_catalogue(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; deactivated integer:=0;
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

  result:=public.upsert_shared_catalogue_from_bizsathi(_items);

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
  RETURN result || jsonb_build_object('unpublished_products',deactivated,'authority','bizsathi');
END $$;
REVOKE ALL ON FUNCTION public.reconcile_bizsathi_catalogue(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_bizsathi_catalogue(jsonb) TO service_role;
