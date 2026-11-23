-- 0025: shared SKU-first catalogue import. Model Code is reference metadata only.
-- Draft catalogue fields are synchronised; stock remains on the transactional inventory ledger.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS purchase_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrp numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS notes text;

-- Remove any legacy unique index/constraint that treats Model Code as product identity.
DO $drop_model_code_uniqueness$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
     WHERE n.nspname='public' AND t.relname='products' AND c.contype='u'
       AND pg_get_constraintdef(c.oid) ILIKE '%model_code%'
  LOOP
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I',r.conname);
  END LOOP;
  FOR r IN
    SELECT i.indexrelid::regclass AS index_name
      FROM pg_index i
      JOIN pg_class t ON t.oid=i.indrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attname='model_code'
     WHERE n.nspname='public' AND t.relname='products'
       AND i.indisunique AND a.attnum=ANY(i.indkey)
       AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %s',r.index_name);
  END LOOP;
END
$drop_model_code_uniqueness$;

CREATE OR REPLACE FUNCTION public.upsert_shared_catalogue_from_bizsathi(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r jsonb;
  v_sku text;
  v_name text;
  v_category text;
  v_unit text;
  v_model_code text;
  v_barcode text;
  v_category_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_remote_product_id uuid;
  v_remote_variant_id uuid;
  v_slug text;
  v_sizes text[];
  v_purchase numeric;
  v_mrp numeric;
  v_price numeric;
  v_wholesale numeric;
  v_reorder numeric;
  v_published boolean;
  v_qty numeric;
  v_created_products integer := 0;
  v_updated_products integer := 0;
  v_created_variants integer := 0;
  v_updated_variants integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Server integration authentication required'; END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_items) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Expected 1 to 500 catalogue rows';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_items) e
     WHERE nullif(btrim(e.value->>'sku'),'') IS NULL
        OR length(btrim(e.value->>'sku'))>80
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(_items) e
     GROUP BY lower(btrim(e.value->>'sku')) HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'SKU is required and must be unique within the batch'; END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(_items) LOOP
    v_sku:=btrim(r->>'sku');
    v_name:=nullif(btrim(r->>'name'),'');
    v_name:=coalesce(v_name,v_sku);
    v_category:=coalesce(nullif(btrim(r->>'category'),''),'Uncategorised');
    v_unit:=coalesce(nullif(btrim(r->>'unit'),''),'pcs');
    v_model_code:=nullif(btrim(r->>'model_code'),'');
    v_barcode:=nullif(btrim(r->>'barcode'),'');
    v_remote_product_id:=nullif(r->>'product_id','')::uuid;
    v_remote_variant_id:=nullif(r->>'variant_id','')::uuid;
    v_purchase:=coalesce(nullif(r->>'purchase_price','')::numeric,0);
    v_mrp:=coalesce(nullif(r->>'mrp','')::numeric,0);
    v_price:=coalesce(nullif(r->>'selling_price','')::numeric,0);
    v_wholesale:=coalesce(nullif(r->>'wholesale_price','')::numeric,0);
    v_reorder:=coalesce(nullif(r->>'reorder_level','')::numeric,0);
    v_qty:=coalesce(nullif(r->>'qty','')::numeric,0);
    v_published:=coalesce((r->>'published')::boolean,false);
    SELECT coalesce(array_agg(btrim(x) ORDER BY ord),'{}'::text[])
      INTO v_sizes
      FROM jsonb_array_elements_text(coalesce(r->'sizes','[]'::jsonb)) WITH ORDINALITY s(x,ord)
     WHERE btrim(x)<>'';

    IF length(v_name)>200 OR length(v_category)>100 OR length(v_unit)>30
       OR v_purchase<0 OR v_mrp<0 OR v_price<0 OR v_wholesale<0 OR v_reorder<0
       OR v_qty<0 OR v_purchase::text IN ('NaN','Infinity','-Infinity')
       OR v_mrp::text IN ('NaN','Infinity','-Infinity')
       OR v_price::text IN ('NaN','Infinity','-Infinity')
       OR v_wholesale::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Invalid catalogue values for SKU %',v_sku;
    END IF;

    IF v_barcode IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.product_variants pv
       WHERE pv.barcode=v_barcode AND lower(btrim(pv.sku))<>lower(v_sku)
    ) THEN RAISE EXCEPTION 'Barcode is already assigned to another SKU'; END IF;

    SELECT pv.id,pv.product_id INTO v_variant_id,v_product_id
      FROM public.product_variants pv
     WHERE lower(btrim(pv.sku))=lower(v_sku)
     FOR UPDATE;
    IF v_variant_id IS NULL THEN
      SELECT p.id INTO v_product_id FROM public.products p
       WHERE p.sku IS NOT NULL AND lower(btrim(p.sku))=lower(v_sku)
       FOR UPDATE;
    END IF;

    IF v_product_id IS NULL THEN
      v_slug:=trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g'));
      IF v_slug='' THEN v_slug:='product'; END IF;
      v_slug:=left(v_slug,150)||'-'||left(md5(v_sku),10);
      INSERT INTO public.categories(name,slug)
      VALUES(v_category,coalesce(nullif(trim(both '-' from regexp_replace(lower(v_category),'[^a-z0-9]+','-','g')),''),'uncategorised'))
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name
      RETURNING id INTO v_category_id;
      INSERT INTO public.products(name,slug,sku,category_id,price,stock,sizes,model_code,is_published,notes,bizsathi_product_id)
      VALUES(v_name,v_slug,v_sku,v_category_id,v_price,0,v_sizes,v_model_code,v_published,nullif(r->>'notes',''),v_remote_product_id)
      RETURNING id INTO v_product_id;
      v_created_products:=v_created_products+1;
    ELSE
      INSERT INTO public.categories(name,slug)
      VALUES(v_category,coalesce(nullif(trim(both '-' from regexp_replace(lower(v_category),'[^a-z0-9]+','-','g')),''),'uncategorised'))
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name
      RETURNING id INTO v_category_id;
      UPDATE public.products SET name=v_name,category_id=v_category_id,price=v_price,
        sizes=v_sizes,model_code=v_model_code,is_published=v_published,
        notes=nullif(r->>'notes',''),
        bizsathi_product_id=coalesce(v_remote_product_id,bizsathi_product_id),
        sku=coalesce(sku,v_sku),updated_at=now()
       WHERE id=v_product_id;
      v_updated_products:=v_updated_products+1;
    END IF;

    IF v_variant_id IS NULL THEN
      INSERT INTO public.product_variants(product_id,sku,stock,bizsathi_variant_id,bizsathi_variant_name,bizsathi_model_code,barcode,unit,purchase_price,mrp,wholesale_price,reorder_level,notes)
      VALUES(v_product_id,v_sku,0,v_remote_variant_id,'Standard',v_model_code,v_barcode,v_unit,v_purchase,v_mrp,v_wholesale,v_reorder,nullif(r->>'notes',''))
      RETURNING id INTO v_variant_id;
      v_created_variants:=v_created_variants+1;
    ELSE
      IF (SELECT product_id FROM public.product_variants WHERE id=v_variant_id)<>v_product_id THEN
        RAISE EXCEPTION 'SKU maps to a different product';
      END IF;
      UPDATE public.product_variants SET
        bizsathi_variant_id=coalesce(v_remote_variant_id,bizsathi_variant_id),
        bizsathi_model_code=v_model_code,barcode=v_barcode,unit=v_unit,
        purchase_price=v_purchase,mrp=v_mrp,wholesale_price=v_wholesale,
        reorder_level=v_reorder,notes=nullif(r->>'notes','')
       WHERE id=v_variant_id;
      v_updated_variants:=v_updated_variants+1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created_products',v_created_products,'updated_products',v_updated_products,
    'created_variants',v_created_variants,'updated_variants',v_updated_variants,
    'identity_key','sku','model_code_unique',false,'stock_imported',false,
    'published_from_source',true,'website_enrichment_preserved',true);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_shared_catalogue_from_bizsathi(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_shared_catalogue_from_bizsathi(jsonb) TO service_role;
COMMENT ON FUNCTION public.upsert_shared_catalogue_from_bizsathi(jsonb) IS
  'SKU-first catalogue upsert from BizSathi. Model Code is non-unique metadata. Does not change stock or overwrite website-only enrichment fields.';
