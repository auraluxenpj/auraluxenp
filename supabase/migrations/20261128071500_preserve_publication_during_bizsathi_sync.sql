-- Preserve Auraluxe storefront publication during BizSathi catalogue sync.
-- Existing products keep their current is_published value. Newly created
-- products remain unpublished drafts. Full snapshots never unpublish products
-- merely because an SKU is missing from the snapshot.

CREATE OR REPLACE FUNCTION public.upsert_shared_catalogue_from_bizsathi(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
  v_published boolean := false;
  v_qty numeric;
  v_created_products integer := 0;
  v_updated_products integer := 0;
  v_created_variants integer := 0;
  v_updated_variants integer := 0;
  v_mappings jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('app.catalogue_sync_origin','bizsathi',true);
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Server integration authentication required'; END IF;
  IF NOT coalesce((SELECT catalogue_enabled FROM public.bizsathi_sync_control WHERE id=1),false) THEN
    RAISE EXCEPTION 'BizSathi catalogue sync is disabled';
  END IF;
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
      VALUES(v_name,v_slug,v_sku,v_category_id,v_price,0,v_sizes,v_model_code,false,nullif(r->>'notes',''),v_remote_product_id)
      RETURNING id INTO v_product_id;
      v_created_products:=v_created_products+1;
    ELSE
      INSERT INTO public.categories(name,slug)
      VALUES(v_category,coalesce(nullif(trim(both '-' from regexp_replace(lower(v_category),'[^a-z0-9]+','-','g')),''),'uncategorised'))
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name
      RETURNING id INTO v_category_id;
      UPDATE public.products SET category_id=v_category_id,price=v_price,
        sizes=v_sizes,model_code=v_model_code,
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
    v_mappings:=v_mappings||jsonb_build_array(jsonb_build_object(
      'sku',v_sku,'auraluxe_product_id',v_product_id,'auraluxe_variant_id',v_variant_id,
      'bizsathi_product_id',v_remote_product_id,'bizsathi_variant_id',v_remote_variant_id));
  END LOOP;

  RETURN jsonb_build_object('created_products',v_created_products,'updated_products',v_updated_products,
    'created_variants',v_created_variants,'updated_variants',v_updated_variants,
    'identity_key','sku','model_code_unique',false,'stock_imported',false,
    'published_from_source',false,'publication_preserved_on_update',true,'mappings',v_mappings);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_bizsathi_catalogue(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  mappings jsonb := '[]'::jsonb;
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

  -- Publication is Auraluxe storefront state. A full catalogue snapshot is
  -- not an instruction to unpublish products or variants missing from the batch.
  RETURN result || jsonb_build_object(
    'mappings', mappings,
    'unpublished_products', 0,
    'unpublished_items', '[]'::jsonb,
    'publication_preserved', true,
    'authority', 'bizsathi'
  );
END
$function$;
