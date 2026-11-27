-- Harden the existing coupon catalogue without changing existing coupon or order rows.
-- Coupon writes remain restricted by the existing coupons_admin_write RLS policy.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coupons_code_format_check') then
    alter table public.coupons add constraint coupons_code_format_check
      check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_-]{3,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_type_check') then
    alter table public.coupons add constraint coupons_type_check
      check (type in ('percent', 'fixed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_value_check') then
    alter table public.coupons add constraint coupons_value_check
      check (value > 0 and (type <> 'percent' or value <= 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_min_order_check') then
    alter table public.coupons add constraint coupons_min_order_check
      check (min_order >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_usage_limit_check') then
    alter table public.coupons add constraint coupons_usage_limit_check
      check (usage_limit is null or usage_limit > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_used_count_check') then
    alter table public.coupons add constraint coupons_used_count_check
      check (used_count >= 0);
  end if;
end $$;

-- Ensure only admins can write coupons; active coupon visibility for checkout
-- remains as configured by the existing public-read policy.
drop policy if exists "coupons admin write" on public.coupons;
create policy "coupons admin write" on public.coupons
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
