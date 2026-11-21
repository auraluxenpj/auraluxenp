-- Additive foundation for the BizSathi -> Auraluxe catalogue mapping and durable order event outbox.
-- This migration is staged only; it is not applied to production by this change.
-- It does not import products, change stock, publish products, or send events.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bizsathi_product_id uuid;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS bizsathi_variant_id uuid;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS bizsathi_product_id uuid,
  ADD COLUMN IF NOT EXISTS bizsathi_variant_id uuid,
  ADD COLUMN IF NOT EXISTS source_sku text;

CREATE UNIQUE INDEX IF NOT EXISTS products_bizsathi_product_id_unique
  ON public.products (bizsathi_product_id)
  WHERE bizsathi_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_bizsathi_variant_id_unique
  ON public.product_variants (bizsathi_variant_id)
  WHERE bizsathi_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_items_bizsathi_variant_id_idx
  ON public.order_items (bizsathi_variant_id)
  WHERE bizsathi_variant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bizsathi_inventory_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('order_item_created', 'order_state_changed')),
  order_id uuid NOT NULL,
  order_item_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'processing', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bizsathi_inventory_outbox_pending_idx
  ON public.bizsathi_inventory_outbox (available_at, created_at)
  WHERE delivery_status IN ('pending', 'failed');

ALTER TABLE public.bizsathi_inventory_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bizsathi_inventory_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bizsathi_inventory_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_bizsathi_order_item_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bizsathi_product_id uuid;
BEGIN
  SELECT p.bizsathi_product_id
    INTO v_bizsathi_product_id
    FROM public.products p
   WHERE p.id = NEW.product_id;

  -- Legacy/unmapped catalogue lines are intentionally not exported.
  IF NEW.bizsathi_variant_id IS NULL OR v_bizsathi_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bizsathi_inventory_outbox (
    event_type, order_id, order_item_id, idempotency_key, payload
  ) VALUES (
    'order_item_created',
    NEW.order_id,
    NEW.id,
    'order-item-created:' || NEW.id::text,
    jsonb_build_object(
      'order_id', NEW.order_id,
      'order_item_id', NEW.id,
      'website_product_id', NEW.product_id,
      'bizsathi_product_id', v_bizsathi_product_id,
      'bizsathi_variant_id', NEW.bizsathi_variant_id,
      'sku', NEW.source_sku,
      'quantity', NEW.quantity
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_enqueue_bizsathi_event ON public.order_items;
CREATE TRIGGER order_items_enqueue_bizsathi_event
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_bizsathi_order_item_event();

CREATE OR REPLACE FUNCTION public.enqueue_bizsathi_order_state_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lines jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'order_item_id', oi.id,
      'website_product_id', oi.product_id,
      'bizsathi_product_id', p.bizsathi_product_id,
      'bizsathi_variant_id', oi.bizsathi_variant_id,
      'sku', oi.source_sku,
      'quantity', oi.quantity
    ) ORDER BY oi.id),
    '[]'::jsonb
  )
  INTO v_lines
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id
    AND oi.bizsathi_variant_id IS NOT NULL
    AND p.bizsathi_product_id IS NOT NULL;

  IF jsonb_array_length(v_lines) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bizsathi_inventory_outbox (
    event_type, order_id, idempotency_key, payload
  ) VALUES (
    'order_state_changed',
    NEW.id,
    'order-state:' || NEW.id::text || ':' || gen_random_uuid()::text,
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'status', NEW.status,
      'payment_status', NEW.payment_status,
      'lines', v_lines
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enqueue_bizsathi_state_event ON public.orders;
CREATE TRIGGER orders_enqueue_bizsathi_state_event
  AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_bizsathi_order_state_event();

COMMENT ON TABLE public.bizsathi_inventory_outbox IS
  'Durable, PII-minimized website order events awaiting BizSathi reconciliation. BizSathi remains the inventory authority; this outbox is not activated until the reservation/commit protocol is implemented.';
