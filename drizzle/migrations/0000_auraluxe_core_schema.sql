-- ============ ROLES ============
create type public.app_role as enum ('admin','staff','customer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id or public.has_role(auth.uid(),'admin'));
create policy "own profile write" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ CATEGORIES ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);
create policy "categories admin write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();

-- ============ PRODUCTS ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sku text,
  description text,
  fabric text,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(10,2) not null default 0,
  sale_price numeric(10,2),
  stock int not null default 0,
  low_stock_threshold int not null default 5,
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  images text[] not null default '{}',
  size_chart text,
  is_new boolean not null default false,
  is_bestseller boolean not null default false,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public read" on public.products for select to anon, authenticated using (is_published = true or public.has_role(auth.uid(),'admin'));
create policy "products admin write" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  sku text,
  stock int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.product_variants to anon;
grant select, insert, update, delete on public.product_variants to authenticated;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;
create policy "variants public read" on public.product_variants for select to anon, authenticated using (true);
create policy "variants admin write" on public.product_variants for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ ORDERS ============
create type public.order_status as enum ('pending','confirmed','processing','shipped','delivered','cancelled','returned');
create type public.payment_status as enum ('unpaid','paid','refunded');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default 'AL-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text),1,5)),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address text not null,
  city text,
  state text,
  country text default 'Nepal',
  postal_code text,
  delivery_notes text,
  payment_method text not null default 'cod',
  payment_status public.payment_status not null default 'unpaid',
  status public.order_status not null default 'pending',
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  coupon_code text,
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders guest insert" on public.orders for insert to anon with check (true);
create policy "orders user insert" on public.orders for insert to authenticated with check (true);
create policy "orders read" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin') or user_id = auth.uid());
create policy "orders admin update" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "orders admin delete" on public.orders for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  image_url text,
  size text,
  color text,
  unit_price numeric(10,2) not null default 0,
  quantity int not null default 1,
  created_at timestamptz not null default now()
);
grant insert on public.order_items to anon;
grant select, insert, update, delete on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "order items guest insert" on public.order_items for insert to anon with check (true);
create policy "order items user insert" on public.order_items for insert to authenticated with check (true);
create policy "order items read" on public.order_items for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "order items admin write" on public.order_items for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "order items admin delete" on public.order_items for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ============ COUPONS ============
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percent',
  value numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0,
  category_id uuid references public.categories(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  usage_limit int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.coupons to anon;
grant select, insert, update, delete on public.coupons to authenticated;
grant all on public.coupons to service_role;
alter table public.coupons enable row level security;
create policy "coupons public read active" on public.coupons for select to anon, authenticated using (is_active = true or public.has_role(auth.uid(),'admin'));
create policy "coupons admin write" on public.coupons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ BANNERS ============
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text,
  button_text text,
  button_link text,
  placement text not null default 'hero',
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.banners to anon;
grant select, insert, update, delete on public.banners to authenticated;
grant all on public.banners to service_role;
alter table public.banners enable row level security;
create policy "banners public read" on public.banners for select to anon, authenticated using (true);
create policy "banners admin write" on public.banners for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ PAGES (CMS) ============
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content text,
  meta_description text,
  image_url text,
  updated_at timestamptz not null default now()
);
grant select on public.pages to anon;
grant select, insert, update, delete on public.pages to authenticated;
grant all on public.pages to service_role;
alter table public.pages enable row level security;
create policy "pages public read" on public.pages for select to anon, authenticated using (true);
create policy "pages admin write" on public.pages for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();

-- ============ SITE SETTINGS ============
create table public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon;
grant select, insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "settings public read" on public.site_settings for select to anon, authenticated using (true);
create policy "settings admin write" on public.site_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger settings_touch before update on public.site_settings for each row execute function public.touch_updated_at();

-- ============ TESTIMONIALS / REVIEWS ============
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  author_name text not null,
  location text,
  rating int not null default 5,
  body text not null,
  is_approved boolean not null default true,
  is_testimonial boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews public read" on public.reviews for select to anon, authenticated using (is_approved = true or public.has_role(auth.uid(),'admin'));
create policy "reviews admin write" on public.reviews for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ SEED ============
insert into public.categories (name, slug, description, sort_order) values
 ('Kurtis','kurtis','Everyday and festive kurtis in breathable fabrics',1),
 ('Co-ord Sets','co-ord-sets','Matched sets, effortlessly styled',2),
 ('Suits','suits','Three-piece and tailored suit sets',3),
 ('Dresses','dresses','Flowing dresses for every occasion',4),
 ('Party Wear','party-wear','Embroidered and embellished occasion wear',5),
 ('New Arrivals','new-arrivals','Just landed at Auraluxe',6),
 ('Sale','sale','Limited-time reductions',7),
 ('Seasonal Collections','seasonal-collections','Curated seasonal edits',8);

insert into public.products (name, slug, sku, description, fabric, category_id, price, sale_price, stock, sizes, colors, images, size_chart, is_new, is_bestseller, is_featured)
values
 ('Meera Georgette Kurti','meera-georgette-kurti','AL-KU-001','A softly draped georgette kurti with hand-finished neckline detail. Breathable, lightweight and cut for all-day comfort.','Georgette',(select id from public.categories where slug='kurtis'),2450,null,18,'{"S","M","L","XL"}','{"Ivory","Lavender"}','{"/images/product-meera-kurti.jpg"}','S: 36" bust · M: 38" · L: 40" · XL: 42"',true,false,true),
 ('Sana Co-ord Set','sana-co-ord-set','AL-CO-002','A cotton-silk blouse and palazzo set, tailored to fall beautifully. A best seller for a reason.','Cotton Silk',(select id from public.categories where slug='co-ord-sets'),5200,3900,12,'{"S","M","L"}','{"Sage","Ivory"}','{"/images/product-sana-coord.jpg"}','S: 36" bust · M: 38" · L: 40"',true,true,true),
 ('Aria Embroidered Gown','aria-embroidered-gown','AL-PW-003','Hand-embroidered silk-blend gown with a flowing hem — made for weddings and evenings out.','Silk Blend',(select id from public.categories where slug='party-wear'),6200,4680,6,'{"Free Size"}','{"Dusty Rose"}','{"/images/product-aria-gown.jpg"}','Free size · fits 34"–40" bust',false,true,true),
 ('Nira Cotton Kurti','nira-cotton-kurti','AL-KU-004','Crisp cotton kurti with side slits and a relaxed fit for warm Nepalgunj afternoons.','Pure Cotton',(select id from public.categories where slug='kurtis'),1950,null,24,'{"M","L","XL","XXL"}','{"White","Sky"}','{"/images/product-nira-kurti.jpg"}','M: 38" · L: 40" · XL: 42" · XXL: 44"',true,false,false),
 ('Rhea Printed Dress','rhea-printed-dress','AL-DR-005','A fluid printed midi dress with a tie waist — easy to wear, easy to love.','Rayon',(select id from public.categories where slug='dresses'),3400,2890,9,'{"S","M","L"}','{"Mauve"}','{"/images/product-rhea-dress.jpg"}','S: 36" · M: 38" · L: 40"',false,true,true),
 ('Isha Festive Suit','isha-festive-suit','AL-SU-006','Three-piece festive suit with dupatta, finished with delicate thread work.','Chanderi',(select id from public.categories where slug='suits'),7400,null,4,'{"M","L","XL"}','{"Deep Plum"}','{"/images/product-isha-suit.jpg"}','M: 38" · L: 40" · XL: 42"',false,false,true);

insert into public.banners (title, subtitle, image_url, button_text, button_link, placement, sort_order) values
 ('The season''s silhouette, cut for comfort.','Hand-finished kurtis, co-ord sets and party wear in breathable georgette and cotton — designed in Nepalgunj, delivered to your door.','/images/hero-auraluxe.jpg','Shop New In','/shop','hero',1),
 ('Monsoon Edit — up to 40% off','Fresh for the rains. Use code AURA20 at checkout.',null,'Shop the sale','/shop?category=sale','promo',1);

insert into public.coupons (code, type, value, min_order, is_active) values ('AURA20','percent',20,3000,true);

insert into public.reviews (author_name, location, rating, body, is_testimonial) values
 ('Pramila Shrestha','Nepalgunj',5,'The kurti arrived folded in tissue like a small gift. The fabric drapes beautifully — it has become my go-to.',true),
 ('Aarati K.C.','Bardia',5,'Sitting somewhere between traditional craft and modern tailoring. Worth every rupee.',true),
 ('Sunita Thapa','Kohalpur',5,'Ordered on WhatsApp and it reached me in two days. The fit was exactly as the size chart said.',true);

insert into public.pages (slug, title, content, meta_description) values
 ('about','About Auraluxe','Auraluxe began in a small studio in Nepalgunj with a simple idea: ladies'' wear should feel as good as it looks.

We work with breathable georgette, pure cotton, chanderi and silk blends, and finish every piece by hand. Our cuts are made for real days — school runs, office hours, long weddings and quiet evenings.

Our mission is to bring thoughtfully made, honestly priced fashion to women across Nepal, with service that feels personal.','The story, mission and studio behind Auraluxe, a ladies fashion label based in Nepalgunj, Nepal.'),
 ('faq','Frequently Asked Questions','**How long does delivery take?**
Inside Nepalgunj, 1–2 days. Elsewhere in Nepal, 3–5 working days.

**Can I pay on delivery?**
Yes. Cash on Delivery is available across Nepal.

**Can I exchange a size?**
Yes, within 7 days of delivery if the piece is unworn with tags attached.','Answers to common questions about Auraluxe delivery, payment, sizing and exchanges.'),
 ('shipping-policy','Shipping Policy','Orders are dispatched within 24 hours on working days. Free shipping applies on orders over Rs. 3,500. Inside Nepalgunj delivery is 1–2 days; elsewhere in Nepal 3–5 working days.','Auraluxe shipping timelines, charges and free shipping threshold.'),
 ('return-policy','Return & Exchange Policy','Pieces may be returned or exchanged within 7 days of delivery if unworn, unwashed and with tags attached. Sale items are exchange-only.','Auraluxe return and exchange terms.'),
 ('privacy-policy','Privacy Policy','We collect only the information needed to process and deliver your order: your name, phone number, email and address. We never sell or share your details with third parties.','How Auraluxe collects, uses and protects your personal information.'),
 ('terms','Terms & Conditions','By placing an order with Auraluxe you agree to our pricing, shipping and return terms as published on this website. Prices are listed in Nepalese Rupees and include applicable taxes.','Terms and conditions for shopping with Auraluxe.');

insert into public.site_settings (key, value) values
 ('brand_name','AURALUXE'),
 ('tagline','Ladies'' fashion atelier · Nepalgunj'),
 ('phone','+977 981-0000000'),
 ('whatsapp','9779810000000'),
 ('email','hello@auraluxe.com.np'),
 ('address','Main Road, Nepalgunj, Banke, Nepal'),
 ('map_embed','https://www.google.com/maps?q=Nepalgunj,Nepal&output=embed'),
 ('instagram','https://instagram.com/auraluxe'),
 ('tiktok','https://tiktok.com/@auraluxe'),
 ('facebook','https://facebook.com/auraluxe'),
 ('currency','Rs.'),
 ('shipping_charge','150'),
 ('free_shipping_threshold','3500'),
 ('tax_percent','0'),
 ('payment_methods','cod,bank_transfer'),
 ('store_hours','Sun–Fri 10:00–19:00 · Sat 11:00–17:00'),
 ('announcement','Complimentary shipping over Rs. 3,500 · Nepalgunj');