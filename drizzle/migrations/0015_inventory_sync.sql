-- 0015: Stock sync with BizSathi (BizSathi is the master for stock).
-- Additive only: three private tables and four functions callable by the service role alone.
-- Existing tables, policies and checkout/POS functions are not changed. Roll forward with a new migration; never edit this one.

-- The stock value both systems last agreed on, per SKU (lower-case, trimmed).
CREATE TABLE public.inventory_sync_state(
  sku text PRIMARY KEY,
  last_stock integer NOT NULL CHECK(last_stock >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Sales/returns seen on the website since the last agreement, waiting to be recorded in BizSathi (delta < 0 means sold).
CREATE TABLE public.inventory_sync_acks(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  delta integer NOT NULL CHECK(delta <> 0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','recorded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz
);
CREATE INDEX inventory_sync_acks_pending_idx ON public.inventory_sync_acks(sku) WHERE status = 'pending';
-- Every stock value written by a sync.
CREATE TABLE public.inventory_sync_log(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL,
  before_stock integer NOT NULL,
  after_stock integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sync_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sync_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_sync_state, public.inventory_sync_acks, public.inventory_sync_log FROM PUBLIC, anon, authenticated;

-- Finds the website row a SKU refers to: a size row first, then a product that has no size rows.
-- A SKU that matches several rows, or a product that has size rows, is 'ambiguous' and is never changed.
CREATE FUNCTION public.inv_sync_find(_sku text, _lock boolean)
RETURNS TABLE(kind text, product_id uuid, variant_id uuid, stock integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text := lower(btrim(_sku)); n integer; r record;
BEGIN
  IF k = '' THEN RETURN QUERY SELECT 'none'::text, NULL::uuid, NULL::uuid, NULL::integer; RETURN; END IF;
  SELECT count(*) INTO n FROM public.product_variants v WHERE lower(btrim(v.sku)) = k;
  IF n > 1 THEN RETURN QUERY SELECT 'ambiguous'::text, NULL::uuid, NULL::uuid, NULL::integer; RETURN; END IF;
  IF n = 1 THEN
    IF _lock THEN SELECT v.id, v.product_id, v.stock INTO r FROM public.product_variants v WHERE lower(btrim(v.sku)) = k FOR UPDATE;
    ELSE SELECT v.id, v.product_id, v.stock INTO r FROM public.product_variants v WHERE lower(btrim(v.sku)) = k; END IF;
    RETURN QUERY SELECT 'variant'::text, r.product_id, r.id, r.stock; RETURN;
  END IF;
  SELECT count(*) INTO n FROM public.products p WHERE lower(btrim(p.sku)) = k;
  IF n > 1 THEN RETURN QUERY SELECT 'ambiguous'::text, NULL::uuid, NULL::uuid, NULL::integer; RETURN; END IF;
  IF n = 1 THEN
    IF _lock THEN SELECT p.id, p.stock INTO r FROM public.products p WHERE lower(btrim(p.sku)) = k FOR UPDATE;
    ELSE SELECT p.id, p.stock INTO r FROM public.products p WHERE lower(btrim(p.sku)) = k; END IF;
    IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = r.id) THEN
      RETURN QUERY SELECT 'ambiguous'::text, NULL::uuid, NULL::uuid, NULL::integer; RETURN;
    END IF;
    RETURN QUERY SELECT 'product'::text, r.id, NULL::uuid, r.stock; RETURN;
  END IF;
  RETURN QUERY SELECT 'none'::text, NULL::uuid, NULL::uuid, NULL::integer;
END $$;

-- Read-only comparison for a list of SKUs.
CREATE FUNCTION public.inv_sync_state(_skus text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text; f record; st integer; pend integer; out jsonb := '[]'::jsonb;
BEGIN
  IF coalesce(array_length(_skus,1),0) > 2000 THEN RAISE EXCEPTION 'Too many SKUs'; END IF;
  FOREACH s IN ARRAY coalesce(_skus, ARRAY[]::text[]) LOOP
    SELECT * INTO f FROM public.inv_sync_find(s, false);
    SELECT last_stock INTO st FROM public.inventory_sync_state WHERE sku = lower(btrim(s));
    SELECT coalesce(sum(delta),0) INTO pend FROM public.inventory_sync_acks WHERE sku = lower(btrim(s)) AND status = 'pending';
    out := out || jsonb_build_array(jsonb_build_object('sku', s, 'match', f.kind, 'current', f.stock, 'last', st, 'pending', pend));
  END LOOP;
  RETURN out;
END $$;

-- Notes website sales/returns since the last agreement as pending acknowledgements, and returns every
-- pending one. A SKU seen for the first time is only baselined. Asking again never repeats a delta.
CREATE FUNCTION public.inv_sync_ack(_skus text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text; k text; f record; l integer; keys text[] := ARRAY[]::text[];
BEGIN
  IF coalesce(array_length(_skus,1),0) > 2000 THEN RAISE EXCEPTION 'Too many SKUs'; END IF;
  FOREACH s IN ARRAY coalesce(_skus, ARRAY[]::text[]) LOOP
    k := lower(btrim(s));
    SELECT * INTO f FROM public.inv_sync_find(s, true);
    IF f.kind IN ('variant','product') THEN
      keys := keys || k;
      SELECT last_stock INTO l FROM public.inventory_sync_state WHERE sku = k FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO public.inventory_sync_state(sku, last_stock) VALUES(k, f.stock) ON CONFLICT (sku) DO NOTHING;
      ELSIF f.stock <> l THEN
        INSERT INTO public.inventory_sync_acks(sku, delta) VALUES(k, f.stock - l);
        UPDATE public.inventory_sync_state SET last_stock = f.stock, updated_at = now() WHERE sku = k;
      END IF;
    END IF;
  END LOOP;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'sku', a.sku, 'delta', a.delta) ORDER BY a.created_at, a.id)
                   FROM public.inventory_sync_acks a WHERE a.status = 'pending' AND a.sku = ANY(keys)), '[]'::jsonb);
END $$;

CREATE FUNCTION public.inv_sync_recorded(_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.inventory_sync_acks SET status = 'recorded', recorded_at = now() WHERE id = ANY(coalesce(_ids, ARRAY[]::uuid[])) AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

-- Sets website stock to BizSathi's figure, one SKU at a time, and only when nothing has moved since the
-- caller looked: the current stock must equal "expected" and no acknowledgement may be waiting.
-- Otherwise that SKU is skipped and picked up on the next sync, so a customer's order is never overwritten.
CREATE FUNCTION public.inv_sync_push(_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; s text; k text; want integer; exp integer; f record; out jsonb := '[]'::jsonb; res text;
BEGIN
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) > 2000 THEN RAISE EXCEPTION 'Invalid items'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    s := it->>'sku'; k := lower(btrim(s)); want := (it->>'stock')::integer; exp := (it->>'expected')::integer;
    IF want IS NULL OR want < 0 OR exp IS NULL THEN RAISE EXCEPTION 'Invalid stock for %', s; END IF;
    SELECT * INTO f FROM public.inv_sync_find(s, true);
    IF f.kind NOT IN ('variant','product') THEN res := 'no-match';
    ELSIF EXISTS (SELECT 1 FROM public.inventory_sync_acks a WHERE a.sku = k AND a.status = 'pending') THEN res := 'pending';
    ELSIF f.stock <> exp THEN res := 'changed';
    ELSE
      IF f.kind = 'variant' THEN
        UPDATE public.product_variants SET stock = want WHERE id = f.variant_id;
        UPDATE public.products SET stock = greatest(0, stock + (want - f.stock)), updated_at = now() WHERE id = f.product_id;
      ELSE
        UPDATE public.products SET stock = want, updated_at = now() WHERE id = f.product_id;
      END IF;
      INSERT INTO public.inventory_sync_state(sku, last_stock) VALUES(k, want)
        ON CONFLICT (sku) DO UPDATE SET last_stock = excluded.last_stock, updated_at = now();
      INSERT INTO public.inventory_sync_log(sku, before_stock, after_stock) VALUES(k, f.stock, want);
      res := 'applied';
    END IF;
    out := out || jsonb_build_array(jsonb_build_object('sku', s, 'result', res, 'before', f.stock, 'after', CASE WHEN res = 'applied' THEN want ELSE f.stock END));
  END LOOP;
  RETURN out;
END $$;

REVOKE EXECUTE ON FUNCTION public.inv_sync_find(text, boolean), public.inv_sync_state(text[]), public.inv_sync_ack(text[]), public.inv_sync_recorded(uuid[]), public.inv_sync_push(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inv_sync_find(text, boolean), public.inv_sync_state(text[]), public.inv_sync_ack(text[]), public.inv_sync_recorded(uuid[]), public.inv_sync_push(jsonb) TO service_role;
