import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Money {
    amount: string;
    currencyCode: string;
}

export interface ShopifyImage {
    url: string;      // full size
    thumbUrl: string; // resized by Shopify CDN (max 600px wide) for cards/thumbnails
    altText: string | null;
}

export interface ShopifyVariant {
    id: string;
    title: string;
    availableForSale: boolean;
    price: Money;
    compareAtPrice: Money | null; // original price when on sale
    image: ShopifyImage | null;
    selectedOptions: { name: string; value: string }[]; // e.g. [{ name: 'Color', value: 'Ice' }]
}

export interface ShopifyProduct {
    id: string;
    title: string;
    handle: string;
    description: string;
    descriptionHtml: string;
    vendor: string;
    productType: string;
    tags: string[];
    featuredImage: ShopifyImage | null;
    images: {
        edges: { node: ShopifyImage }[];
    };
    options: {
        name: string;
        optionValues: { name: string }[];
    }[];
    priceRange: {
        minVariantPrice: Money;
        maxVariantPrice: Money;
    };
    compareAtPriceRange: {
        maxVariantPrice: Money;
    };
    variants: {
        edges: {
            node: ShopifyVariant;
        }[];
    };
}

interface ShopifyResponse<T> {
    data?: T;
    errors?: { message: string }[];
}

// Image fields used everywhere (thumbUrl is a resized copy from Shopify's CDN)
const IMAGE_FIELDS = `
  url
  thumbUrl: url(transform: { maxWidth: 600 })
  altText
`;

// Same product fields for list, detail and recommendations
const PRODUCT_FIELDS = `
  id
  title
  handle
  description
  descriptionHtml
  vendor
  productType
  tags
  featuredImage { ${IMAGE_FIELDS} }
  images(first: 10) {
    edges { node { ${IMAGE_FIELDS} } }
  }
  options {
    name
    optionValues { name }
  }
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  compareAtPriceRange {
    maxVariantPrice { amount currencyCode }
  }
  variants(first: 50) {
    edges {
      node {
        id
        title
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        image { ${IMAGE_FIELDS} }
        selectedOptions { name value }
      }
    }
  }
`;


@Injectable({
    providedIn: 'root'
})

export class Shopify {

    private endpoint =
        `https://${environment.shopifyStoreDomain}/api/2026-10/graphql.json`;

    private headers = {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': environment.shopifyStorefrontToken
    };

    constructor(private http: HttpClient) { }

    getProducts(): Observable<ShopifyProduct[]> {
        return this.request<{ products: { edges: { node: ShopifyProduct }[] } }>(`
          query {
            products(first: 50) {
              edges { node { ${PRODUCT_FIELDS} } }
            }
          }
        `).pipe(
            map(data => data.products.edges.map(edge => edge.node))
        );
    }

    // Single product by its URL handle, e.g. "the-complete-snowboard" (null if not found)
    getProductByHandle(handle: string): Observable<ShopifyProduct | null> {
        return this.request<{ product: ShopifyProduct | null }>(`
          query GetProduct($handle: String!) {
            product(handle: $handle) { ${PRODUCT_FIELDS} }
          }
        `, { handle }).pipe(
            map(data => data.product)
        );
    }

    // Shopify's built-in "related products" for a product
    getRecommendations(handle: string): Observable<ShopifyProduct[]> {
        return this.request<{ productRecommendations: ShopifyProduct[] | null }>(`
          query GetRecommendations($handle: String!) {
            productRecommendations(productHandle: $handle) { ${PRODUCT_FIELDS} }
          }
        `, { handle }).pipe(
            map(data => data.productRecommendations ?? [])
        );
    }

    // Sends a GraphQL query and returns its "data", throwing on GraphQL errors
    private request<T>(query: string, variables: object = {}): Observable<T> {
        return this.http
            .post<ShopifyResponse<T>>(this.endpoint, { query, variables }, { headers: this.headers })
            .pipe(
                map(response => {
                    if (response.errors?.length) {
                        throw new Error(response.errors.map(e => e.message).join(', '));
                    }
                    if (!response.data) {
                        throw new Error('Shopify returned no data.');
                    }
                    return response.data;
                })
            );
    }
}
