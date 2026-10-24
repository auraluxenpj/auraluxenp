CREATE OR REPLACE FUNCTION public.track_order(p_order_number text, p_contact text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  contact_digits text;
  phone_digits text;
  matched boolean := false;
BEGIN
  SELECT * INTO o FROM public.orders
  WHERE upper(order_number) = upper(trim(p_order_number))
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Match on email (case-insensitive) or phone (last digits, formatting-insensitive).
  IF o.customer_email IS NOT NULL AND lower(trim(o.customer_email)) = lower(trim(p_contact)) THEN
    matched := true;
  ELSE
    contact_digits := regexp_replace(coalesce(p_contact, ''), '\D', '', 'g');
    phone_digits := regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g');
    IF length(contact_digits) >= 7 AND right(phone_digits, least(length(contact_digits), length(phone_digits))) = right(contact_digits, least(length(contact_digits), length(phone_digits))) THEN
      matched := true;
    END IF;
  END IF;

  IF NOT matched THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'tracking_number', o.tracking_number,
    'created_at', o.created_at,
    'total', o.total,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity))
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.track_order(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO authenticated;