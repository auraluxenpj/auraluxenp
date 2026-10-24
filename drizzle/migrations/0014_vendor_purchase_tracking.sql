CREATE TABLE public.vendors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 150),phone text NOT NULL CHECK(length(phone) BETWEEN 7 AND 20),email text NOT NULL DEFAULT '',address text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',created_by uuid NOT NULL DEFAULT auth.uid(),updated_by uuid NOT NULL DEFAULT auth.uid(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.vendors FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.vendors TO authenticated; GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin vendor read" ON public.vendors FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin vendor insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'admin') AND created_by=auth.uid() AND updated_by=auth.uid());
CREATE POLICY "Admin vendor update" ON public.vendors FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin') AND updated_by=auth.uid());
CREATE TRIGGER vendors_touch BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.purchase_bills(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid NOT NULL REFERENCES public.vendors(id),invoice_number text NOT NULL CHECK(length(trim(invoice_number)) BETWEEN 1 AND 100),bill_date date NOT NULL,due_date date,vendor_snapshot jsonb NOT NULL,subtotal numeric(14,2) NOT NULL,discount numeric(14,2) NOT NULL,tax_rate numeric(6,2) NOT NULL,tax numeric(14,2) NOT NULL,total numeric(14,2) NOT NULL CHECK(total>0),notes text NOT NULL DEFAULT '',bill_reference text NOT NULL DEFAULT '',request_key uuid NOT NULL UNIQUE,request_fingerprint text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.purchase_bills FROM anon,authenticated;
GRANT SELECT ON public.purchase_bills TO authenticated; GRANT ALL ON public.purchase_bills TO service_role;
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin purchase read" ON public.purchase_bills FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX purchase_vendor_invoice_unique ON public.purchase_bills(vendor_id,lower(trim(invoice_number)));
CREATE TABLE public.purchase_bill_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bill_id uuid NOT NULL REFERENCES public.purchase_bills(id),sort_order integer NOT NULL,description text NOT NULL,quantity numeric(12,3) NOT NULL CHECK(quantity>0),unit_cost numeric(14,2) NOT NULL CHECK(unit_cost>=0),line_total numeric(14,2) NOT NULL);
REVOKE ALL ON public.purchase_bill_items FROM anon,authenticated;
GRANT SELECT ON public.purchase_bill_items TO authenticated; GRANT ALL ON public.purchase_bill_items TO service_role;
ALTER TABLE public.purchase_bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin purchase item read" ON public.purchase_bill_items FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.purchase_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bill_id uuid NOT NULL REFERENCES public.purchase_bills(id),payment_date date NOT NULL,amount numeric(14,2) NOT NULL CHECK(amount>0),payment_source text NOT NULL CHECK(payment_source IN ('cash','bank_qr')),reference text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',request_key uuid NOT NULL UNIQUE,request_fingerprint text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.purchase_payments FROM anon,authenticated;
GRANT SELECT ON public.purchase_payments TO authenticated; GRANT ALL ON public.purchase_payments TO service_role;
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin purchase payment read" ON public.purchase_payments FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX purchase_payment_bill_idx ON public.purchase_payments(bill_id);
CREATE OR REPLACE FUNCTION public.record_purchase_bill(p_request jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k uuid; fingerprint text; old public.purchase_bills%rowtype; vendor public.vendors%rowtype; bill_id uuid:=gen_random_uuid(); item jsonb; items jsonb; qty numeric; cost numeric; subtotal numeric:=0; discount numeric; tax_rate numeric; tax numeric; total numeric; bill_day date; due_day date; n integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 k:=(p_request->>'request_key')::uuid;IF k IS NULL THEN RAISE EXCEPTION 'Request key required';END IF;
 fingerprint:=md5(auth.uid()::text||p_request::text);PERFORM pg_advisory_xact_lock(hashtextextended('purchase:'||k::text,0));
 SELECT * INTO old FROM public.purchase_bills WHERE request_key=k;IF FOUND THEN IF old.request_fingerprint<>fingerprint THEN RAISE EXCEPTION 'Request key used with different details';END IF;RETURN old.id;END IF;
 SELECT * INTO vendor FROM public.vendors WHERE id=(p_request->>'vendor_id')::uuid;IF NOT FOUND THEN RAISE EXCEPTION 'Vendor not found';END IF;
 bill_day:=(p_request->>'bill_date')::date;due_day:=nullif(p_request->>'due_date','')::date;
 IF bill_day IS NULL OR bill_day>(now() AT TIME ZONE 'Asia/Kathmandu')::date OR due_day<bill_day THEN RAISE EXCEPTION 'Invalid bill or due date';END IF;
 IF nullif(trim(p_request->>'invoice_number'),'') IS NULL OR length(p_request->>'invoice_number')>100 THEN RAISE EXCEPTION 'Vendor invoice number required';END IF;
 items:=p_request->'items';IF items IS NULL OR jsonb_typeof(items)<>'array' THEN RAISE EXCEPTION 'Bill items required';END IF;IF jsonb_array_length(items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Bill needs 1 to 100 lines';END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(items) LOOP
 qty:=(item->>'quantity')::numeric;cost:=(item->>'unit_cost')::numeric;
 IF qty IS NULL OR qty<=0 OR qty>999999 OR qty<>round(qty,3) OR cost IS NULL OR cost<0 OR cost>999999999 OR cost<>round(cost,2) OR nullif(trim(item->>'description'),'') IS NULL OR length(item->>'description')>300 THEN RAISE EXCEPTION 'Invalid purchase line';END IF;
 subtotal:=subtotal+round(qty*cost,2);
 END LOOP;
 discount:=coalesce((p_request->>'discount')::numeric,0);tax_rate:=coalesce((p_request->>'tax_rate')::numeric,0);
 IF discount<0 OR discount>subtotal OR discount<>round(discount,2) OR tax_rate<0 OR tax_rate>100 OR tax_rate<>round(tax_rate,2) THEN RAISE EXCEPTION 'Invalid discount or tax';END IF;
 tax:=round((subtotal-discount)*tax_rate/100,2);total:=subtotal-discount+tax;
 IF total<=0 OR total>999999999 THEN RAISE EXCEPTION 'Purchase total must be positive and within limit';END IF;
 IF length(coalesce(p_request->>'notes',''))>1000 OR length(coalesce(p_request->>'bill_reference',''))>300 THEN RAISE EXCEPTION 'Notes or reference too long';END IF;
 INSERT INTO public.purchase_bills(id,vendor_id,invoice_number,bill_date,due_date,vendor_snapshot,subtotal,discount,tax_rate,tax,total,notes,bill_reference,request_key,request_fingerprint,created_by) VALUES(bill_id,vendor.id,trim(p_request->>'invoice_number'),bill_day,due_day,jsonb_build_object('name',vendor.name,'phone',vendor.phone,'email',vendor.email,'address',vendor.address),subtotal,discount,tax_rate,tax,total,coalesce(p_request->>'notes',''),coalesce(p_request->>'bill_reference',''),k,fingerprint,auth.uid());
 FOR item IN SELECT * FROM jsonb_array_elements(items) LOOP INSERT INTO public.purchase_bill_items(bill_id,sort_order,description,quantity,unit_cost,line_total) VALUES(bill_id,n,trim(item->>'description'),(item->>'quantity')::numeric,(item->>'unit_cost')::numeric,round((item->>'quantity')::numeric*(item->>'unit_cost')::numeric,2));n:=n+1;END LOOP;
 RETURN bill_id;
END $$;
REVOKE ALL ON FUNCTION public.record_purchase_bill(jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.record_purchase_bill(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.record_purchase_payment(p_request jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k uuid;fingerprint text;old public.purchase_payments%rowtype;bill public.purchase_bills%rowtype;amount numeric;paid numeric;payment_day date;payment_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required';END IF;
 k:=(p_request->>'request_key')::uuid;IF k IS NULL THEN RAISE EXCEPTION 'Request key required';END IF;fingerprint:=md5(auth.uid()::text||p_request::text);PERFORM pg_advisory_xact_lock(hashtextextended('purchase-payment:'||k::text,0));
 SELECT * INTO old FROM public.purchase_payments WHERE request_key=k;IF FOUND THEN IF old.request_fingerprint<>fingerprint THEN RAISE EXCEPTION 'Request key used with different details';END IF;RETURN old.id;END IF;
 SELECT * INTO bill FROM public.purchase_bills WHERE id=(p_request->>'bill_id')::uuid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found';END IF;
 amount:=(p_request->>'amount')::numeric;payment_day:=(p_request->>'payment_date')::date;
 IF amount IS NULL OR amount<=0 OR amount<>round(amount,2) OR payment_day IS NULL OR payment_day<bill.bill_date OR payment_day>(now() AT TIME ZONE 'Asia/Kathmandu')::date THEN RAISE EXCEPTION 'Invalid payment amount or date';END IF;
 SELECT coalesce(sum(p.amount),0) INTO paid FROM public.purchase_payments p WHERE p.bill_id=bill.id;IF amount>bill.total-paid THEN RAISE EXCEPTION 'Payment exceeds remaining bill balance';END IF;
 IF length(coalesce(p_request->>'notes',''))>1000 OR length(coalesce(p_request->>'reference',''))>300 THEN RAISE EXCEPTION 'Notes or reference too long';END IF;
 INSERT INTO public.purchase_payments(bill_id,payment_date,amount,payment_source,reference,notes,request_key,request_fingerprint,created_by) VALUES(bill.id,payment_day,amount,p_request->>'payment_source',coalesce(p_request->>'reference',''),coalesce(p_request->>'notes',''),k,fingerprint,auth.uid()) RETURNING id INTO payment_id;RETURN payment_id;
END $$;
REVOKE ALL ON FUNCTION public.record_purchase_payment(jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.record_purchase_payment(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_purchase_data(p_bill_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required';END IF;
 SELECT jsonb_build_object('vendors',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.name,v.id) FROM public.vendors v),'[]'::jsonb),'bills',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('paid',coalesce((SELECT sum(amount) FROM public.purchase_payments WHERE bill_id=b.id),0),'items',CASE WHEN p_bill_id IS NOT NULL THEN coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order) FROM public.purchase_bill_items i WHERE i.bill_id=b.id),'[]'::jsonb) ELSE '[]'::jsonb END,'payments',CASE WHEN p_bill_id IS NOT NULL THEN coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.payment_date,p.created_at,p.id) FROM public.purchase_payments p WHERE p.bill_id=b.id),'[]'::jsonb) ELSE '[]'::jsonb END) ORDER BY b.bill_date DESC,b.created_at DESC) FROM public.purchase_bills b WHERE p_bill_id IS NULL OR b.id=p_bill_id),'[]'::jsonb)) INTO result;RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_purchase_data(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.get_purchase_data(uuid) TO authenticated;