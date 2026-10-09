import { ShopifyImage, ShopifyProduct, ShopifyVariant } from '../services/shopify';

// Small helper functions shared by product card, listing and detail pages

// Shopify sends amounts as strings, e.g. "949.95"
export function toNumber(amount: string | undefined | null): number {
  return Number(amount ?? 0);
}

export function getVariants(product: ShopifyProduct): ShopifyVariant[] {
  return product.variants.edges.map(edge => edge.node);
}

// A product is sold out when none of its variants can be bought
export function isSoldOut(product: ShopifyProduct): boolean {
  return !getVariants(product).some(v => v.availableForSale);
}

// Product images + variant images, without duplicates (variants often have their own photo)
export function getAllImages(product: ShopifyProduct): ShopifyImage[] {
  const images: ShopifyImage[] = [];
  const seen = new Set<string>();

  const add = (image: ShopifyImage | null) => {
    if (!image) return;
    const key = image.url.split('?')[0]; // ignore ?v=... version param
    if (!seen.has(key)) {
      seen.add(key);
      images.push(image);
    }
  };

  add(product.featuredImage);
  product.images.edges.forEach(edge => add(edge.node));
  getVariants(product).forEach(v => add(v.image));
  return images;
}

// Percentage saved, e.g. price 785.95 vs compareAt 885.95 -> 11
export function discountPercent(price: string, compareAt: string | undefined | null): number {
  const p = toNumber(price);
  const c = toNumber(compareAt);
  return c > p ? Math.round(((c - p) / c) * 100) : 0;
}

// Biggest discount across the product's variants (for the "Sale" badge on cards)
export function productDiscount(product: ShopifyProduct): number {
  return Math.max(0, ...getVariants(product).map(v => discountPercent(v.price.amount, v.compareAtPrice?.amount)));
}

// True when the product only has Shopify's placeholder "Default Title" variant
export function hasOnlyDefaultVariant(product: ShopifyProduct): boolean {
  const variants = getVariants(product);
  return variants.length === 1 && variants[0].title === 'Default Title';
}
