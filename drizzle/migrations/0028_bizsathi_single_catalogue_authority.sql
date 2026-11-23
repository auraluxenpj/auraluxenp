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

-- Once the integration is installed, Auraluxe may not originate stock edits.
-- Only the approved baseline and BizSathi event receiver set this transaction-local marker.
CREATE OR REPLACE FUNCTION public.guard_bizsathi_stock_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_setting('app.stock_sync_origin',true)='bizsathi' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND coalesce(NEW.stock,0)=0 THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.stock IS NOT DISTINCT FROM OLD.stock THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'BizSathi is the sole stock authority; Auraluxe stock edits are disabled';
END $$;
REVOKE ALL ON FUNCTION public.guard_bizsathi_stock_authority() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS bizsathi_stock_authority_products ON public.products;
CREATE TRIGGER bizsathi_stock_authority_products
  BEFORE INSERT OR UPDATE OF stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_bizsathi_stock_authority();
DROP TRIGGER IF EXISTS bizsathi_stock_authority_variants ON public.product_variants;
CREATE TRIGGER bizsathi_stock_authority_variants
  BEFORE INSERT OR UPDATE OF stock ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.guard_bizsathi_stock_authority();

-- Once BizSathi catalogue sync is approved, an Auraluxe-only product cannot be
-- republished. The full-snapshot reconciliation unpublishes products absent from BizSathi.
CREATE OR REPLACE FUNCTION public.guard_bizsathi_catalogue_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF current_setting('app.catalogue_sync_origin',true)='bizsathi' THEN RETURN NEW; END IF;
  IF coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),false)
     AND NEW.is_published THEN
    IF NEW.bizsathi_product_id IS NULL OR EXISTS (
      SELECT 1 FROM public.product_variants pv
       WHERE pv.product_id=NEW.id AND pv.bizsathi_variant_id IS NULL
    ) OR NOT EXISTS (
      SELECT 1 FROM public.product_variants pv
       WHERE pv.product_id=NEW.id AND pv.bizsathi_variant_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Only products fully mapped to BizSathi may be published';
    END IF;
  END IF;
  RETURN NEW;
END $;
REVOKE ALL ON FUNCTION public.guard_bizsathi_catalogue_publication() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS bizsathi_catalogue_publication_guard ON public.products;
CREATE TRIGGER bizsathi_catalogue_publication_guard
  BEFORE INSERT OR UPDATE OF is_published,bizsathi_product_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_bizsathi_catalogue_publication();

CREATE OR REPLACE FUNCTION public.guard_bizsathi_variant_mapping()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mapped_product uuid; published boolean;
BEGIN
  IF current_setting('app.catalogue_sync_origin',true)='bizsathi' THEN RETURN NEW; END IF;
  IF NOT coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),false) THEN
    RETURN NEW;
  END IF;
  SELECT bizsathi_product_id,is_published INTO mapped_product,published
    FROM public.products WHERE id=NEW.product_id;
  IF published AND mapped_product IS NOT NULL AND NEW.bizsathi_variant_id IS NULL THEN
    RAISE EXCEPTION 'Every published product variant must be mapped to BizSathi';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_bizsathi_variant_mapping() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS bizsathi_variant_mapping_guard ON public.product_variants;
CREATE TRIGGER bizsathi_variant_mapping_guard
  BEFORE INSERT OR UPDATE OF bizsathi_variant_id,product_id ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.guard_bizsathi_variant_mapping();
