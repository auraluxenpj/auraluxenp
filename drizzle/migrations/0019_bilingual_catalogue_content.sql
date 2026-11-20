-- Optional Nepali catalogue content. Existing English fields remain canonical fallbacks.
-- Nullable columns preserve all existing records and do not publish or rewrite content.
alter table public.products
  add column if not exists name_ne text,
  add column if not exists description_ne text,
  add column if not exists fabric_ne text;

alter table public.categories
  add column if not exists name_ne text,
  add column if not exists description_ne text;
