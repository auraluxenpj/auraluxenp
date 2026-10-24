CREATE OR REPLACE FUNCTION public.can_use_pos() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) $$;
REVOKE ALL ON FUNCTION public.can_use_pos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_use_pos() TO authenticated, service_role;
CREATE TABLE public.pos_customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100), phone text NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{7,15}$'), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.pos_customers TO authenticated;
GRANT ALL ON public.pos_customers TO service_role;
ALTER TABLE public.pos_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "POS customer read" ON public.pos_customers FOR SELECT TO authenticated USING (public.can_use_pos());
CREATE POLICY "POS customer create" ON public.pos_customers FOR INSERT TO authenticated WITH CHECK (public.can_use_pos() AND created_by = auth.uid());
CREATE TABLE public.pos_sales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_number text NOT NULL UNIQUE, request_key uuid NOT NULL UNIQUE, request_fingerprint text NOT NULL, operator_id uuid NOT NULL, customer_id uuid REFERENCES public.pos_customers(id), payment_method text NOT NULL CHECK (payment_method IN ('cash','qr','credit')), subtotal numeric(14,2) NOT NULL, item_discount numeric(14,2) NOT NULL, cart_discount numeric(14,2) NOT NULL, tax_rate numeric(6,2) NOT NULL, tax numeric(14,2) NOT NULL, total numeric(14,2) NOT NULL CHECK (total >= 0), tendered numeric(14,2) NOT NULL DEFAULT 0, change_due numeric(14,2) NOT NULL DEFAULT 0, receipt jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.pos_sales TO authenticated;
GRANT ALL ON public.pos_sales TO service_role;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "POS sale read" ON public.pos_sales FOR SELECT TO authenticated USING (public.can_use_pos());
CREATE TABLE public.pos_sale_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES public.pos_sales(id), product_id uuid NOT NULL, product_name text NOT NULL, sku text, size text, color text, quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99), unit_price numeric(14,2) NOT NULL, discount numeric(14,2) NOT NULL, line_total numeric(14,2) NOT NULL CHECK (line_total >= 0));
GRANT SELECT ON public.pos_sale_items TO authenticated;
GRANT ALL ON public.pos_sale_items TO service_role;
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "POS item read" ON public.pos_sale_items FOR SELECT TO authenticated USING (public.can_use_pos());
CREATE TABLE public.pos_credit_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.pos_customers(id), sale_id uuid NOT NULL UNIQUE REFERENCES public.pos_sales(id), amount numeric(14,2) NOT NULL CHECK (amount >= 0), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.pos_credit_entries TO authenticated;
GRANT ALL ON public.pos_credit_entries TO service_role;
ALTER TABLE public.pos_credit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "POS credit read" ON public.pos_credit_entries FOR SELECT TO authenticated USING (public.can_use_pos());
CREATE INDEX pos_sales_date_idx ON public.pos_sales(created_at DESC);
CREATE INDEX pos_credit_customer_idx ON public.pos_credit_entries(customer_id);
CREATE SEQUENCE public.pos_receipt_sequence;
GRANT ALL ON SEQUENCE public.pos_receipt_sequence TO service_role;
CREATE OR REPLACE FUNCTION public.get_pos_catalog() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.can_use_pos() THEN RAISE EXCEPTION 'POS access denied'; END IF;
 RETURN jsonb_build_object('products',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.name) FROM public.products p WHERE p.is_published),'[]'::jsonb),'variants',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.product_variants v JOIN public.products p ON p.id=v.product_id WHERE p.is_published),'[]'::jsonb),'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort_order) FROM public.categories c WHERE c.is_active),'[]'::jsonb),'tax_rate',coalesce((SELECT nullif(value,'')::numeric FROM public.site_settings WHERE key='tax_percent'),0));
END $$;
REVOKE ALL ON FUNCTION public.get_pos_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pos_catalog() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_pos_qr() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.payment_settings%rowtype;
BEGIN
 IF NOT public.can_use_pos() THEN RAISE EXCEPTION 'POS access denied'; END IF;
 SELECT * INTO s FROM public.payment_settings WHERE id='main';
 IF s.qr_enabled AND nullif(trim(s.qr_image_path),'') IS NOT NULL AND nullif(trim(s.qr_merchant_name),'') IS NOT NULL THEN RETURN jsonb_build_object('path',s.qr_image_path,'merchant',s.qr_merchant_name,'provider',s.qr_provider); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.get_pos_qr() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pos_qr() TO authenticated;
CREATE OR REPLACE FUNCTION public.complete_pos_sale(p_request jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 actor uuid := auth.uid(); req_key uuid; fingerprint text; existing public.pos_sales%rowtype;
 customer public.pos_customers%rowtype; customer_id uuid; method text; items jsonb; item jsonb; product public.products%rowtype;
 agg record; vr record; remaining integer; take_qty integer; qty integer; price numeric; discount numeric;
 subtotal numeric := 0; item_discount numeric := 0; cart_discount numeric; tax_rate numeric; tax numeric; total numeric; tender numeric;
 sale_id uuid := gen_random_uuid(); receipt_no text; receipt_items jsonb := '[]'::jsonb; store jsonb; receipt jsonb; operator_name text;
BEGIN
 IF NOT public.can_use_pos() THEN RAISE EXCEPTION 'POS access denied'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_request) <> 'object' THEN RAISE EXCEPTION 'Invalid sale'; END IF;
 req_key := (p_request->>'request_key')::uuid;
 IF req_key IS NULL THEN RAISE EXCEPTION 'Sale key required'; END IF;
 fingerprint := md5(actor::text || p_request::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(req_key::text,0));
 SELECT * INTO existing FROM public.pos_sales WHERE request_key=req_key;
 IF FOUND THEN
  IF existing.request_fingerprint <> fingerprint THEN RAISE EXCEPTION 'Sale key already used with different details'; END IF;
  RETURN existing.id;
 END IF;
 method := p_request->>'payment_method';
 IF method IS NULL OR method NOT IN ('cash','qr','credit') THEN RAISE EXCEPTION 'Invalid POS payment method'; END IF;
 customer_id := nullif(p_request->>'customer_id','')::uuid;
 IF customer_id IS NOT NULL THEN
  SELECT * INTO customer FROM public.pos_customers WHERE id=customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 END IF;
 IF method='credit' AND customer_id IS NULL THEN RAISE EXCEPTION 'Credit requires a saved customer'; END IF;
 IF method='qr' THEN
  IF coalesce((p_request->>'qr_confirmed')::boolean,false) <> true THEN RAISE EXCEPTION 'Confirm funds received in merchant account'; END IF;
  IF public.get_pos_qr() IS NULL THEN RAISE EXCEPTION 'QR payment is not configured'; END IF;
 END IF;
 items := p_request->'items';
 IF items IS NULL OR jsonb_typeof(items)<>'array' THEN RAISE EXCEPTION 'Items required'; END IF;
 IF jsonb_array_length(items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Sale needs 1 to 100 lines'; END IF;
 cart_discount := coalesce((p_request->>'cart_discount')::numeric,0);
 tender := coalesce((p_request->>'tendered')::numeric,0);
 IF cart_discount < 0 OR cart_discount > 999999999 OR cart_discount <> round(cart_discount,2) OR tender < 0 OR tender > 999999999 OR tender <> round(tender,2) THEN RAISE EXCEPTION 'Invalid discount or tender'; END IF;
 -- Deterministic locks shared with online checkout through the same product rows.
 FOR agg IN SELECT DISTINCT (i->>'product_id')::uuid AS id FROM jsonb_array_elements(items) i ORDER BY 1 LOOP
  PERFORM 1 FROM public.products WHERE id=agg.id AND is_published FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(items) LOOP
  IF (item->>'quantity') IS NULL OR (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric) THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  qty := (item->>'quantity')::integer;
  IF qty NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Quantity must be 1 to 99'; END IF;
  SELECT * INTO product FROM public.products WHERE id=(item->>'product_id')::uuid;
  IF cardinality(product.sizes)>0 AND NOT coalesce(item->>'size','')=ANY(product.sizes) THEN RAISE EXCEPTION 'Choose a valid size for %',product.name; END IF;
  IF cardinality(product.colors)>0 AND NOT coalesce(item->>'color','')=ANY(product.colors) THEN RAISE EXCEPTION 'Choose a valid colour for %',product.name; END IF;
  IF cardinality(product.sizes)=0 AND nullif(item->>'size','') IS NOT NULL THEN RAISE EXCEPTION 'Invalid size'; END IF;
  IF cardinality(product.colors)=0 AND nullif(item->>'color','') IS NOT NULL THEN RAISE EXCEPTION 'Invalid colour'; END IF;
  price := round(CASE WHEN product.sale_price>0 THEN product.sale_price ELSE product.price END,2);
  discount := coalesce((item->>'discount')::numeric,0);
  IF price < 0 OR discount < 0 OR discount>price*qty OR discount<>round(discount,2) THEN RAISE EXCEPTION 'Invalid item discount'; END IF;
  subtotal := subtotal+price*qty; item_discount := item_discount+discount;
  receipt_items := receipt_items || jsonb_build_array(jsonb_build_object('product_id',product.id,'product_name',product.name,'sku',product.sku,'size',nullif(item->>'size',''),'color',nullif(item->>'color',''),'quantity',qty,'unit_price',price,'discount',discount,'line_total',price*qty-discount));
 END LOOP;
 IF cart_discount>subtotal-item_discount THEN RAISE EXCEPTION 'Cart discount exceeds sale value'; END IF;
 FOR agg IN SELECT (i->>'product_id')::uuid AS id,sum((i->>'quantity')::int)::int AS qty FROM jsonb_array_elements(items) i GROUP BY 1 ORDER BY 1 LOOP
  SELECT * INTO product FROM public.products WHERE id=agg.id;
  IF product.stock<agg.qty THEN RAISE EXCEPTION 'Not enough stock for %',product.name; END IF;
  PERFORM 1 FROM public.product_variants WHERE product_id=agg.id AND size IS NOT NULL ORDER BY id FOR UPDATE;
 END LOOP;
 -- Existing editor stores colour-agnostic size rows. Like web checkout, sizes consume the shared size pool.
 FOR agg IN SELECT (i->>'product_id')::uuid AS id,lower(trim(coalesce(i->>'size',''))) AS size,sum((i->>'quantity')::int)::int AS qty FROM jsonb_array_elements(items) i GROUP BY 1,2 ORDER BY 1,2 LOOP
  IF EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=agg.id AND size IS NOT NULL) THEN
   IF agg.size='' THEN RAISE EXCEPTION 'Size is required for tracked stock'; END IF;
   SELECT coalesce(sum(stock),0) INTO remaining FROM public.product_variants WHERE product_id=agg.id AND lower(trim(size))=agg.size;
   IF remaining<agg.qty THEN RAISE EXCEPTION 'Not enough stock for size %',agg.size; END IF;
   remaining := agg.qty;
   FOR vr IN SELECT id,stock FROM public.product_variants WHERE product_id=agg.id AND lower(trim(size))=agg.size ORDER BY id LOOP
    take_qty := least(vr.stock,remaining);
    IF take_qty>0 THEN UPDATE public.product_variants SET stock=stock-take_qty WHERE id=vr.id; remaining := remaining-take_qty; END IF;
    EXIT WHEN remaining=0;
   END LOOP;
  END IF;
 END LOOP;
 SELECT coalesce(nullif(value,'')::numeric,0) INTO tax_rate FROM public.site_settings WHERE key='tax_percent'; tax_rate:=coalesce(tax_rate,0);
 IF tax_rate<0 OR tax_rate>100 THEN RAISE EXCEPTION 'Tax settings require admin review'; END IF;
 tax := round((subtotal-item_discount-cart_discount)*tax_rate/100,2); total:=subtotal-item_discount-cart_discount+tax;
 IF method='cash' AND tender<total THEN RAISE EXCEPTION 'Cash received is below the total'; END IF;
 IF method<>'cash' THEN tender:=CASE WHEN method='qr' THEN total ELSE 0 END; END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO store FROM public.site_settings WHERE key IN ('brand_name','address','phone','email','currency');
 SELECT coalesce(nullif(full_name,''),'Counter staff') INTO operator_name FROM public.profiles WHERE id=actor; operator_name:=coalesce(operator_name,'Counter staff');
 receipt_no := 'AL-POS-' || to_char(now() AT TIME ZONE 'Asia/Kathmandu','YYMMDD') || '-' || lpad(nextval('public.pos_receipt_sequence')::text,6,'0');
 receipt:=jsonb_build_object('id',sale_id,'receipt_number',receipt_no,'created_at',now(),'operator_name',operator_name,'store',store,'customer_name',coalesce(customer.name,'Walk-in guest'),'customer_phone',customer.phone,'items',receipt_items,'subtotal',subtotal,'item_discount',item_discount,'cart_discount',cart_discount,'tax_rate',tax_rate,'tax',tax,'total',total,'payment_method',method,'tendered',tender,'change_due',CASE WHEN method='cash' THEN tender-total ELSE 0 END,'outstanding',CASE WHEN method='credit' THEN total ELSE 0 END);
 INSERT INTO public.pos_sales(id,receipt_number,request_key,request_fingerprint,operator_id,customer_id,payment_method,subtotal,item_discount,cart_discount,tax_rate,tax,total,tendered,change_due,receipt) VALUES(sale_id,receipt_no,req_key,fingerprint,actor,customer_id,method,subtotal,item_discount,cart_discount,tax_rate,tax,total,tender,CASE WHEN method='cash' THEN tender-total ELSE 0 END,receipt);
 FOR item IN SELECT * FROM jsonb_array_elements(receipt_items) LOOP
  INSERT INTO public.pos_sale_items(sale_id,product_id,product_name,sku,size,color,quantity,unit_price,discount,line_total) VALUES(sale_id,(item->>'product_id')::uuid,item->>'product_name',item->>'sku',item->>'size',item->>'color',(item->>'quantity')::int,(item->>'unit_price')::numeric,(item->>'discount')::numeric,(item->>'line_total')::numeric);
 END LOOP;
 FOR agg IN SELECT (i->>'product_id')::uuid AS id,sum((i->>'quantity')::int)::int AS qty FROM jsonb_array_elements(items) i GROUP BY 1 ORDER BY 1 LOOP UPDATE public.products SET stock=stock-agg.qty WHERE id=agg.id; END LOOP;
 IF method='credit' THEN INSERT INTO public.pos_credit_entries(customer_id,sale_id,amount,created_by) VALUES(customer_id,sale_id,total,actor); END IF;
 RETURN sale_id;
END $$;
REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated;