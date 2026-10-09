# 🦎 Gecko Store: a headless Shopify storefront in Angular

A **learning project** for building a custom storefront on top of Shopify. The Angular app replaces the Shopify theme: it reads products and manages the cart through the [Shopify Storefront API](https://shopify.dev/docs/api/storefront) (GraphQL), and Shopify still handles checkout and payment.

> Built to learn how headless Shopify works, from fetching products to completing a test order, using plain Angular concepts (components, services, RxJS, routing) and no state-management libraries or signals.

![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)
![Shopify](https://img.shields.io/badge/Shopify-Storefront%20API-7AB55C?logo=shopify&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)

---

## ✨ Features

| Page | What it does |
|---|---|
| **Home** | Hero banner, perks, "Shop by category" tiles, featured products and an "On sale" section |
| **Products** | Live products from Shopify with search, category chips, in-stock / sold-out filter and sorting |
| **Product detail** | Image gallery (hover zoom, thumbnails, full-size modal), variant options with photo swatches, sale price and % off, stock status, details accordion, Shopify recommendations |
| **Cart** | Change quantities, remove items, subtotal and total, checkout via Shopify |
| **Order confirmation** | Detects a completed checkout and shows the order summary |

Also included:
- 🛒 A live cart badge in the navbar, shared across all pages
- 📱 A responsive layout using the Bootstrap `row` / `col` grid
- ⚡ Lazy-loaded routes (`loadComponent`)
- 🎨 A logo made entirely in CSS (no image files)

---

## 🧱 Tech stack

- **Angular 22**: standalone components, zoneless change detection, built-in control flow (`@if`, `@for`, `@switch`)
- **RxJS**: `BehaviorSubject` to share cart state, `async` pipe in templates
- **Bootstrap 5**: layout and UI components (navbar, accordion, modal)
- **Shopify Storefront API** (`2026-10`): GraphQL over `HttpClient`
- **Vitest**: unit tests

---

## 🏗️ How it works

```
┌──────────────────────┐   GraphQL (Storefront API)   ┌──────────────────────┐
│   Angular app        │ ───────────────────────────▶ │   Shopify            │
│   localhost:4200     │   products, cart mutations   │   (headless backend) │
│                      │ ◀─────────────────────────── │                      │
└──────────┬───────────┘                              └──────────┬───────────┘
           │  "Checkout" → cart.checkoutUrl                      │
           └────────────────────────────────────────────────────▶│ Shopify-hosted checkout
                                                                 │ (payment, thank-you page)
           ┌─────────────────────────────────────────────────────┘
           │  theme.liquid redirect → /order-confirmation
           ▼
     Angular order confirmation page
```

### Services

**`services/shopify.ts`**: product data
- `getProducts()`: all products for listing and home
- `getProductByHandle(handle)`: a single product for the detail page
- `getRecommendations(handle)`: Shopify's "related products"

**`services/cart.ts`**: all cart logic lives here; pages only call its methods
- `cart$`: the current cart as an observable, shared by the navbar badge, cart page and others
- `addToCart(variantId, qty)`: creates a cart on the first add (`cartCreate`), then adds to it (`cartLinesAdd`). If the saved cart has expired, it starts a new one.
- `updateQuantity()` / `removeLine()`: `cartLinesUpdate` / `cartLinesRemove`
- `refreshCart()`: reloads the saved cart when the app starts
- The cart ID is kept in `localStorage`, so the cart survives page reloads

### Detecting a completed order

The Storefront API **can't read orders without a customer login**, so the app infers it:
1. Each cart change saves a copy of the cart in `localStorage`.
2. After checkout, Shopify no longer returns that cart (`cart(id)` → `null`).
3. The app then treats the saved copy as the "last order" and shows it on `/order-confirmation`.

---

## 📁 Project structure

```
src/
├── environments/
│   └── environment.ts          # Shopify store domain + Storefront token
└── app/
    ├── app.ts / app.html       # Navbar (CSS logo, cart badge), footer
    ├── app.routes.ts           # Lazy-loaded routes
    ├── app.config.ts           # Router, HttpClient, scroll-to-top
    ├── components/
    │   └── product-card/       # Reusable product card (@Input product)
    ├── pages/
    │   ├── home/
    │   ├── product/            # Product listing
    │   ├── product-detail/
    │   ├── cart/
    │   └── order-confirmation/
    ├── services/
    │   ├── shopify.ts          # Product queries
    │   └── cart.ts             # Cart state + mutations
    └── utils/
        └── product-utils.ts    # isSoldOut, getAllImages, discountPercent, ...
```

### Routes

| Path | Page |
|---|---|
| `/home` | Home |
| `/products` | Product listing (supports `?type=snowboard`) |
| `/products/:handle` | Product detail |
| `/cart` | Cart |
| `/order-confirmation` | Order confirmation |

---

## 🚀 Getting started

### 1. Prerequisites
- Node.js 22+
- A Shopify **development store**, created from the [Shopify Partners dashboard](https://partners.shopify.com/)

### 2. Get a Storefront API token
1. In Shopify admin, go to **Settings → Apps and sales channels → Develop apps**.
2. Create an app and configure its **Storefront API** access scopes:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_tags`
   - `unauthenticated_write_checkouts` / `unauthenticated_read_checkouts` (needed for the cart)
3. Install the app and copy the **Storefront API access token**.

### 3. Configure the app
Edit `src/environments/environment.ts`:

```ts
export const environment = {
  shopifyStoreDomain: 'your-store.myshopify.com',
  shopifyStorefrontToken: 'your-storefront-access-token'
};
```

### 4. Install and run

```bash
npm install --legacy-peer-deps
npm start
```

Open http://localhost:4200.

> **Why `--legacy-peer-deps`?** npm 10 can crash with `Cannot read properties of null (reading 'edgesOut')` while resolving Vitest's peer dependencies. The flag works around this npm bug; the dependency versions themselves are compatible.

### Scripts

| Command | Description |
|---|---|
| `npm start` | Dev server on port 4200 |
| `npm run build` | Production build to `dist/` |
| `npm test` | Unit tests (Vitest) |

---

## 🛍️ Testing the full checkout flow

### Unlock the store first
Development stores are password-protected. If you click Checkout before unlocking, Shopify sends you to the password page, loses the cart link, and the cart looks empty.

**Fix:** open `https://your-store.myshopify.com/password` once in the same browser, then check out.

### Test payments
In Shopify admin, go to **Settings → Payments** and activate **(for testing) Bogus Gateway**.

| Field | Value |
|---|---|
| Card number | `1` = success, `2` = failure, `3` = error |
| Name | `Bogus Gateway` |
| Expiry / CVV | Any future date / any 3 digits |

Alternatively, enable **test mode** in Shopify Payments and use `4242 4242 4242 4242`.

### Redirect back to the Angular app after checkout
Checkout always runs on Shopify's own pages. To send shoppers back to the Angular app, add this as the first thing inside `<head>` in the theme's `layout/theme.liquid` (**Online Store → Themes → Edit code**):

```html
<script>
  (function () {
    var appUrl = 'http://localhost:4200';
    var path = window.location.pathname;
    var target;

    if (document.referrer.indexOf('/checkouts/') !== -1) {
      target = '/order-confirmation';   // came from Shopify checkout / thank-you page
    } else if (path.indexOf('/products/') === 0) {
      target = path;                    // same product URLs as the Angular app
    } else {
      target = '/home';
    }

    window.location.replace(appUrl + target);
  })();
</script>
```

This doesn't affect checkout or the password page, which don't use `theme.liquid`. Change `appUrl` when you deploy.

---

## 📚 What I learned

- **Headless commerce:** Shopify as a backend, with your own front end and Shopify still handling checkout and payments
- **GraphQL with Shopify:** queries, mutations, `edges` / `node` pagination, image transforms (`url(transform: { maxWidth: 600 })`) and `userErrors` handling
- **Cart lifecycle:** create → add → update / remove → checkout URL → completed cart returns `null`
- **Product data model:** products → variants → `selectedOptions`, `compareAtPrice` for sales, `availableForSale` for stock
- **Zoneless Angular:** plain properties set inside `subscribe()` need `ChangeDetectorRef.markForCheck()`, while the `async` pipe handles this automatically
- **Sharing state with RxJS:** a `BehaviorSubject` in a service keeps the navbar badge, cart page and product page in sync
- **Shopify store setup:** Storefront API scopes, password-protected dev stores, test payment gateways, theme redirects

---

## ⚠️ Known limitations

- **No order number or order history.** These need customer accounts (the Customer Account API).
- **Expired carts look like completed orders.** Shopify returns `null` for both, and carts expire after about 10 days.
- **No "only N left" stock counts.** That needs the `unauthenticated_read_product_inventory` scope.
- **Placeholder text.** Shipping and return wording on product pages is example text.
- **The theme redirect points to `localhost`.** It only works on your own machine until you deploy and update `appUrl`.

---

## 📄 License

This is a personal learning project, free to use as a reference.
