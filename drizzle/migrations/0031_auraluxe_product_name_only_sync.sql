-- 0031: Auraluxe owns product names for already-mapped BizSathi products.
-- Keep every other field in the existing catalogue import unchanged.
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
  'SKU-first catalogue import from BizSathi. Auraluxe remains authoritative for names of existing mapped products; other catalogue fields continue to sync and stock is never imported.';
