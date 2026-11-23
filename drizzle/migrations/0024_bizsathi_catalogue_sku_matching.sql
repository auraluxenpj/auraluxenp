-- 0024: Match the incoming BizSathi catalogue to existing Auraluxe records by exact SKU.
-- SKU is the reconciliation key; source IDs are attached only after a SKU match.
-- Existing website content and all stock/publishing fields are preserved.
-- This migration is staged for review and is not applied to production by this change.

CREATE INDEX IF NOT EXISTS product_variants_sku_normalized_idx
  ON public.product_variants (lower(btrim(sku)))
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_sku_normalized_idx
  ON public.products (lower(btrim(sku)))
  WHERE sku IS NOT NULL;

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
  v_mapped_product_id uuid;
  v_existing_variant_id uuid;
  v_mapped_variant_id uuid;
  v_sku_variant_id uuid;
  v_sku_variant_product_id uuid;
  v_candidate_product_id uuid;
  v_candidate_count integer;
  v_variant_count integer;
  v_slug text;
  v_category text;
  v_name text;
  v_variant_name text;
  v_model_code text;
  v_sku text;
  v_price numeric;
  v_product_price numeric;
  v_product_sku text;
  v_product_model_code text;
  v_created_products integer := 0;
  v_linked_products integer := 0;
  v_created_variants integer := 0;
  v_linked_variants integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Server integration authentication required';
  END IF;
  IF jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_items) < 1
     OR jsonb_array_length(_items) > 500 THEN
    RAISE EXCEPTION 'Expected 1 to 500 catalogue rows';
  END IF;

  -- Serialize catalogue upserts so two overlapping batches cannot claim the
  -- same previously-unmapped SKU/product at the same time.
  PERFORM pg_advisory_xact_lock(hashtext('upsert_bizsathi_catalogue_drafts'));

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY lower(btrim(e.value->>'variant_id'))
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_items) AS e(value)
    GROUP BY lower(btrim(e.value->>'sku'))
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

    IF v_name IS NULL OR length(v_name) > 200
       OR length(v_category) > 100
       OR length(v_variant_name) > 100
       OR length(v_model_code) > 64
       OR v_sku IS NULL OR length(v_sku) > 80
       OR v_price IS NULL OR v_price < 0
       OR v_price::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'Invalid catalogue row';
    END IF;

    SELECT min((e.value->>'selling_price')::numeric),
           CASE WHEN count(*) = 1 THEN max(e.value->>'sku') ELSE NULL END,
           CASE WHEN count(*) = 1 THEN max(e.value->>'model_code') ELSE NULL END
      INTO v_product_price, v_product_sku, v_product_model_code
      FROM jsonb_array_elements(_items) AS e(value)
     WHERE e.value->>'product_id' = v_product_id::text;

    -- First honour an existing immutable source-ID mapping, if present.
    SELECT id INTO v_mapped_product_id
      FROM public.products
     WHERE bizsathi_product_id = v_product_id
     FOR UPDATE;

    -- SKU is the primary reconciliation key. Search both the variant SKU
    -- and the legacy product-level SKU, but count distinct website products.
    WITH sku_candidates AS (
      SELECT pv.product_id AS id
        FROM public.product_variants pv
       WHERE lower(btrim(pv.sku)) = lower(v_sku)
      UNION
      SELECT p.id
        FROM public.products p
       WHERE p.sku IS NOT NULL
         AND lower(btrim(p.sku)) = lower(v_sku)
    )
    SELECT count(*), (array_agg(id))[1]
      INTO v_candidate_count, v_candidate_product_id
      FROM sku_candidates;

    IF v_candidate_count > 1 THEN
      RAISE EXCEPTION 'SKU matches multiple website products; manual identity review required';
    END IF;

    IF v_mapped_product_id IS NOT NULL
       AND v_candidate_product_id IS NOT NULL
       AND v_mapped_product_id <> v_candidate_product_id THEN
      RAISE EXCEPTION 'BizSathi product mapping conflicts with the website product found by SKU';
    END IF;

    v_existing_product_id := coalesce(v_mapped_product_id, v_candidate_product_id);

    IF v_existing_product_id IS NULL THEN
      -- No source-ID mapping and no exact SKU match: create an unpublished
      -- draft. Names are never used to match existing website products.
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
      v_slug := left(v_slug, 160) || '-' || left(replace(v_product_id::text, '-', ''), 8);

      INSERT INTO public.products (
        name, slug, sku, category_id, price, stock, sizes, colors, images, model_code,
        is_published, bizsathi_product_id
      ) VALUES (
        v_name, v_slug, v_product_sku, v_category_id, v_product_price, 0, '{}', '{}', '{}', v_product_model_code,
        false, v_product_id
      )
      RETURNING id INTO v_existing_product_id;
      v_created_products := v_created_products + 1;
    ELSE
      -- Preserve existing website content (name, description, images,
      -- category, price, SEO, stock and publishing status); attach identity only.
      UPDATE public.products
         SET bizsathi_product_id = v_product_id
       WHERE id = v_existing_product_id
         AND bizsathi_product_id IS NULL;
      IF FOUND THEN
        v_linked_products := v_linked_products + 1;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.products
         WHERE id = v_existing_product_id
           AND bizsathi_product_id = v_product_id
      ) THEN
        RAISE EXCEPTION 'Website product is already mapped to a different BizSathi product';
      END IF;
    END IF;

    -- Resolve an existing variant first by its immutable source ID.
    SELECT id, product_id INTO v_mapped_variant_id, v_sku_variant_product_id
      FROM public.product_variants
     WHERE bizsathi_variant_id = v_variant_id
     FOR UPDATE;

    IF v_mapped_variant_id IS NOT NULL THEN
      IF v_sku_variant_product_id <> v_existing_product_id THEN
        RAISE EXCEPTION 'BizSathi variant ID is already mapped to a different website product';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.product_variants
         WHERE id = v_mapped_variant_id
           AND lower(btrim(sku)) = lower(v_sku)
      ) THEN
        RAISE EXCEPTION 'BizSathi variant ID is already mapped to a different SKU';
      END IF;
      v_existing_variant_id := v_mapped_variant_id;
    ELSE
      SELECT count(*), (array_agg(pv.id))[1], (array_agg(pv.product_id))[1]
        INTO v_variant_count, v_sku_variant_id, v_sku_variant_product_id
        FROM public.product_variants pv
       WHERE lower(btrim(pv.sku)) = lower(v_sku);

      IF v_variant_count > 1 THEN
        RAISE EXCEPTION 'SKU matches multiple website variants; manual identity review required';
      END IF;
      IF v_variant_count = 1 THEN
        IF v_sku_variant_product_id <> v_existing_product_id THEN
          RAISE EXCEPTION 'SKU variant belongs to a different website product';
        END IF;
        IF EXISTS (
          SELECT 1 FROM public.product_variants
           WHERE id = v_sku_variant_id
             AND bizsathi_variant_id IS NOT NULL
             AND bizsathi_variant_id <> v_variant_id
        ) THEN
          RAISE EXCEPTION 'SKU is already mapped to a different BizSathi variant';
        END IF;
        UPDATE public.product_variants
           SET bizsathi_variant_id = v_variant_id
         WHERE id = v_sku_variant_id
           AND bizsathi_variant_id IS NULL;
        v_existing_variant_id := v_sku_variant_id;
        v_linked_variants := v_linked_variants + 1;
      ELSE
        INSERT INTO public.product_variants (
          product_id, size, color, sku, stock, bizsathi_variant_id, bizsathi_variant_name, bizsathi_model_code
        ) VALUES (
          v_existing_product_id, null, null, v_sku, 0, v_variant_id, v_variant_name, v_model_code
        );
        v_created_variants := v_created_variants + 1;
      END IF;
    END IF;

    -- Keep the descriptive BizSathi variant metadata current without changing
    -- the website SKU, size, colour, stock, or other merchandising fields.
    IF v_existing_variant_id IS NOT NULL THEN
      UPDATE public.product_variants
         SET bizsathi_variant_name = v_variant_name,
             bizsathi_model_code = v_model_code
       WHERE id = v_existing_variant_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_products', v_created_products,
    'linked_products', v_linked_products,
    'created_variants', v_created_variants,
    'linked_variants', v_linked_variants,
    'stock_imported', false,
    'products_published', false,
    'matching_authority', 'exact_sku'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) TO service_role;
COMMENT ON FUNCTION public.upsert_bizsathi_catalogue_drafts(jsonb) IS
  'Service-role-only draft catalogue upsert. Exact normalized SKU is the reconciliation key; existing website content, stock and publishing are preserved. New products are unpublished drafts.';
