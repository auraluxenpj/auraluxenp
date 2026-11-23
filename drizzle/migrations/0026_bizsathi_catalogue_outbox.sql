-- 0026: durable, SKU-ordered catalogue outbox to BizSathi.
-- Inbound catalogue imports set a transaction-local origin marker so they do not echo.
CREATE TABLE public.bizsathi_catalogue_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL CHECK (length(btrim(sku)) BETWEEN 1 AND 80),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  locked_until timestamptz,
  delivered_at timestamptz,
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bizsathi_catalogue_outbox_ready
  ON public.bizsathi_catalogue_outbox(available_at,id)
  WHERE status IN ('pending','processing');
ALTER TABLE public.bizsathi_catalogue_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bizsathi_catalogue_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bizsathi_catalogue_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_bizsathi_catalogue_variant(_variant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.product_variants%rowtype; p public.products%rowtype; cat text;
BEGIN
  IF current_setting('app.catalogue_sync_origin',true) = 'bizsathi' THEN RETURN; END IF;
  SELECT * INTO v FROM public.product_variants WHERE id=_variant_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO p FROM public.products WHERE id=v.product_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT c.name INTO cat FROM public.categories c WHERE c.id=p.category_id;
  INSERT INTO public.bizsathi_catalogue_outbox(sku,payload)
  VALUES (v.sku,jsonb_build_object(
    'product_id',p.id,'variant_id',v.id,'name',p.name,'category',coalesce(cat,'Uncategorised'),
    'variant_name',coalesce(v.bizsathi_variant_name,'Standard'),
    'model_code',coalesce(v.bizsathi_model_code,p.model_code),
    'sku',v.sku,'unit',coalesce(v.unit,'pcs'),'sizes',to_jsonb(coalesce(p.sizes,'{}'::text[])),
    'purchase_price',coalesce(v.purchase_price,0),'mrp',coalesce(v.mrp,0),
    'selling_price',coalesce(p.price,0),'wholesale_price',coalesce(v.wholesale_price,0),
    'reorder_level',coalesce(v.reorder_level,0),'published',coalesce(p.is_published,false),
    'notes',coalesce(v.notes,p.notes),'barcode',v.barcode
  ));
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_bizsathi_catalogue_from_variant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.enqueue_bizsathi_catalogue_variant(NEW.id);
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.enqueue_bizsathi_catalogue_from_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v record;
BEGIN
  IF current_setting('app.catalogue_sync_origin',true) = 'bizsathi' THEN RETURN NEW; END IF;
  FOR v IN SELECT id FROM public.product_variants WHERE product_id=NEW.id ORDER BY id LOOP
    PERFORM public.enqueue_bizsathi_catalogue_variant(v.id);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER bizsathi_catalogue_variant_outbox
  AFTER INSERT OR UPDATE OF sku,barcode,unit,purchase_price,mrp,wholesale_price,reorder_level,notes,bizsathi_variant_name,bizsathi_model_code
  ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.enqueue_bizsathi_catalogue_from_variant();
CREATE TRIGGER bizsathi_catalogue_product_outbox
  AFTER UPDATE OF name,category_id,price,sizes,model_code,is_published,notes
  ON public.products FOR EACH ROW EXECUTE FUNCTION public.enqueue_bizsathi_catalogue_from_product();

CREATE OR REPLACE FUNCTION public.claim_bizsathi_catalogue_outbox(_lease uuid,_limit integer DEFAULT 50)
RETURNS SETOF public.bizsathi_catalogue_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' OR _lease IS NULL OR _limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Service authorization and valid lease required';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.bizsathi_catalogue_outbox
    WHERE (status='pending' AND available_at<=now())
       OR (status='processing' AND locked_until<now())
    ORDER BY id FOR UPDATE SKIP LOCKED LIMIT _limit
  )
  UPDATE public.bizsathi_catalogue_outbox o
     SET status='processing',lease_token=_lease,locked_until=now()+interval '2 minutes',attempts=attempts+1
    FROM picked WHERE o.id=picked.id RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION public.ack_bizsathi_catalogue_outbox(_id bigint,_lease uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Service authorization required'; END IF;
  UPDATE public.bizsathi_catalogue_outbox SET status='delivered',delivered_at=now(),
    lease_token=NULL,locked_until=NULL,last_error=NULL
  WHERE id=_id AND status='processing' AND lease_token=_lease;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.fail_bizsathi_catalogue_outbox(_id bigint,_lease uuid,_error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Service authorization required'; END IF;
  UPDATE public.bizsathi_catalogue_outbox
     SET status=CASE WHEN attempts>=12 THEN 'dead' ELSE 'pending' END,
         available_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer*5)),
         lease_token=NULL,locked_until=NULL,last_error=left(coalesce(_error,'delivery failed'),1000)
   WHERE id=_id AND status='processing' AND lease_token=_lease;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_bizsathi_catalogue_variant(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enqueue_bizsathi_catalogue_from_variant() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enqueue_bizsathi_catalogue_from_product() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_bizsathi_catalogue_outbox(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ack_bizsathi_catalogue_outbox(bigint,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_bizsathi_catalogue_outbox(bigint,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bizsathi_catalogue_outbox(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_bizsathi_catalogue_outbox(bigint,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_bizsathi_catalogue_outbox(bigint,uuid,text) TO service_role;

DO $origin$
DECLARE body text; changed text;
BEGIN
  SELECT pg_get_functiondef('public.upsert_shared_catalogue_from_bizsathi(jsonb)'::regprocedure) INTO body;
  changed:=replace(body,E'BEGIN\n  IF auth.uid()',E'BEGIN\n  PERFORM set_config(''app.catalogue_sync_origin'',''bizsathi'',true);\n  IF auth.uid()');
  IF changed=body THEN RAISE EXCEPTION 'Could not install catalogue echo guard'; END IF;
  EXECUTE changed;
END $origin$;
