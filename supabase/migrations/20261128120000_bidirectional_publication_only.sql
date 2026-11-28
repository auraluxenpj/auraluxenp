-- Bidirectional publication-only sync. Operational catalogue and inventory sync
-- remain one-way and retain their existing payloads and queue semantics.

CREATE OR REPLACE FUNCTION public.enqueue_bizsathi_publication_from_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v record;
BEGIN
  IF current_setting('app.catalogue_sync_origin',true) = 'bizsathi' THEN RETURN NEW; END IF;
  IF TG_OP <> 'UPDATE' OR NEW.is_published IS NOT DISTINCT FROM OLD.is_published THEN RETURN NEW; END IF;
  FOR v IN
    SELECT pv.id AS variant_id, pv.sku, pv.bizsathi_variant_id
      FROM public.product_variants pv
     WHERE pv.product_id = NEW.id
       AND pv.bizsathi_variant_id IS NOT NULL
       AND nullif(btrim(pv.sku),'') IS NOT NULL
     ORDER BY pv.id
  LOOP
    INSERT INTO public.bizsathi_catalogue_outbox(sku,payload)
    VALUES (v.sku, jsonb_build_object(
      'publication_only', true,
      'auraluxe_product_id', NEW.id,
      'auraluxe_variant_id', v.variant_id,
      'bizsathi_product_id', NEW.bizsathi_product_id,
      'bizsathi_variant_id', v.bizsathi_variant_id,
      'sku', v.sku,
      'published', NEW.is_published
    ));
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auraluxe_bizsathi_publication_outbox ON public.products;
CREATE TRIGGER auraluxe_bizsathi_publication_outbox
AFTER UPDATE OF is_published ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enqueue_bizsathi_publication_from_product();

CREATE OR REPLACE FUNCTION public.claim_bizsathi_catalogue_outbox(_lease uuid, _limit integer DEFAULT 50)
RETURNS SETOF public.bizsathi_catalogue_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' OR _lease IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Service authorization and valid lease required';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT o.id
      FROM public.bizsathi_catalogue_outbox o
     WHERE o.payload->>'publication_only' = 'true'
       AND ((o.status='pending' AND o.available_at<=now())
         OR (o.status='processing' AND o.locked_until<now()))
     ORDER BY o.id
     FOR UPDATE SKIP LOCKED
     LIMIT _limit
  )
  UPDATE public.bizsathi_catalogue_outbox o
     SET status='processing', lease_token=_lease,
         locked_until=now()+interval '2 minutes', attempts=attempts+1
    FROM picked
   WHERE o.id=picked.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_bizsathi_publication(
  _bizsathi_product_id uuid, _bizsathi_variant_id uuid, _sku text, _published boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_product_id uuid;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' OR auth.uid() IS NOT NULL
     OR _bizsathi_product_id IS NULL OR _bizsathi_variant_id IS NULL
     OR nullif(btrim(_sku),'') IS NULL OR _published IS NULL THEN
    RAISE EXCEPTION 'Authorized publication event required';
  END IF;
  SELECT p.id INTO v_product_id
    FROM public.products p
    JOIN public.product_variants pv ON pv.product_id=p.id
   WHERE p.bizsathi_product_id=_bizsathi_product_id
     AND pv.bizsathi_variant_id=_bizsathi_variant_id
     AND lower(btrim(pv.sku))=lower(btrim(_sku))
   FOR UPDATE OF p;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Publication event SKU or cross-system mapping does not match';
  END IF;
  PERFORM set_config('app.catalogue_sync_origin','bizsathi',true);
  UPDATE public.products SET is_published=_published, updated_at=now() WHERE id=v_product_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_bizsathi_publication(uuid,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bizsathi_publication(uuid,uuid,text,boolean) TO service_role;
