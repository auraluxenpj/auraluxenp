-- Coupon administration and automatic application.
-- Existing coupon rows and redemption counters are preserved.
alter table public.coupons
  add column if not exists auto_apply boolean not null default false;

create unique index if not exists coupons_code_normalized_uidx
  on public.coupons (upper(trim(code)));
