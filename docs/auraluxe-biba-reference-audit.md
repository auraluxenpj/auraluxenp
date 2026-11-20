# Auraluxe storefront redesign — BIBA reference audit

Date: 2026-11-20
Implementation branch: feature/auraluxe-hybrid-fashion-storefront

## Direction
- Hybrid: high-conversion ethnic-fashion merchandising patterns with Auraluxe's own premium identity.
- Original studio photography and original campaign copy; do not reuse BIBA's logo, text, product photography, or proprietary assets.
- Nepal market and NPR pricing.
- Production architecture remains GitHub + Cloudflare Worker + Supabase. Lovable is not used for development or deployment; its database remains preserved for a later, separately verified data migration.

## Reference observations

### Homepage (https://www.biba.in/)
The public page exposes a multi-layer fashion discovery journey: campaign/collection discovery, recommended products, most-loved products, recently viewed, customer reviews, service assurances, popular search/category links, and grouped footer navigation. The page also supports seasonal and occasion-led browsing.

### Category listing (https://www.biba.in/new-arrival/kurtas-and-tops/)
The current listing includes:
- Product count and category context.
- Filter facets for category, price, size, colour, fabric, fit, neckline, sleeve type, season, and discount.
- A clear/apply filter workflow.
- Sort options for bestseller, popularity, newest, ascending/descending price, and discount.
- Product cards with multi-image cues and sale pricing.
- Load-more/pagination and mobile filter/sort affordances.

## Existing Auraluxe implementation inventory

The current repository already has substantial foundations; redesign should extend rather than replace them:
- `src/components/site/Header.tsx`: announcement strip, sticky header, mega menu, search, account and bag actions, mobile navigation.
- `src/components/site/HeroCarousel.tsx`: responsive campaign carousel with admin-managed banners, autoplay pause, reduced-motion handling.
- `src/routes/index.tsx`: server-prefetched home data, hero, category tiles, new arrivals, promotional banner, trending, best sellers, offers, testimonials and social/footer content.
- `src/routes/shop.index.tsx`: category discovery, search, category/size/colour/fabric/stock/price filtering, sort and infinite loading.
- `src/components/site/ProductCard.tsx`: product image, new/bestseller/sale/out-of-stock badges, sale price, option selection and add-to-bag.
- `src/routes/shop.product.$slug.tsx`: product detail, image gallery, size/colour/variant stock, zoom, related products, add-to-cart.
- `src/lib/data.ts`: Supabase-backed products/categories/banners and default store settings.
- `src/lib/store.tsx`: cart and money formatting.
- `src/styles.css`: Auraluxe's ivory/burgundy editorial storefront styling.

## Verified production data observations
- Supabase production project: `jsshaoucrjorbyuzagdr` (ACTIVE_HEALTHY).
- Public schema tables have RLS enabled.
- Current categories: Kurtis, Co-ord Sets, Suits, Dresses, Party Wear, New Arrivals, Sale, Seasonal Collections.
- Current category join query returned zero published products per category. This needs investigation: products may have null/mismatched category_id values, or publication flags/category assignments need reconciliation before redesign sections depend on them.
- Currency setting was `Rs.`; changed to `NPR` for the requested Nepal-market display. The application default is updated on this branch too.

## Auraluxe adaptation

### Homepage
1. Announcement strip with Nepal delivery/offer messaging.
2. Sticky responsive header with search, account, wishlist and bag.
3. Desktop mega menu and mobile accordion navigation, grouped by real Auraluxe categories.
4. Original studio campaign hero with separate desktop/mobile crops and clear CTA.
5. Category tiles for Kurtis, Short Kurtis, Kurti Sets, Dresses, Sarees, Bags, Juttis and Accessories, only showing categories enabled in the catalogue.
6. Editorial collection cards: New In, Everyday, Festive, Party Wear.
7. New arrivals, best sellers, trending and offers rails, with no duplicate products across sections.
8. Brand story/editorial campaign, customer reviews and service assurances.
9. Full footer with delivery, returns, contact, social and policy links.

### Category browsing
1. Breadcrumb, title, short intro, result count and active-filter chips.
2. Desktop faceted filter rail; mobile filter drawer with clear/apply actions.
3. Filters: NPR price range, size, colour, fabric, fit/occasion when actual product metadata exists, and stock.
4. Sort: newest, best sellers, popularity/featured, price ascending/descending, discount.
5. Product grid: 4 columns desktop, 3 tablet, 2 mobile; product cards show sale/regular price, available options, wishlist and quick add.
6. Stable URL search parameters, pagination/infinite loading, empty states and accessible controls.

## Data and content rules
- Never seed fake products, prices, stock, reviews, or category counts into production.
- Dummy studio/model assets may be used only as clearly editorial placeholder imagery, not represented as real product photos.
- All prices are NPR; do not perform INR conversion or infer exchange rates.
- Product and category content remains admin-editable through Supabase-backed existing CMS.
- Keep admin/POS and checkout behavior stable while changing storefront presentation.

## Rollout and acceptance checks
1. Fix/verify category-product relationships and published product data.
2. Implement homepage refinements in a feature branch.
3. Implement category listing refinements in the same branch.
4. Build, lint and run existing tests before merge.
5. Preview on mobile and desktop.
6. Verify homepage, category links, filters, sort, product detail, add-to-cart, cart and checkout.
7. Merge to main only after acceptance; production deployment is triggered by push to main.
