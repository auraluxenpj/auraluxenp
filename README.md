# Auraluxe Elegance Builder

Build a modern, premium, mobile-first e-commerce website for **AURALUXE**, a ladies' fashion brand based in Nepalgunj.

The website should look elegant, fashionable, trustworthy and premium, with a clean luxury-fashion aesthetic. It must work perfectly on mobile, tablet and desktop.

## BRAND

Brand name: AURALUXE

Business category: Women's Fashion / Ladies Wear

Location: Nepalgunj, Nepal

Use the Auraluxe logo wherever appropriate. Keep the overall design sophisticated and uncluttered.

## CUSTOMER WEBSITE

Create these pages:

1. HOME

* Large hero banner with fashion imagery
* "New Collection" section
* "Trending Now" section
* "Best Sellers" section
* "Special Offers" section
* Featured categories
* Promotional banners
* Customer testimonials
* Instagram/TikTok social section
* Newsletter/WhatsApp/contact CTA
* Footer with business information and social links

2. SHOP

* Product grid
* Search
* Categories
* Filters
* Sorting
* Price filter
* Size filter
* Colour filter
* Availability filter
* Pagination or infinite scroll

3. PRODUCT DETAILS
   Each product should have:

* Multiple product images
* Product name
* Price
* Discount price
* Available sizes
* Available colours
* Fabric/material
* Product description
* Stock availability
* SKU
* Size chart
* Related products
* Add to cart
* Buy now
* Wishlist

4. CATEGORIES
   Create editable categories such as:

* Kurtis
* Co-ord Sets
* Suits
* Dresses
* Party Wear
* New Arrivals
* Sale
* Seasonal Collections

Categories must be manageable from the admin panel.

5. ABOUT AURALUXE
   Include editable brand story, mission, business information and images.

6. CONTACT

* Contact form
* Phone/WhatsApp
* Email
* Store location
* Google Maps
* Social media links
* Business hours

7. CART

* Product quantity
* Remove item
* Price calculation
* Discount
* Shipping
* Grand total
* Checkout button

8. CHECKOUT
   Allow customers to enter:

* Name
* Phone
* Email
* Address
* City
* State/Province
* Country
* Postal code
* Delivery instructions

Support configurable payment methods and Cash on Delivery.

## ADMIN PANEL / BACKEND

Create a secure administrator dashboard at:

/admin

Admin login must be protected with authentication.

Dashboard should show:

* Total products
* Orders
* Sales
* Customers
* Low-stock products
* Recent orders
* Recent activity

## PRODUCT MANAGEMENT

Admin must be able to:

* Add products
* Edit products
* Delete products
* Duplicate products
* Publish/unpublish products
* Upload multiple product images
* Change product name
* Change price
* Change sale price
* Set stock quantity
* Set SKU
* Select category
* Add sizes
* Add colours
* Add fabric
* Edit description
* Add size chart
* Mark product as New Arrival
* Mark product as Best Seller
* Mark product as Featured
* Set product visibility

Image upload should support drag-and-drop and image preview.

## INVENTORY

Create inventory management with:

* Current stock
* Low-stock warning
* Out-of-stock status
* Stock adjustment
* Product SKU
* Variant-level stock where required

## ORDER MANAGEMENT

Admin should be able to:

* View orders
* Search orders
* Filter orders
* Open order details
* Change order status
* Print/download invoice
* View customer information
* View purchased products
* Add tracking number
* Update payment status
* Update delivery status

Order statuses:

Pending
Confirmed
Processing
Shipped
Delivered
Cancelled
Returned

## CONTENT MANAGEMENT SYSTEM

The admin should be able to edit the website without coding.

Create editable sections for:

* Homepage hero banners
* Promotional banners
* Homepage headings
* Homepage text
* Product categories
* Featured collections
* About Us
* Contact information
* Store address
* Phone number
* WhatsApp number
* Email
* Social media links
* Footer
* FAQ
* Shipping policy
* Return policy
* Privacy policy
* Terms and conditions

Every major website section should have an Edit button in the admin panel.

## BANNER MANAGEMENT

Admin can:

* Upload banner image
* Add title
* Add subtitle
* Add button text
* Add button link
* Set display order
* Enable/disable banner
* Schedule start/end date

## COUPONS & DISCOUNTS

Create a discount management system.

Admin can create:

* Percentage discount
* Fixed amount discount
* Product-specific discount
* Category-specific discount
* Minimum order discount
* Coupon code
* Start/end date
* Usage limit
* Active/inactive status

## CUSTOMER MANAGEMENT

Admin can:

* View customers
* Search customers
* View order history
* View contact details
* See total purchases

Do not expose customer data publicly.

## WEBSITE SETTINGS

Create a Settings section where the admin can change:

* Logo
* Favicon
* Brand name
* Phone
* WhatsApp
* Email
* Address
* Social media URLs
* Currency
* Shipping charges
* Free shipping threshold
* Tax settings
* Payment methods
* Store hours

## DATABASE

Use a proper relational database.

Create database tables/collections for:

* Users
* Admins
* Products
* Product variants
* Categories
* Inventory
* Orders
* Order items
* Customers
* Coupons
* Banners
* Pages
* Site settings
* Reviews
* Wishlist
* Cart

Use secure relationships and validation.

## IMAGE STORAGE

Product and banner images must be stored using proper cloud/object storage rather than embedding large images directly into the database.

Images should automatically be optimized for web performance.

## SECURITY

Implement:

* Secure admin authentication
* Password hashing
* Role-based access
* Protected admin routes
* Input validation
* Server-side validation
* Secure database access
* Protection against unauthorized admin access
* Secure checkout
* Protection of customer information

Never expose database credentials or API keys in frontend code.

## SEO

Implement:

* SEO-friendly URLs
* Editable page titles
* Editable meta descriptions
* Open Graph images
* Product structured data
* Sitemap
* Robots.txt
* Canonical URLs
* Alt text for images

Products should have URLs such as:

/shop/product/product-name

## PERFORMANCE

The website should:

* Load quickly
* Be mobile-first
* Optimize images automatically
* Lazy-load images
* Use responsive images
* Minimize unnecessary JavaScript
* Have excellent Core Web Vitals

## DESIGN

Design direction:

Premium
Minimal
Elegant
Modern
Fashion-forward
Clean
Luxury boutique

Use plenty of white/neutral space, high-quality fashion imagery, elegant typography and subtle animations.

Avoid an overly complicated design.

## MOBILE EXPERIENCE

The mobile version is extremely important because most customers will visit from phones.

Include:

* Mobile navigation
* Sticky cart button where appropriate
* Easy WhatsApp/contact access
* Large product images
* Simple checkout
* Touch-friendly buttons
* Fast-loading pages

## ADMIN USER EXPERIENCE

The admin dashboard must be simple enough for a non-technical business owner.

I should be able to log in and immediately:

1. Add a new product
2. Upload product photos
3. Change price
4. Change stock
5. Create a discount
6. Change homepage banner
7. Edit website text
8. Manage orders

Do not require me to edit source code for normal website management.

## IMPORTANT ARCHITECTURE REQUIREMENT

Build this as a real full-stack application, not just a static frontend mockup.

The frontend, backend API, authentication, database, image storage and admin dashboard must be connected and functional.

Use clean, scalable architecture so additional features can be added later.

Keep configuration such as payment gateway, shipping provider, WhatsApp number, social media accounts and business information editable from the admin panel.

## FUTURE-READY FEATURES

Structure the system so these can be added later without rebuilding the entire website:

* Online payment gateway
* WhatsApp order notifications
* Email notifications
* SMS notifications
* Delivery/shipping integration
* Customer reviews
* Loyalty/reward points
* Abandoned-cart recovery
* Analytics
* Sales reports
* Multiple admin users
* Multiple store locations

## FINAL REQUIREMENT

Deliver a complete working Auraluxe website with:

1. Customer-facing website
2. Secure admin login
3. Admin dashboard
4. Product management
5. Inventory management
6. Order management
7. Customer management
8. Banner management
9. Content management
10. Coupon management
11. Website settings
12. Database
13. Image storage
14. Authentication
15. Responsive design
16. SEO setup

Most importantly, make the backend genuinely usable: when I add/edit/delete a product or change website content from the admin panel, the changes must immediately appear on the live website.

Do not create fake buttons or placeholder admin functionality. All core CRUD operations must be connected to the database and actually work.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://auraluxenp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d3410baf-f573-4bc0-9b7e-3cc794aefc2c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
