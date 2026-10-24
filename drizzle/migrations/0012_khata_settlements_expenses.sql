CREATE TABLE public.pos_repayments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.pos_customers(id), amount numeric(14,2) NOT NULL CHECK(amount>0), payment_method text NOT NULL CHECK(payment_method IN ('cash','qr')), request_key uuid NOT NULL UNIQUE, request_fingerprint text NOT NULL, voucher_number text NOT NULL UNIQUE, balance_after numeric(14,2) NOT NULL CHECK(balance_after>=0), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), voucher jsonb NOT NULL);
REVOKE ALL ON public.pos_repayments FROM anon,authenticated;
GRANT SELECT ON public.pos_repayments TO authenticated;
GRANT ALL ON public.pos_repayments TO service_role;
ALTER TABLE public.pos_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin repayment read" ON public.pos_repayments FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX pos_repayments_customer_idx ON public.pos_repayments(customer_id,created_at);
CREATE TABLE public.business_expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), expense_date date NOT NULL, category text NOT NULL CHECK(category IN ('Packaging & Courier','Refreshments/Tea','Rent & Utilities','Shop Maintenance','Staff Allowance','Miscellaneous')), payment_source text NOT NULL CHECK(payment_source IN ('cash','bank_qr')), amount numeric(14,2) NOT NULL CHECK(amount>0), payee text NOT NULL CHECK(length(trim(payee)) BETWEEN 1 AND 150), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000), receipt_reference text NOT NULL DEFAULT '' CHECK(length(receipt_reference)<=300), request_key uuid NOT NULL UNIQUE, request_fingerprint text NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.business_expenses FROM anon,authenticated;
GRANT SELECT ON public.business_expenses TO authenticated;
GRANT ALL ON public.business_expenses TO service_role;
ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin expense read" ON public.business_expenses FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX business_expenses_date_idx ON public.business_expenses(expense_date);
CREATE SEQUENCE public.pos_voucher_sequence;
REVOKE ALL ON SEQUENCE public.pos_voucher_sequence FROM anon,authenticated;
GRANT ALL ON SEQUENCE public.pos_voucher_sequence TO service_role;
CREATE OR REPLACE FUNCTION public.get_pos_customer_balances() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.can_use_pos() THEN RAISE EXCEPTION 'POS access denied'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'balance',coalesce((SELECT sum(amount) FROM public.pos_credit_entries WHERE customer_id=c.id),0)-coalesce((SELECT sum(amount) FROM public.pos_repayments WHERE customer_id=c.id),0)) ORDER BY c.name,c.id) FROM public.pos_customers c),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_pos_customer_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pos_customer_balances() TO authenticated;
CREATE OR REPLACE FUNCTION public.lock_pos_credit_customer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM 1 FROM public.pos_customers WHERE id=NEW.customer_id FOR UPDATE; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.lock_pos_credit_customer() FROM PUBLIC;
CREATE TRIGGER pos_credit_customer_lock BEFORE INSERT ON public.pos_credit_entries FOR EACH ROW EXECUTE FUNCTION public.lock_pos_credit_customer();
CREATE OR REPLACE FUNCTION public.record_pos_repayment(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k uuid; fingerprint text; old public.pos_repayments%rowtype; c public.pos_customers%rowtype; amount numeric; method text; balance numeric; voucher jsonb; store jsonb; voucher_no text; repayment_id uuid:=gen_random_uuid(); actor_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 k:=(p_request->>'request_key')::uuid; IF k IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
 fingerprint:=md5(auth.uid()::text||p_request::text); PERFORM pg_advisory_xact_lock(hashtextextended('repayment:'||k::text,0));
 SELECT * INTO old FROM public.pos_repayments WHERE request_key=k;
 IF FOUND THEN IF old.request_fingerprint<>fingerprint THEN RAISE EXCEPTION 'Request key used with different details'; END IF; RETURN old.voucher; END IF;
 SELECT * INTO c FROM public.pos_customers WHERE id=(p_request->>'customer_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
 amount:=(p_request->>'amount')::numeric; method:=p_request->>'payment_method';
 IF amount IS NULL OR amount<=0 OR amount>999999999 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Invalid repayment amount'; END IF;
 IF method IS NULL OR method NOT IN ('cash','qr') THEN RAISE EXCEPTION 'Invalid repayment method'; END IF;
 IF method='qr' AND (NOT coalesce((p_request->>'qr_confirmed')::boolean,false) OR public.get_pos_qr() IS NULL) THEN RAISE EXCEPTION 'Configured QR and merchant receipt confirmation required'; END IF;
 SELECT coalesce((SELECT sum(e.amount) FROM public.pos_credit_entries e WHERE customer_id=c.id),0)-coalesce((SELECT sum(r.amount) FROM public.pos_repayments r WHERE customer_id=c.id),0) INTO balance;
 IF amount>balance THEN RAISE EXCEPTION 'Repayment exceeds outstanding balance'; END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO store FROM public.site_settings WHERE key IN ('brand_name','address','phone','email','currency');
 SELECT coalesce(nullif(full_name,''),'Admin') INTO actor_name FROM public.profiles WHERE id=auth.uid(); actor_name:=coalesce(actor_name,'Admin');
 voucher_no:='AL-RCV-'||to_char(now() AT TIME ZONE 'Asia/Kathmandu','YYMMDD')||'-'||lpad(nextval('public.pos_voucher_sequence')::text,6,'0');
 voucher:=jsonb_build_object('id',repayment_id,'voucher_number',voucher_no,'customer_id',c.id,'customer_name',c.name,'customer_phone',c.phone,'amount',amount,'payment_method',method,'balance_before',balance,'balance_after',balance-amount,'created_at',now(),'operator_name',actor_name,'store',store);
 INSERT INTO public.pos_repayments(id,customer_id,amount,payment_method,request_key,request_fingerprint,voucher_number,balance_after,created_by,voucher) VALUES(repayment_id,c.id,amount,method,k,fingerprint,voucher_no,balance-amount,auth.uid(),voucher);
 RETURN voucher;
END $$;
REVOKE ALL ON FUNCTION public.record_pos_repayment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_pos_repayment(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.record_business_expense(p_request jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k uuid; fingerprint text; old public.business_expenses%rowtype; amount numeric; expense_day date; expense_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 k:=(p_request->>'request_key')::uuid; IF k IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
 fingerprint:=md5(auth.uid()::text||p_request::text); PERFORM pg_advisory_xact_lock(hashtextextended('expense:'||k::text,0));
 SELECT * INTO old FROM public.business_expenses WHERE request_key=k;
 IF FOUND THEN IF old.request_fingerprint<>fingerprint THEN RAISE EXCEPTION 'Request key used with different details'; END IF; RETURN old.id; END IF;
 amount:=(p_request->>'amount')::numeric; expense_day:=(p_request->>'expense_date')::date;
 IF amount IS NULL OR amount<=0 OR amount>999999999 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Invalid expense amount'; END IF;
 IF expense_day IS NULL OR expense_day>(now() AT TIME ZONE 'Asia/Kathmandu')::date THEN RAISE EXCEPTION 'Expense date cannot be in the future'; END IF;
 INSERT INTO public.business_expenses(expense_date,category,payment_source,amount,payee,notes,receipt_reference,request_key,request_fingerprint,created_by) VALUES(expense_day,p_request->>'category',p_request->>'payment_source',amount,trim(p_request->>'payee'),coalesce(p_request->>'notes',''),coalesce(p_request->>'receipt_reference',''),k,fingerprint,auth.uid()) RETURNING id INTO expense_id;
 RETURN expense_id;
END $$;
REVOKE ALL ON FUNCTION public.record_business_expense(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_business_expense(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_business_day_summary(p_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE start_at timestamptz; end_at timestamptz; cash_sales numeric; cash_recovered numeric; cash_expenses numeric; all_expenses numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 start_at:=p_date::timestamp AT TIME ZONE 'Asia/Kathmandu'; end_at:=(p_date+1)::timestamp AT TIME ZONE 'Asia/Kathmandu';
 SELECT coalesce(sum(total),0) INTO cash_sales FROM public.pos_sales WHERE payment_method='cash' AND created_at>=start_at AND created_at<end_at;
 SELECT coalesce(sum(amount),0) INTO cash_recovered FROM public.pos_repayments WHERE payment_method='cash' AND created_at>=start_at AND created_at<end_at;
 SELECT coalesce(sum(amount) FILTER(WHERE payment_source='cash'),0),coalesce(sum(amount),0) INTO cash_expenses,all_expenses FROM public.business_expenses WHERE expense_date=p_date;
 RETURN jsonb_build_object('cash_sales',cash_sales,'cash_recovered',cash_recovered,'cash_expenses',cash_expenses,'total_expenses',all_expenses,'net_cashflow',cash_sales+cash_recovered-cash_expenses);
END $$;
REVOKE ALL ON FUNCTION public.get_business_day_summary(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_day_summary(date) TO authenticated;