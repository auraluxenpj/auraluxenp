-- Coupon administration and automatic application.
-- Existing coupon rows and redemption counters are preserved.
-- Legacy coupons remain manual-only unless an admin explicitly enables auto_apply.
alter table public.coupons
  add column if not exists auto_apply boolean not null default false;

create unique index if not exists coupons_code_normalized_uidx
  on public.coupons (upper(trim(code)));
