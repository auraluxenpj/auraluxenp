-- 0035: preserve Auraluxe-origin product names after the safe catalogue receiver migration.
-- Auraluxe is authoritative for the product-name field only. All other shared
-- catalogue fields continue to be projected from BizSathi.
DO $preserve_auraluxe_product_names$
DECLARE
  body text;
  changed text;
  old_block text := 'UPDATE public.products SET name=v_name,category_id=v_category_id,price=v_price,';
  new_block text := 'UPDATE public.products SET category_id=v_category_id,price=v_price,';
BEGIN
  SELECT pg_get_functiondef('public.upsert_shared_catalogue_from_bizsathi(jsonb)'::regprocedure)
    INTO body;
  changed := replace(body, old_block, new_block);
  IF changed = body THEN
    RAISE EXCEPTION 'Could not locate the mapped-product name assignment in BizSathi catalogue import';
  END IF;
  EXECUTE changed;
END
$preserve_auraluxe_product_names$;

COMMENT ON FUNCTION public.upsert_shared_catalogue_from_bizsathi(jsonb) IS
  'SKU-first catalogue import from BizSathi. Auraluxe is authoritative for names of existing mapped products; BizSathi remains authoritative for SKU, category, price, variant data, publication state and inventory. Stock is never imported by this function.';
