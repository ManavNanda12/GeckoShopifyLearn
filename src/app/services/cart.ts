import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';

export interface Money {
    amount: string;
    currencyCode: string;
}

export interface ShopifyCartLine {
    id: string;
    quantity: number;
    cost: {
        amountPerQuantity: Money; // unit price
        totalAmount: Money;       // unit price x quantity
    };
    merchandise: {
        id: string;
        title: string; // variant title, e.g. "Default Title" or "Ice"
        image: { url: string; altText: string | null } | null;
        product: {
            title: string;
            handle: string;
        };
    };
}

export interface ShopifyCart {
    id: string;
    checkoutUrl: string;
    totalQuantity: number;
    cost: {
        subtotalAmount: Money;
        totalAmount: Money;
    };
    lines: {
        edges: { node: ShopifyCartLine }[];
    };
}

// A completed cart, remembered for the order confirmation page
export interface LastOrder extends ShopifyCart {
    orderedAt: string;
}

interface GraphQLResponse<T> {
    data?: T;
    errors?: { message: string }[];
}

// Shape returned by every cart mutation (cartCreate, cartLinesAdd, ...)
interface CartMutationResult {
    cart: ShopifyCart | null;
    userErrors: { message: string }[];
}

// localStorage keys
const CART_ID_KEY = 'shopifyCartId';
const CART_SNAPSHOT_KEY = 'shopifyCartSnapshot';
const LAST_ORDER_KEY = 'shopifyLastOrder';

// Same cart fields are requested by every query/mutation
const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        cost {
          amountPerQuantity { amount currencyCode }
          totalAmount { amount currencyCode }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            image { url altText }
            product { title handle }
          }
        }
      }
    }
  }
`;


@Injectable({
    providedIn: 'root'
})

export class Cart {
    private endpoint =
        `https://${environment.shopifyStoreDomain}/api/2026-10/graphql.json`;

    // Reuse the same public token as your ShopifyService.
    private headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token':
            environment.shopifyStorefrontToken
    });

    // Current cart, shared with every component (navbar badge, cart page, ...)
    private cartSubject = new BehaviorSubject<ShopifyCart | null>(null);
    cart$ = this.cartSubject.asObservable();

    // Set by the Customer service when someone logs in, so new carts belong to them
    private customerAccessToken: string | null = null;

    constructor(private http: HttpClient) { }

    // ---------- Customer link ----------

    setCustomerAccessToken(token: string | null): void {
        this.customerAccessToken = token;
    }

    // Attach the current cart to the logged in customer.
    // Checkout then prefills their email/address and the order appears in their order history.
    linkCartToCustomer(): Observable<ShopifyCart | null> {
        const cartId = this.getSavedCartId();
        if (!cartId || !this.customerAccessToken) {
            return of(null);
        }

        return this.cartMutation('cartBuyerIdentityUpdate', `
          mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
            cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
              cart { ${CART_FIELDS} }
              userErrors { message }
            }
          }
        `, { cartId, buyerIdentity: { customerAccessToken: this.customerAccessToken } });
    }

    // Forget the current cart (used on logout so the next person starts fresh)
    resetCart(): void {
        this.clearSavedCart();
    }

    // ---------- Public cart actions ----------

    // Load the saved cart from Shopify (call once when the app starts).
    // If Shopify no longer returns it, checkout was completed (or it expired).
    refreshCart(): Observable<ShopifyCart | null> {
        const cartId = this.getSavedCartId();

        if (!cartId) {
            this.cartSubject.next(null);
            return of(null);
        }

        return this.getCart(cartId).pipe(
            tap(cart => {
                if (cart) {
                    this.setCart(cart);
                } else {
                    this.markCartAsOrdered();
                }
            })
        );
    }

    // Adds a variant: creates the cart on first add, otherwise adds to the existing one
    addToCart(variantId: string, quantity = 1): Observable<ShopifyCart> {
        const cartId = this.getSavedCartId();
        const lines = [{ merchandiseId: variantId, quantity }];

        if (!cartId) {
            return this.createCart(lines);
        }

        return this.cartMutation('cartLinesAdd', `
          mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
            cartLinesAdd(cartId: $cartId, lines: $lines) {
              cart { ${CART_FIELDS} }
              userErrors { message }
            }
          }
        `, { cartId, lines }).pipe(
            // Saved cart expired or was already checked out -> start a new one
            catchError(error => {
                console.warn('Could not add to saved cart, creating a new one:', error);
                this.clearSavedCart();
                return this.createCart(lines);
            })
        );
    }

    updateQuantity(lineId: string, quantity: number): Observable<ShopifyCart> {
        if (quantity < 1) {
            return this.removeLine(lineId);
        }

        return this.cartMutation('cartLinesUpdate', `
          mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
            cartLinesUpdate(cartId: $cartId, lines: $lines) {
              cart { ${CART_FIELDS} }
              userErrors { message }
            }
          }
        `, { cartId: this.getSavedCartId(), lines: [{ id: lineId, quantity }] });
    }

    removeLine(lineId: string): Observable<ShopifyCart> {
        return this.cartMutation('cartLinesRemove', `
          mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
            cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
              cart { ${CART_FIELDS} }
              userErrors { message }
            }
          }
        `, { cartId: this.getSavedCartId(), lineIds: [lineId] });
    }

    // Returns null when the cart no longer exists (checked out or expired)
    getCart(cartId: string): Observable<ShopifyCart | null> {
        return this.request<{ cart: ShopifyCart | null }>(`
          query GetCart($cartId: ID!) {
            cart(id: $cartId) { ${CART_FIELDS} }
          }
        `, { cartId }).pipe(
            map(data => data.cart)
        );
    }

    // ---------- Order helpers ----------

    getLastOrder(): LastOrder | null {
        const lastOrder = localStorage.getItem(LAST_ORDER_KEY);
        return lastOrder ? JSON.parse(lastOrder) : null;
    }

    getSavedCartId(): string | null {
        return localStorage.getItem(CART_ID_KEY);
    }

    // ---------- Private helpers ----------

    private createCart(lines: { merchandiseId: string; quantity: number }[]): Observable<ShopifyCart> {
        return this.cartMutation('cartCreate', `
          mutation CartCreate($input: CartInput!) {
            cartCreate(input: $input) {
              cart { ${CART_FIELDS} }
              userErrors { message }
            }
          }
        `, {
            input: {
                lines,
                // Logged in? Create the cart for that customer right away
                ...(this.customerAccessToken && {
                    buyerIdentity: { customerAccessToken: this.customerAccessToken }
                })
            }
        });
    }

    // Sends any GraphQL query and returns its "data", throwing on GraphQL errors
    private request<T>(query: string, variables: object): Observable<T> {
        return this.http
            .post<GraphQLResponse<T>>(this.endpoint, { query, variables }, { headers: this.headers })
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

    // Runs a cart mutation, checks userErrors, then saves + broadcasts the new cart
    private cartMutation(name: string, query: string, variables: object): Observable<ShopifyCart> {
        return this.request<Record<string, CartMutationResult>>(query, variables).pipe(
            map(data => {
                const result = data[name];

                if (result?.userErrors.length) {
                    throw new Error(result.userErrors.map(e => e.message).join(', '));
                }
                if (!result?.cart) {
                    throw new Error('Shopify did not return a cart.');
                }
                return result.cart;
            }),
            tap(cart => this.setCart(cart))
        );
    }

    // Save cart id + a copy of the cart (used by the order confirmation page) and notify components
    private setCart(cart: ShopifyCart): void {
        localStorage.setItem(CART_ID_KEY, cart.id);
        localStorage.setItem(CART_SNAPSHOT_KEY, JSON.stringify(cart));
        this.cartSubject.next(cart);
    }

    private clearSavedCart(): void {
        localStorage.removeItem(CART_ID_KEY);
        localStorage.removeItem(CART_SNAPSHOT_KEY);
        this.cartSubject.next(null);
    }

    // Checkout finished: keep the last cart copy as "last order" and start fresh
    private markCartAsOrdered(): void {
        const snapshot = localStorage.getItem(CART_SNAPSHOT_KEY);
        if (snapshot) {
            const order: LastOrder = { ...JSON.parse(snapshot), orderedAt: new Date().toISOString() };
            localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
        }
        this.clearSavedCart();
    }
}
