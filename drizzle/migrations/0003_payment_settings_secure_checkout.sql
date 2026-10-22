-- Auraluxe Phase 1 (draft-staged): editable payment settings, audit history,
-- trusted atomic checkout, and INSERT-only COD removal.
-- Applies only when the draft is accepted. Additive and backwards-compatible:
-- no existing column is dropped, renamed or retyped; legacy COD orders and
-- their updates are untouched.

-- ============================================================================
-- 1. Payment settings (singleton, admin-only)
-- ============================================================================
create table public.payment_settings (
  id text primary key default 'main' check (id = 'main'),
  qr_enabled boolean not null default false,
  qr_provider text,
  qr_merchant_name text,
  qr_instructions text,
  qr_image_path text,
  bank_enabled boolean not null default false,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  bank_account_type text,
  bank_instructions text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

grant select, update on public.payment_settings to authenticated;
grant all on public.payment_settings to service_role;

alter table public.payment_settings enable row level security;

create policy "payment settings admin read" on public.payment_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "payment settings admin update" on public.payment_settings
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Disabled, unconfigured defaults. Genuine merchant details are entered by the
-- owner through admin Payment Settings; nothing is invented here.
insert into public.payment_settings (id) values ('main');

-- ============================================================================
-- 2. Audit history — records the real changer (auth.uid()) and timestamp
-- ============================================================================
create table public.payment_settings_audit (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  snapshot jsonb not null
);

grant select on public.payment_settings_audit to authenticated;
grant all on public.payment_settings_audit to service_role;

alter table public.payment_settings_audit enable row level security;

create policy "payment settings audit admin read" on public.payment_settings_audit
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.audit_payment_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payment_settings_audit (changed_by, snapshot)
  values (auth.uid(), to_jsonb(new));
  return new;
end;
$$;

create trigger payment_settings_audit_trigger
  after update on public.payment_settings
  for each row execute function public.audit_payment_settings();

-- ============================================================================
-- 3. Trusted atomic checkout
-- ============================================================================
alter table public.orders add column checkout_key text;
alter table public.orders add column request_fingerprint text;

create unique index orders_checkout_key_unique
  on public.orders (checkout_key) where checkout_key is not null;

create or replace function public.place_order(
  p_checkout_key text,
  p_payment_method text,
  p_customer jsonb,
  p_items jsonb,
  p_coupon text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.payment_settings%rowtype;
  v_fingerprint text;
  v_existing record;
  v_item jsonb;
  v_product record;
  v_qty int;
  v_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_shipping numeric := 0;
  v_tax numeric := 0;
  v_total numeric;
  v_coupon record;
  v_coupon_code text;
  v_shipping_charge numeric;
  v_free_threshold numeric;
  v_tax_percent numeric;
  v_order_id uuid;
  v_order_number text;
  v_name text;
  v_phone text;
  v_address text;
  v_city text;
begin
  -- ---- customer validation (server-side, never trusting the browser) ----
  v_name := nullif(trim(p_customer->>'customer_name'), '');
  v_phone := nullif(trim(p_customer->>'customer_phone'), '');
  v_address := nullif(trim(p_customer->>'address'), '');
  v_city := nullif(trim(p_customer->>'city'), '');
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Invalid customer name';
  end if;
  if v_phone is null or char_length(v_phone) < 7 or char_length(v_phone) > 20 then
    raise exception 'Invalid phone number';
  end if;
  if v_address is null or char_length(v_address) < 4 or char_length(v_address) > 300 then
    raise exception 'Invalid address';
  end if;
  if v_city is null or char_length(v_city) < 2 or char_length(v_city) > 100 then
    raise exception 'Invalid city';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if p_checkout_key is null or char_length(p_checkout_key) < 16 or char_length(p_checkout_key) > 128 then
    raise exception 'Invalid checkout key';
  end if;

  -- ---- payment method: only enabled, fully configured QR / bank transfer ----
  if p_payment_method not in ('qr', 'bank_transfer') then
    raise exception 'Payment method % is not accepted for new orders', p_payment_method;
  end if;

  select * into v_settings from public.payment_settings where id = 'main';
  if not found then
    raise exception 'Online payment is not configured yet';
  end if;

  if p_payment_method = 'qr' then
    if not (v_settings.qr_enabled
            and v_settings.qr_image_path is not null
            and nullif(trim(coalesce(v_settings.qr_merchant_name, '')), '') is not null) then
      raise exception 'QR payment is not available';
    end if;
  elsif p_payment_method = 'bank_transfer' then
    if not (v_settings.bank_enabled
            and nullif(trim(coalesce(v_settings.bank_name, '')), '') is not null
            and nullif(trim(coalesce(v_settings.bank_account_name, '')), '') is not null
            and nullif(trim(coalesce(v_settings.bank_account_number, '')), '') is not null) then
      raise exception 'Bank transfer is not available';
    end if;
  end if;

  -- ---- idempotency: same key + same payload returns the original order ----
  v_fingerprint := md5(p_payment_method || '|' || coalesce(p_coupon, '') || '|'
                       || p_customer::text || '|' || p_items::text);
  select id, order_number, total, request_fingerprint into v_existing
    from public.orders where checkout_key = p_checkout_key;
  if found then
    if v_existing.request_fingerprint = v_fingerprint then
      return jsonb_build_object(
        'order_id', v_existing.id,
        'order_number', v_existing.order_number,
        'total', v_existing.total,
        'payment_method', p_payment_method,
        'duplicate', true
      );
    end if;
    raise exception 'This checkout key was already used with different details';
  end if;

  -- ---- items: real products, real prices, real stock (rows locked) ----
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_published
      for update;
    if not found then
      raise exception 'A product in your bag is no longer available';
    end if;

    if array_length(v_product.sizes, 1) is not null
       and not (coalesce(v_item->>'size', '') = any(v_product.sizes)) then
      raise exception 'Invalid size for %', v_product.name;
    end if;
    if array_length(v_product.colors, 1) is not null
       and not (coalesce(v_item->>'color', '') = any(v_product.colors)) then
      raise exception 'Invalid colour for %', v_product.name;
    end if;
    if v_product.stock < v_qty then
      raise exception 'Not enough stock for %', v_product.name;
    end if;

    v_price := case
      when v_product.sale_price is not null and v_product.sale_price > 0
        then v_product.sale_price
      else v_product.price
    end;
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  -- ---- coupon: validated against trusted records ----
  if p_coupon is not null and nullif(trim(p_coupon), '') is not null then
    select * into v_coupon from public.coupons
      where upper(code) = upper(trim(p_coupon)) and is_active
      for update;
    if not found then
      raise exception 'That coupon code is not valid';
    end if;
    if (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then
      raise exception 'That coupon has expired';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      raise exception 'That coupon has been fully used';
    end if;
    if v_subtotal < v_coupon.min_order then
      raise exception 'This coupon needs a higher order total';
    end if;
    if v_coupon.product_id is not null and not exists (
      select 1 from jsonb_array_elements(p_items) i
      where (i->>'product_id')::uuid = v_coupon.product_id
    ) then
      raise exception 'This coupon does not apply to these products';
    end if;
    if v_coupon.category_id is not null and not exists (
      select 1 from jsonb_array_elements(p_items) i
      join public.products p on p.id = (i->>'product_id')::uuid
      where p.category_id = v_coupon.category_id
    ) then
      raise exception 'This coupon does not apply to these products';
    end if;
    v_discount := case
      when v_coupon.type = 'fixed' then least(v_subtotal, v_coupon.value)
      else least(v_subtotal, round(v_subtotal * v_coupon.value / 100, 2))
    end;
    v_coupon_code := upper(trim(p_coupon));
  end if;

  -- ---- shipping and tax from trusted settings ----
  select coalesce(nullif(value, '')::numeric, 150) into v_shipping_charge
    from public.site_settings where key = 'shipping_charge';
  v_shipping_charge := coalesce(v_shipping_charge, 150);
  select coalesce(nullif(value, '')::numeric, 0) into v_free_threshold
    from public.site_settings where key = 'free_shipping_threshold';
  v_free_threshold := coalesce(v_free_threshold, 0);
  select coalesce(nullif(value, '')::numeric, 0) into v_tax_percent
    from public.site_settings where key = 'tax_percent';
  v_tax_percent := coalesce(v_tax_percent, 0);

  v_shipping := case
    when v_free_threshold > 0 and v_subtotal >= v_free_threshold then 0
    else v_shipping_charge
  end;
  v_tax := round((v_subtotal - v_discount) * v_tax_percent / 100, 2);
  v_total := greatest(0, v_subtotal - v_discount + v_shipping + v_tax);

  -- ---- atomic write: order + items + stock + coupon usage ----
  insert into public.orders (
    checkout_key, request_fingerprint, user_id,
    customer_name, customer_phone, customer_email,
    address, city, state, country, postal_code, delivery_notes,
    payment_method, payment_status, status,
    subtotal, discount, shipping, total, coupon_code
  ) values (
    p_checkout_key, v_fingerprint, auth.uid(),
    v_name, v_phone, nullif(trim(coalesce(p_customer->>'customer_email', '')), ''),
    v_address, v_city,
    nullif(trim(coalesce(p_customer->>'state', '')), ''),
    coalesce(nullif(trim(coalesce(p_customer->>'country', '')), ''), 'Nepal'),
    nullif(trim(coalesce(p_customer->>'postal_code', '')), ''),
    nullif(trim(coalesce(p_customer->>'delivery_notes', '')), ''),
    p_payment_method, 'unpaid', 'pending',
    v_subtotal, v_discount, v_shipping, v_total, v_coupon_code
  )
  returning id, order_number into v_order_id, v_order_number;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid;
    v_price := case
      when v_product.sale_price is not null and v_product.sale_price > 0
        then v_product.sale_price
      else v_product.price
    end;
    insert into public.order_items (
      order_id, product_id, product_name, image_url, size, color, unit_price, quantity
    ) values (
      v_order_id, v_product.id, v_product.name,
      coalesce(v_product.images[1], null),
      nullif(coalesce(v_item->>'size', ''), ''),
      nullif(coalesce(v_item->>'color', ''), ''),
      v_price, v_qty
    );
    update public.products set stock = stock - v_qty where id = v_product.id;
  end loop;

  if v_coupon_code is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'payment_method', p_payment_method,
    'duplicate', false
  );
end;
$$;

revoke all on function public.place_order(text, text, jsonb, jsonb, text) from public;
grant execute on function public.place_order(text, text, jsonb, jsonb, text) to anon, authenticated;

-- ============================================================================
-- 4. INSERT-only COD rejection (legacy COD rows and their updates untouched)
-- ============================================================================
create or replace function public.reject_unsupported_payment_insert()
returns trigger
language plpgsql
as $$
begin
  if new.payment_method not in ('qr', 'bank_transfer') then
    raise exception 'Payment method % is not accepted for new orders', new.payment_method;
  end if;
  return new;
end;
$$;

create trigger orders_reject_unsupported_payment_insert
  before insert on public.orders
  for each row execute function public.reject_unsupported_payment_insert();

-- ============================================================================
-- 5. Retire direct order inserts — checkout must go through place_order.
--    Owner/admin SELECT, admin UPDATE/DELETE policies and grants are kept.
-- ============================================================================
drop policy if exists "orders guest insert" on public.orders;
drop policy if exists "orders user insert" on public.orders;
drop policy if exists "order items guest insert" on public.order_items;
drop policy if exists "order items user insert" on public.order_items;

revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;

-- ============================================================================
-- 6. Private QR storage policies. The `payment-qr` bucket itself is created
--    with the storage tool at activation time (SQL cannot create buckets);
--    these policies take effect as soon as it exists. No public SELECT:
--    customers receive short-lived signed links from the server instead.
-- ============================================================================
create policy "payment qr admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-qr' and public.has_role(auth.uid(), 'admin'));

create policy "payment qr admin write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-qr' and public.has_role(auth.uid(), 'admin'));

create policy "payment qr admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-qr' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'payment-qr' and public.has_role(auth.uid(), 'admin'));

create policy "payment qr admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-qr' and public.has_role(auth.uid(), 'admin'));
