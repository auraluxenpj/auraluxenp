-- 0024: Make the exact Auraluxe variant SKU the primary catalogue matching key.
-- Existing website rows are linked in place; ambiguous identities stop for manual review.
-- This migration changes no stock, publication state, images, descriptions, or checkout settings.

CREATE OR REPLACE FUNCTION public.upsert_bizsathi_catalogue_drafts(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row record;
  item_row record;
  v_source_product_id uuid;
  v_source_variant_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_sku_product_id uuid;
  v_sku_variant_id uuid;
  v_id_variant_id uuid;
  v_id_variant_product_id uuid;
  v_match_products integer;
  v_sku_variant_count integer;
  v_created_products integer := 0;
  v_updated_products integer := 0;
  v_created_variants integer := 0;
  v_updated_variants integer := 0;
  v_name text;
  v_category text;
  v_variant_name text;
  v_model_code text;
  v_sku text;
  v_price numeric;
  v_product_price numeric;
  v_product_sku text;
  v_product_model_code text;
  v_slug text;
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
    SELECT 1 FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY lower(btrim(e.value->>'sku')) HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY e.value->>'variant_id' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate variant identity or SKU in catalogue batch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY e.value->>'product_id'
    HAVING count(DISTINCT coalesce(e.value->>'name','')) > 1
       OR count(DISTINCT coalesce(e.value->>'category','')) > 1
  ) THEN
    RAISE EXCEPTION 'Inconsistent product fields within catalogue batch';
  END IF;

  -- SKU is the identity key. Any duplicate website SKU is ambiguous, even if
  -- the duplicate rows happen to belong to the same product.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_items) AS e(value)
      JOIN public.product_variants pv
        ON lower(btrim(pv.sku)) = lower(btrim(e.value->>'sku'))
     GROUP BY lower(btrim(e.value->>'sku'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Website contains duplicate SKU rows; manual identity review required';
  END IF;

  -- A product-level SKU cannot be silently converted into a variant mapping.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(_items) AS e(value)
      JOIN public.products p
        ON p.sku IS NOT NULL
       AND lower(btrim(p.sku)) = lower(btrim(e.value->>'sku'))
  ) THEN
    RAISE EXCEPTION 'SKU matches a product-level SKU, not a unique variant; manual identity review required';
  END IF;

  FOR product_row IN
    SELECT
      (e.value->>'product_id')::uuid AS product_id,
      max(nullif(btrim(e.value->>'name'), '')) AS name,
      max(coalesce(nullif(btrim(e.value->>'category'), ''), 'Uncategorised')) AS category,
      min((e.value->>'selling_price')::numeric) AS product_price,
      CASE WHEN count(*) = 1 THEN max(e.value->>'sku') ELSE NULL END AS product_sku,
      CASE WHEN count(*) = 1 THEN max(e.value->>'model_code') ELSE NULL END AS product_model_code
    FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY (e.value->>'product_id')::uuid
    ORDER BY (e.value->>'product_id')::uuid
  LOOP
    v_source_product_id := product_row.product_id;
    v_name := product_row.name;
    v_category := product_row.category;
    v_product_price := product_row.product_price;
    v_product_sku := product_row.product_sku;
    v_product_model_code := product_row.product_model_code;

    IF v_name IS NULL OR length(v_name) > 200
       OR length(v_category) > 100
       OR v_product_price IS NULL OR v_product_price < 0
       OR v_product_price::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Invalid catalogue product';
    END IF;

    -- All incoming SKUs for one BizSathi product must resolve to one
    -- Auraluxe product. No name or slug matching is attempted.
    SELECT count(DISTINCT pv.product_id), min(pv.product_id)
      INTO v_match_products, v_sku_product_id
      FROM public.product_variants pv
      JOIN jsonb_array_elements(_items) AS e(value)
        ON lower(btrim(pv.sku)) = lower(btrim(e.value->>'sku'))
     WHERE (e.value->>'product_id')::uuid = v_source_product_id;

    IF v_match_products > 1 THEN
      RAISE EXCEPTION 'SKUs for one BizSathi product resolve to different Auraluxe products; manual review required';
    END IF;

    SELECT p.id INTO v_product_id
      FROM public.products p
     WHERE p.bizsathi_product_id = v_source_product_id
     FOR UPDATE;

    IF v_product_id IS NOT NULL AND v_sku_product_id IS NOT NULL
       AND v_product_id <> v_sku_product_id THEN
      RAISE EXCEPTION 'BizSathi product ID and SKU resolve to different Auraluxe products';
    END IF;

    IF v_product_id IS NULL THEN
      v_product_id := v_sku_product_id;
      IF v_product_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.products p
           WHERE p.id = v_product_id
             AND p.bizsathi_product_id IS NOT NULL
             AND p.bizsathi_product_id <> v_source_product_id
        ) THEN
          RAISE EXCEPTION 'SKU-matched Auraluxe product is already linked to another BizSathi product';
        END IF;
        UPDATE public.products
           SET bizsathi_product_id = v_source_product_id
         WHERE id = v_product_id;
        v_updated_products := v_updated_products + 1;
      END IF;
    END IF;

    IF v_product_id IS NULL THEN
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

      v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
      IF v_slug = '' THEN v_slug := 'product'; END IF;
      v_slug := left(v_slug, 160) || '-' || left(replace(v_source_product_id::text, '-', ''), 8);

      INSERT INTO public.products (
        name, slug, sku, category_id, price, stock, sizes, colors, images, model_code,
        is_published, bizsathi_product_id
      ) VALUES (
        v_name, v_slug, v_product_sku, v_category_id, v_product_price, 0, '{}', '{}', '{}',
        v_product_model_code, false, v_source_product_id
      )
      RETURNING id INTO v_product_id;
      v_created_products := v_created_products + 1;
    ELSE
      -- Preserve all existing website content when linking by SKU. Only a
      -- previously ID-mapped record retains the legacy catalogue field refresh.
      IF EXISTS (
        SELECT 1 FROM public.products
         WHERE id = v_product_id
           AND bizsathi_product_id = v_source_product_id
           AND v_product_id <> v_sku_product_id
      ) THEN
        INSERT INTO public.categories(name, slug)
        VALUES (
          v_category,
          CASE lower(v_category)
            WHEN 'kurti' THEN 'kurtis'
            WHEN 'kurti set' THEN 'kurtis'
            WHEN 'dress' THEN 'dresses'
            WHEN 'suit' THEN 'suits'
            WHEN 'co-ord set' THEN 'co-ord-sets'
            ELSE coalesce(nullif(trim(both '-' from regexp_replace(lower(v_category), '[^a-z0-9]+', '-', 'g')), ''), 'uncategorised')
          END
        )
        ON CONFLICT (slug) DO UPDATE SET name = categories.name
        RETURNING id INTO v_category_id;

        UPDATE public.products
           SET name = v_name,
               sku = v_product_sku,
               category_id = v_category_id,
               price = v_product_price,
               model_code = v_product_model_code
         WHERE id = v_product_id;
        v_updated_products := v_updated_products + 1;
      END IF;
    END IF;

    FOR item_row IN
      SELECT value FROM jsonb_array_elements(_items)
       WHERE value->>'product_id' = v_source_product_id::text
       ORDER BY value->>'sku'
    LOOP
      v_source_variant_id := (item_row.value->>'variant_id')::uuid;
      v_variant_name := coalesce(nullif(btrim(item_row.value->>'variant_name'), ''), 'Standard');
      v_model_code := nullif(btrim(item_row.value->>'model_code'), '');
      v_sku := nullif(btrim(item_row.value->>'sku'), '');
      v_price := (item_row.value->>'selling_price')::numeric;

      IF v_variant_name IS NULL OR length(v_variant_name) > 100
         OR length(v_model_code) > 64
         OR v_sku IS NULL OR length(v_sku) > 80
         OR v_price IS NULL OR v_price < 0
         OR v_price::text IN ('NaN','Infinity','-Infinity') THEN
        RAISE EXCEPTION 'Invalid catalogue variant';
      END IF;

      SELECT pv.id, pv.product_id
        INTO v_sku_variant_id, v_id_variant_product_id
        FROM public.product_variants pv
       WHERE lower(btrim(pv.sku)) = lower(v_sku)
       FOR UPDATE;

      SELECT pv.id, pv.product_id, pv.sku
        INTO v_id_variant_id, v_id_variant_product_id, v_name
        FROM public.product_variants pv
       WHERE pv.bizsathi_variant_id = v_source_variant_id
       FOR UPDATE;

      IF v_id_variant_id IS NOT NULL AND lower(btrim(v_name)) <> lower(v_sku) THEN
        RAISE EXCEPTION 'BizSathi variant ID is already linked to a different SKU';
      END IF;
      IF v_sku_variant_id IS NOT NULL AND v_id_variant_id IS NOT NULL
         AND v_sku_variant_id <> v_id_variant_id THEN
        RAISE EXCEPTION 'SKU and BizSathi variant ID resolve to different Auraluxe variants';
      END IF;

      IF v_sku_variant_id IS NOT NULL THEN
        IF v_id_variant_product_id IS NOT NULL AND v_id_variant_product_id <> v_product_id THEN
          RAISE EXCEPTION 'SKU-matched variant belongs to a different Auraluxe product';
        END IF;
        IF EXISTS (
          SELECT 1 FROM public.product_variants
           WHERE id = v_sku_variant_id
             AND bizsathi_variant_id IS NOT NULL
             AND bizsathi_variant_id <> v_source_variant_id
        ) THEN
          RAISE EXCEPTION 'SKU is already linked to another BizSathi variant';
        END IF;
        UPDATE public.product_variants
           SET bizsathi_variant_id = v_source_variant_id,
               bizsathi_variant_name = v_variant_name,
               bizsathi_model_code = v_model_code
         WHERE id = v_sku_variant_id;
        v_updated_variants := v_updated_variants + 1;
      ELSIF v_id_variant_id IS NOT NULL THEN
        IF v_id_variant_product_id <> v_product_id THEN
          RAISE EXCEPTION 'Mapped BizSathi variant belongs to a different website product';
        END IF;
        UPDATE public.product_variants
           SET bizsathi_variant_name = v_variant_name,
               bizsathi_model_code = v_model_code
         WHERE id = v_id_variant_id;
        v_updated_variants := v_updated_variants + 1;
      ELSE
        INSERT INTO public.product_variants (
          product_id, size, color, sku, stock, bizsathi_variant_id,
          bizsathi_variant_name, bizsathi_model_code
        ) VALUES (
          v_product_id, null, null, v_sku, 0, v_source_variant_id,
          v_variant_name, v_model_code
        );
        v_created_variants := v_created_variants + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'created_products', v_created_products,
    'updated_products', v_updated_products,
    'created_variants', v_created_variants,
    'updated_variants', v_updated_variants,
    'stock_imported', false,
    'products_published', false,
    'matching_authority', 'exact_sku'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) TO service_role;

COMMENT ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) IS
  'Service-role-only catalogue upsert. Exact SKU is the primary variant match; immutable BizSathi IDs are attached after a safe SKU match. New products remain unpublished drafts. Never changes stock or publishes products.';
