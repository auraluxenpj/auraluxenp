-- 0033: make BizSathi the source of truth for storefront publication state.
-- Existing mapped products mirror the source published flag; new products remain drafts
-- unless BizSathi explicitly publishes them. No stock or website enrichment is changed.
DO $bizsathi_publication_state$
DECLARE
  body text;
  changed text;
  old_assignment text := 'v_published:=false;';
  old_product_update text := 'UPDATE public.products SET category_id=v_category_id,price=v_price,';
  new_product_update text := 'UPDATE public.products SET name=v_name,category_id=v_category_id,price=v_price,';
  new_assignment text := 'v_published:=coalesce((r->>''published'')::boolean,false);';
BEGIN
  SELECT pg_get_functiondef('public.upsert_shared_catalogue_from_bizsathi(jsonb)'::regprocedure)
    INTO body;

  IF position(new_assignment in body) = 0 THEN
    IF position(old_assignment in body) = 0 THEN
      RAISE EXCEPTION 'Could not locate the BizSathi publication assignment';
    END IF;

    changed := replace(body, old_assignment, new_assignment);
    IF changed = body OR position(new_assignment in changed) = 0 THEN
      RAISE EXCEPTION 'BizSathi publication-state patch was not applied';
    END IF;

    EXECUTE changed;
    SELECT pg_get_functiondef('public.upsert_shared_catalogue_from_bizsathi(jsonb)'::regprocedure) INTO body;
  END IF;

  IF position(new_product_update in body) = 0 THEN
    IF position(old_product_update in body) = 0 THEN
      RAISE EXCEPTION 'Could not locate the BizSathi product-name update';
    END IF;
    changed := replace(body, old_product_update, new_product_update);
    IF changed = body OR position(new_product_update in changed) = 0 THEN
      RAISE EXCEPTION 'BizSathi product-name patch was not applied';
    END IF;
    EXECUTE changed;
  END IF;
END
$bizsathi_publication_state$;

COMMENT ON FUNCTION public.upsert_shared_catalogue_from_bizsathi(jsonb) IS
  'SKU-first catalogue import from BizSathi. BizSathi is authoritative for shared catalogue fields, product name, and publication state; Auraluxe website-only enrichment is preserved; stock is never imported.';
