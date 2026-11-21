-- Draft-only BizSathi catalogue import. No stock is imported and no product is published.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS bizsathi_variant_name text,
  ADD COLUMN IF NOT EXISTS bizsathi_model_code text;

CREATE OR REPLACE FUNCTION public.upsert_bizsathi_catalogue_drafts(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_category_id uuid;
  v_existing_product_id uuid;
  v_existing_variant_id uuid;
  v_slug text;
  v_category text;
  v_name text;
  v_variant_name text;
  v_model_code text;
  v_sku text;
  v_price numeric;
  v_product_price numeric;
  v_product_sku text;
  v_created_products integer := 0;
  v_updated_products integer := 0;
  v_created_variants integer := 0;
  v_updated_variants integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Server integration authentication required';
  END IF;
  IF jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_items) < 1
     OR jsonb_array_length(_items) > 500 THEN
    RAISE EXCEPTION 'Expected 1 to 500 catalogue rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY e.value->>'variant_id'
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY e.value->>'sku'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate variant identity or SKU in catalogue batch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY e.value->>'product_id'
    HAVING count(DISTINCT coalesce(e.value->>'name','')) > 1
       OR count(DISTINCT coalesce(e.value->>'category','')) > 1
  ) THEN
    RAISE EXCEPTION 'Inconsistent product fields within catalogue batch';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(_items) LOOP
    v_product_id := (r->>'product_id')::uuid;
    v_variant_id := (r->>'variant_id')::uuid;
    v_name := nullif(btrim(r->>'name'), '');
    v_category := coalesce(nullif(btrim(r->>'category'), ''), 'Uncategorised');
    v_variant_name := coalesce(nullif(btrim(r->>'variant_name'), ''), 'Standard');
    v_model_code := nullif(btrim(r->>'model_code'), '');
    v_sku := nullif(btrim(r->>'sku'), '');
    v_price := (r->>'selling_price')::numeric;
    SELECT min((e.value->>'selling_price')::numeric),
           CASE WHEN count(*) = 1 THEN max(e.value->>'sku') ELSE NULL END
      INTO v_product_price, v_product_sku
      FROM jsonb_array_elements(_items) AS e(value)
     WHERE e.value->>'product_id' = v_product_id::text;

    IF EXISTS (
      SELECT 1 FROM public.product_variants pv
       WHERE lower(btrim(pv.sku)) = lower(v_sku)
         AND pv.bizsathi_variant_id IS DISTINCT FROM v_variant_id
    ) OR EXISTS (
      SELECT 1 FROM public.products p
       WHERE p.sku IS NOT NULL
         AND lower(btrim(p.sku)) = lower(v_sku)
         AND p.bizsathi_product_id IS DISTINCT FROM v_product_id
    ) THEN
      RAISE EXCEPTION 'SKU already exists on an unmapped or different website record; manual identity review required';
    END IF;

    IF v_name IS NULL OR length(v_name) > 200
       OR length(v_category) > 100
       OR length(v_variant_name) > 100
       OR length(v_model_code) > 64
       OR v_sku IS NULL OR length(v_sku) > 80
       OR v_price IS NULL OR v_price < 0
       OR v_price::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Invalid catalogue row';
    END IF;

    v_slug := CASE lower(v_category)
      WHEN 'kurti' THEN 'kurtis'
      WHEN 'kurti set' THEN 'kurtis'
      WHEN 'dress' THEN 'dresses'
      WHEN 'suit' THEN 'suits'
      WHEN 'co-ord set' THEN 'co-ord-sets'
      ELSE trim(both '-' from regexp_replace(lower(v_category), '[^a-z0-9]+', '-', 'g'))
    END;
    IF v_slug = '' THEN v_slug := 'uncategorised'; END IF;
    INSERT INTO public.categories(name, slug)
    VALUES (v_category, v_slug)
    ON CONFLICT (slug) DO UPDATE SET name = categories.name
    RETURNING id INTO v_category_id;

    SELECT id INTO v_existing_product_id
      FROM public.products
     WHERE bizsathi_product_id = v_product_id
     FOR UPDATE;

    IF v_existing_product_id IS NULL THEN
      v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
      IF v_slug = '' THEN v_slug := 'product'; END IF;
      v_slug := left(v_slug, 160) || '-' || left(replace(v_product_id::text, '-', ''), 8);

      INSERT INTO public.products (
        name, slug, sku, category_id, price, stock, sizes, colors, images,
        is_published, bizsathi_product_id
      ) VALUES (
        v_name, v_slug, v_product_sku, v_category_id, v_product_price, 0, '{}', '{}', '{}',
        false, v_product_id
      )
      RETURNING id INTO v_existing_product_id;
      v_created_products := v_created_products + 1;
    ELSE
      UPDATE public.products
         SET name = v_name,
             sku = v_product_sku,
             category_id = v_category_id,
             price = v_product_price
       WHERE id = v_existing_product_id;
      v_updated_products := v_updated_products + 1;
    END IF;

    SELECT id INTO v_existing_variant_id
      FROM public.product_variants
     WHERE bizsathi_variant_id = v_variant_id
     FOR UPDATE;

    IF v_existing_variant_id IS NULL THEN
      INSERT INTO public.product_variants (
        product_id, size, color, sku, stock, bizsathi_variant_id, bizsathi_variant_name, bizsathi_model_code
      ) VALUES (
        v_existing_product_id, null, null, v_sku, 0, v_variant_id, v_variant_name, v_model_code
      );
      v_created_variants := v_created_variants + 1;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.product_variants
         WHERE id = v_existing_variant_id
           AND product_id = v_existing_product_id
      ) THEN
        RAISE EXCEPTION 'Mapped BizSathi variant belongs to a different website product';
      END IF;
      UPDATE public.product_variants
         SET sku = v_sku,
             bizsathi_variant_name = v_variant_name,
             bizsathi_model_code = v_model_code
       WHERE id = v_existing_variant_id;
      v_updated_variants := v_updated_variants + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_products', v_created_products,
    'updated_products', v_updated_products,
    'created_variants', v_created_variants,
    'updated_variants', v_updated_variants,
    'stock_imported', false,
    'products_published', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) TO service_role;
COMMENT ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) IS
  'Service-role-only, idempotent source-ID catalogue upsert. New products are unpublished drafts; stock and publishing are never changed.';
