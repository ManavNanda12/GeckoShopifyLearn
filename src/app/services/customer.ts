import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Cart } from './cart';

export interface Money {
    amount: string;
    currencyCode: string;
}

export interface ShopifyCustomer {
    id: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    email: string;
    phone: string | null;
    createdAt: string;
    defaultAddress: { formatted: string[] } | null;
}

export interface ShopifyOrderLineItem {
    title: string;
    quantity: number;
    originalTotalPrice: Money;
    variant: {
        title: string;
        image: { url: string; altText: string | null } | null;
        product: { handle: string };
    } | null; // null if the product was deleted
}

export interface ShopifyOrder {
    id: string;
    name: string;        // e.g. "#1001"
    orderNumber: number; // e.g. 1001
    processedAt: string;
    financialStatus: string | null;   // PAID, PENDING, REFUNDED, ...
    fulfillmentStatus: string;        // UNFULFILLED, FULFILLED, ...
    statusUrl: string;                // Shopify's order status page
    currentTotalPrice: Money;
    subtotalPrice: Money | null;
    totalShippingPrice: Money;
    totalTax: Money | null;
    shippingAddress: { formatted: string[] } | null;
    lineItems: {
        edges: { node: ShopifyOrderLineItem }[];
    };
}

interface CustomerToken {
    accessToken: string;
    expiresAt: string;
}

interface GraphQLResponse<T> {
    data?: T;
    errors?: { message: string }[];
}

interface CustomerUserError {
    code: string | null;
    message: string;
}

// localStorage key
const CUSTOMER_TOKEN_KEY = 'shopifyCustomerToken';

const CUSTOMER_FIELDS = `
  id
  firstName
  lastName
  displayName
  email
  phone
  createdAt
  defaultAddress { formatted }
`;

const ORDER_FIELDS = `
  id
  name
  orderNumber
  processedAt
  financialStatus
  fulfillmentStatus
  statusUrl
  currentTotalPrice { amount currencyCode }
  subtotalPrice { amount currencyCode }
  totalShippingPrice { amount currencyCode }
  totalTax { amount currencyCode }
  shippingAddress { formatted }
  lineItems(first: 50) {
    edges {
      node {
        title
        quantity
        originalTotalPrice { amount currencyCode }
        variant {
          title
          image { url altText }
          product { handle }
        }
      }
    }
  }
`;


@Injectable({
    providedIn: 'root'
})

export class Customer {
    private endpoint =
        `https://${environment.shopifyStoreDomain}/api/2026-10/graphql.json`;

    private headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': environment.shopifyStorefrontToken
    });

    // Logged in customer, shared with every component (navbar, account page, ...)
    private customerSubject = new BehaviorSubject<ShopifyCustomer | null>(null);
    customer$ = this.customerSubject.asObservable();

    constructor(
        private http: HttpClient,
        private cartService: Cart
    ) { }

    // ---------- Auth ----------

    get isLoggedIn(): boolean {
        return !!this.getValidToken();
    }

    // Load the customer for a saved token (call once when the app starts)
    restoreSession(): Observable<ShopifyCustomer | null> {
        const token = this.getValidToken();
        if (!token) {
            this.clearSession();
            return of(null);
        }
        this.cartService.setCustomerAccessToken(token);
        return this.loadCustomer();
    }

    login(email: string, password: string): Observable<ShopifyCustomer | null> {
        return this.request<{
            customerAccessTokenCreate: {
                customerAccessToken: CustomerToken | null;
                customerUserErrors: CustomerUserError[];
            };
        }>(`
          mutation Login($input: CustomerAccessTokenCreateInput!) {
            customerAccessTokenCreate(input: $input) {
              customerAccessToken { accessToken expiresAt }
              customerUserErrors { code message }
            }
          }
        `, { input: { email, password } }).pipe(
            map(data => {
                const result = data.customerAccessTokenCreate;
                if (result.customerUserErrors.some(e => e.code === 'UNIDENTIFIED_CUSTOMER')) {
                    throw new Error('Incorrect email or password.');
                }
                this.throwIfUserErrors(result.customerUserErrors);
                if (!result.customerAccessToken) {
                    throw new Error('Incorrect email or password.');
                }
                return result.customerAccessToken;
            }),
            tap(token => {
                localStorage.setItem(CUSTOMER_TOKEN_KEY, JSON.stringify(token));
                // Link the cart to this customer so checkout is prefilled + order shows in history
                this.cartService.setCustomerAccessToken(token.accessToken);
            }),
            switchMap(() => this.loadCustomer()),
            // Attach any existing cart to the customer (a failure here shouldn't block login)
            switchMap(customer => this.cartService.linkCartToCustomer().pipe(
                catchError(error => {
                    console.warn('Could not link cart to customer:', error);
                    return of(null);
                }),
                map(() => customer)
            ))
        );
    }

    // Creates the account, then logs in straight away
    register(firstName: string, lastName: string, email: string, password: string, acceptsMarketing: boolean):
        Observable<ShopifyCustomer | null> {
        return this.request<{
            customerCreate: { customerUserErrors: CustomerUserError[] };
        }>(`
          mutation Register($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              customer { id }
              customerUserErrors { code message }
            }
          }
        `, { input: { firstName, lastName, email, password, acceptsMarketing } }).pipe(
            tap(data => this.throwIfUserErrors(data.customerCreate.customerUserErrors)),
            switchMap(() => this.login(email, password))
        );
    }

    // Shopify emails the customer a reset-password link
    recoverPassword(email: string): Observable<void> {
        return this.request<{
            customerRecover: { customerUserErrors: CustomerUserError[] };
        }>(`
          mutation Recover($email: String!) {
            customerRecover(email: $email) {
              customerUserErrors { code message }
            }
          }
        `, { email }).pipe(
            map(data => {
                // Don't reveal whether an email has an account: treat "not found" as success
                const errors = data.customerRecover.customerUserErrors
                    .filter(e => e.code !== 'UNIDENTIFIED_CUSTOMER');
                this.throwIfUserErrors(errors);
            })
        );
    }

    logout(): void {
        const token = this.getValidToken();
        if (token) {
            // Invalidate the token on Shopify too (fire and forget)
            this.request(`
              mutation Logout($token: String!) {
                customerAccessTokenDelete(customerAccessToken: $token) { deletedAccessToken }
              }
            `, { token }).subscribe({ error: () => { } });
        }
        this.clearSession();
        // The cart belonged to this customer, so the next visitor starts with an empty one
        this.cartService.resetCart();
    }

    // ---------- Customer data ----------

    getOrders(): Observable<ShopifyOrder[]> {
        const token = this.getValidToken();
        if (!token) {
            return of([]);
        }

        return this.request<{ customer: { orders: { edges: { node: ShopifyOrder }[] } } | null }>(`
          query GetOrders($token: String!) {
            customer(customerAccessToken: $token) {
              orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
                edges { node { ${ORDER_FIELDS} } }
              }
            }
          }
        `, { token }).pipe(
            map(data => data.customer?.orders.edges.map(edge => edge.node) ?? [])
        );
    }

    // Single order by its number, e.g. 1001 (null if it isn't this customer's order)
    getOrder(orderNumber: number): Observable<ShopifyOrder | null> {
        return this.getOrders().pipe(
            map(orders => orders.find(o => o.orderNumber === orderNumber) ?? null)
        );
    }

    // ---------- Private helpers ----------

    private loadCustomer(): Observable<ShopifyCustomer | null> {
        const token = this.getValidToken();
        if (!token) {
            return of(null);
        }

        return this.request<{ customer: ShopifyCustomer | null }>(`
          query GetCustomer($token: String!) {
            customer(customerAccessToken: $token) { ${CUSTOMER_FIELDS} }
          }
        `, { token }).pipe(
            map(data => data.customer),
            tap(customer => {
                if (customer) {
                    this.customerSubject.next(customer);
                } else {
                    // Token no longer valid on Shopify
                    this.clearSession();
                }
            })
        );
    }

    // Saved token, or null if missing/expired
    private getValidToken(): string | null {
        const saved = localStorage.getItem(CUSTOMER_TOKEN_KEY);
        if (!saved) {
            return null;
        }
        const token: CustomerToken = JSON.parse(saved);
        return new Date(token.expiresAt) > new Date() ? token.accessToken : null;
    }

    private clearSession(): void {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        this.cartService.setCustomerAccessToken(null);
        this.customerSubject.next(null);
    }

    private throwIfUserErrors(errors: CustomerUserError[]): void {
        if (errors.length) {
            throw new Error(errors.map(e => e.message).join(' '));
        }
    }

    // Sends a GraphQL query and returns its "data", throwing on GraphQL errors
    private request<T>(query: string, variables: object = {}): Observable<T> {
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
}
