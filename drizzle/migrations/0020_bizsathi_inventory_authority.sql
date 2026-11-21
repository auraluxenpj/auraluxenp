-- BizSathi is the single inventory authority when this guarded switch is enabled.
-- Default remains disabled until the separate production cutover is approved.

CREATE TABLE public.website_inventory_authority (
  id smallint PRIMARY KEY CHECK(id=1),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.website_inventory_authority(id,enabled) VALUES(1,false)
ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.website_inventory_authority ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_inventory_authority FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.website_inventory_authority TO service_role;

CREATE TABLE public.website_inventory_reservation_proofs (
  operation_id uuid PRIMARY KEY,
  source_type text NOT NULL CHECK(source_type IN ('order','pos')),
  source_key text NOT NULL CHECK(length(btrim(source_key)) BETWEEN 1 AND 160),
  consumed_reference text,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.website_inventory_reservation_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_inventory_reservation_proofs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.website_inventory_reservation_proofs TO service_role;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_operation_id uuid;
ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS inventory_operation_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS pos_sales_inventory_operation_id_uniq ON public.pos_sales(inventory_operation_id) WHERE inventory_operation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_inventory_operation_id_uniq
  ON public.orders(inventory_operation_id) WHERE inventory_operation_id IS NOT NULL;

CREATE FUNCTION public.website_inventory_authority_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $authority$
  SELECT coalesce((SELECT enabled FROM public.website_inventory_authority WHERE id=1),false)
$authority$;
REVOKE ALL ON FUNCTION public.website_inventory_authority_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_inventory_authority_enabled() TO anon,authenticated,service_role;

CREATE FUNCTION public.register_website_inventory_proof(_operation_id uuid,_source_type text,_source_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $proof$
DECLARE existing public.website_inventory_reservation_proofs;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Inventory proof registration requires service authorization'; END IF;
  IF _operation_id IS NULL OR _source_type NOT IN ('order','pos') OR coalesce(length(btrim(_source_key)),0) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Invalid inventory reservation proof';
  END IF;
  SELECT * INTO existing FROM public.website_inventory_reservation_proofs WHERE operation_id=_operation_id FOR UPDATE;
  IF FOUND THEN
    IF existing.source_type<>_source_type OR existing.source_key<>btrim(_source_key) OR existing.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Inventory operation identifier already used';
    END IF;
    RETURN;
  END IF;
  INSERT INTO public.website_inventory_reservation_proofs(operation_id,source_type,source_key)
    VALUES(_operation_id,_source_type,btrim(_source_key));
END
$proof$;
REVOKE ALL ON FUNCTION public.register_website_inventory_proof(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_website_inventory_proof(uuid,text,text) TO service_role;

CREATE FUNCTION public.cancel_website_inventory_proof(_operation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $proof_cancel$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Inventory proof cancellation requires service authorization'; END IF;
  UPDATE public.website_inventory_reservation_proofs
    SET cancelled_at=now()
    WHERE operation_id=_operation_id AND consumed_at IS NULL AND cancelled_at IS NULL;
END
$proof_cancel$;
REVOKE ALL ON FUNCTION public.cancel_website_inventory_proof(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_website_inventory_proof(uuid) TO service_role;

CREATE FUNCTION public.guard_bizsathi_inventory_authority_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $stock_guard$
BEGIN
  IF coalesce((SELECT enabled FROM public.website_inventory_authority WHERE id=1),false)
     AND coalesce(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'BizSathi is the inventory authority. Post stock changes in BizSathi.';
  END IF;
  RETURN NEW;
END
$stock_guard$;
REVOKE ALL ON FUNCTION public.guard_bizsathi_inventory_authority_stock() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bizsathi_authority_product_stock_guard
  BEFORE UPDATE OF stock ON public.products
  FOR EACH ROW WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  EXECUTE FUNCTION public.guard_bizsathi_inventory_authority_stock();
CREATE TRIGGER bizsathi_authority_variant_stock_guard
  BEFORE UPDATE OF stock ON public.product_variants
  FOR EACH ROW WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  EXECUTE FUNCTION public.guard_bizsathi_inventory_authority_stock();

-- Upgrade checkout in place while preserving the old five-argument RPC via a default NULL operation ID.
DO $place_order_patch$
DECLARE body text; start_pos integer; end_pos integer; stock_block text; deduct_block text; nl text:=chr(10);
BEGIN
  SELECT pg_get_functiondef('public.place_order(text,text,jsonb,jsonb,text)'::regprocedure) INTO body;
  body:=replace(body,'p_coupon text DEFAULT NULL::text)','p_coupon text DEFAULT NULL::text, p_inventory_operation_id uuid DEFAULT NULL::uuid)');
  body:=replace(body,'  v_size_tracked boolean;','  v_size_tracked boolean; v_authority_enabled boolean := false;');
  body:=replace(body,'select id, order_number, total, request_fingerprint into v_existing','select id, order_number, total, request_fingerprint, inventory_operation_id into v_existing');
  body:=replace(body,'if v_existing.request_fingerprint = v_fingerprint then','if v_existing.request_fingerprint = v_fingerprint AND v_existing.inventory_operation_id IS NOT DISTINCT FROM p_inventory_operation_id then');
  body:=replace(body,'  -- ---- customer validation','  SELECT enabled INTO v_authority_enabled FROM public.website_inventory_authority WHERE id=1; v_authority_enabled:=coalesce(v_authority_enabled,false);'||nl||'  -- ---- customer validation');
  body:=replace(body,'  -- ---- items: real products, real prices, real stock (rows locked) ----',
    '  IF v_authority_enabled THEN'||nl||
    '    IF p_inventory_operation_id IS NULL THEN RAISE EXCEPTION ''Website inventory reservation is required''; END IF;'||nl||
    '    PERFORM 1 FROM public.website_inventory_reservation_proofs WHERE operation_id=p_inventory_operation_id AND source_type=''order'' AND source_key=p_checkout_key AND consumed_at IS NULL AND cancelled_at IS NULL FOR UPDATE;'||nl||
    '    IF NOT FOUND THEN RAISE EXCEPTION ''Valid BizSathi reservation proof is required''; END IF;'||nl||
    '  ELSIF p_inventory_operation_id IS NOT NULL THEN RAISE EXCEPTION ''Inventory reservation supplied while BizSathi authority is disabled'';'||nl||
    '  END IF;'||nl||'  -- ---- items: real products, real prices, real stock (rows locked) ----');
  start_pos:=position('  -- ---- stock: aggregate duplicate lines, honour per-size variant stock ----' IN body);
  end_pos:=position('  -- ---- coupon: validated against trusted records ----' IN body);
  IF start_pos=0 OR end_pos<=start_pos THEN RAISE EXCEPTION 'Could not isolate checkout stock validation block'; END IF;
  stock_block:=substring(body FROM start_pos FOR end_pos-start_pos);
  body:=substring(body FROM 1 FOR start_pos-1)||'  IF NOT v_authority_enabled THEN'||nl||stock_block||'  END IF;'||nl||nl||substring(body FROM end_pos);
  body:=replace(body,'    checkout_key, request_fingerprint, user_id,','    checkout_key, request_fingerprint, user_id, inventory_operation_id,');
  body:=replace(body,'    p_checkout_key, v_fingerprint, auth.uid(),','    p_checkout_key, v_fingerprint, auth.uid(), p_inventory_operation_id,');
  body:=replace(body,'  returning id, order_number into v_order_id, v_order_number;',
    '  returning id, order_number into v_order_id, v_order_number;'||nl||
    '  IF v_authority_enabled THEN UPDATE public.website_inventory_reservation_proofs SET consumed_reference=''order:''||v_order_id::text,consumed_at=now() WHERE operation_id=p_inventory_operation_id; END IF;');
  start_pos:=position('  -- ---- deduct stock:' IN body);
  end_pos:=position('  if v_coupon_code is not null then' IN body);
  IF start_pos=0 OR end_pos<=start_pos THEN RAISE EXCEPTION 'Could not isolate checkout stock deduction block'; END IF;
  deduct_block:=substring(body FROM start_pos FOR end_pos-start_pos);
  body:=substring(body FROM 1 FOR start_pos-1)||'  IF NOT v_authority_enabled THEN'||nl||deduct_block||'  END IF;'||nl||nl||substring(body FROM end_pos);
  DROP FUNCTION public.place_order(text,text,jsonb,jsonb,text);
  EXECUTE body;
END
$place_order_patch$;
REVOKE ALL ON FUNCTION public.place_order(text,text,jsonb,jsonb,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,jsonb,jsonb,text,uuid) TO anon,authenticated;

DO $pos_patch$
DECLARE body text; start_pos integer; end_pos integer; anchor_pos integer; stock_block text; deduct_block text; nl text:=chr(10);
BEGIN
  SELECT pg_get_functiondef('public.complete_pos_sale(jsonb)'::regprocedure) INTO body;
  body:=replace(body,'receipt_no text;','receipt_no text; v_authority_enabled boolean := false;');
  body:=replace(body,'request_key,request_fingerprint,operator_id','request_key,inventory_operation_id,request_fingerprint,operator_id');
  body:=replace(body,'req_key,fingerprint,actor','req_key,CASE WHEN v_authority_enabled THEN req_key ELSE NULL END,fingerprint,actor');
  body:=replace(body,' IF NOT public.can_use_pos() THEN',
    ' SELECT enabled INTO v_authority_enabled FROM public.website_inventory_authority WHERE id=1; v_authority_enabled:=coalesce(v_authority_enabled,false);'||nl||
    ' IF NOT public.can_use_pos() THEN');
  body:=replace(body,' method := p_request->>''payment_method'';',
    ' IF v_authority_enabled THEN'||nl||
    '  PERFORM 1 FROM public.website_inventory_reservation_proofs WHERE operation_id=req_key AND source_type=''pos'' AND source_key=req_key::text AND consumed_at IS NULL AND cancelled_at IS NULL FOR UPDATE;'||nl||
    '  IF NOT FOUND THEN RAISE EXCEPTION ''Valid BizSathi POS reservation proof is required''; END IF;'||nl||
    ' END IF;'||nl||' method := p_request->>''payment_method'';');
  start_pos:=position(' FOR agg IN SELECT (i->>''product_id'')::uuid AS id,sum((i->>''quantity'')::int)::int AS qty FROM jsonb_array_elements(items) i GROUP BY 1 ORDER BY 1 LOOP' IN body);
  end_pos:=position(' SELECT coalesce(nullif(value,'''')::numeric,0) INTO tax_rate' IN body);
  IF start_pos=0 OR end_pos<=start_pos THEN RAISE EXCEPTION 'Could not isolate POS stock validation block'; END IF;
  stock_block:=substring(body FROM start_pos FOR end_pos-start_pos);
  body:=substring(body FROM 1 FOR start_pos-1)||' IF NOT v_authority_enabled THEN'||nl||stock_block||' END IF;'||nl||substring(body FROM end_pos);
  body:=replace(body,' FOR item IN SELECT * FROM jsonb_array_elements(receipt_items) LOOP',
    ' IF v_authority_enabled THEN UPDATE public.website_inventory_reservation_proofs SET consumed_reference=''pos:''||sale_id::text,consumed_at=now() WHERE operation_id=req_key; END IF;'||nl||
    ' FOR item IN SELECT * FROM jsonb_array_elements(receipt_items) LOOP');
  anchor_pos:=position(' FOR item IN SELECT * FROM jsonb_array_elements(receipt_items) LOOP' IN body);
  IF anchor_pos=0 THEN RAISE EXCEPTION 'Could not locate POS item write'; END IF;
  start_pos:=anchor_pos+position(' FOR agg IN SELECT (i->>''product_id'')::uuid AS id,sum((i->>''quantity'')::int)::int AS qty FROM jsonb_array_elements(items) i GROUP BY 1 ORDER BY 1 LOOP' IN substring(body FROM anchor_pos+1));
  IF start_pos<=anchor_pos THEN RAISE EXCEPTION 'Could not locate POS stock deduction'; END IF;
  end_pos:=position(' IF method=''credit'' THEN INSERT INTO public.pos_credit_entries' IN body);
  IF start_pos=0 OR end_pos<=start_pos THEN RAISE EXCEPTION 'Could not isolate POS stock deduction block'; END IF;
  deduct_block:=substring(body FROM start_pos FOR end_pos-start_pos);
  body:=substring(body FROM 1 FOR start_pos-1)||' IF NOT v_authority_enabled THEN'||nl||deduct_block||' END IF;'||nl||substring(body FROM end_pos);
  EXECUTE body;
END
$pos_patch$;

COMMENT ON TABLE public.website_inventory_authority IS
  'Singleton cutover switch. Disabled by default; when enabled, BizSathi is the sole stock authority.';
COMMENT ON TABLE public.website_inventory_reservation_proofs IS
  'Server-only proof that a BizSathi reservation succeeded before an online order or website POS sale.';
