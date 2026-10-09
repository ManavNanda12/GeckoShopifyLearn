import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Cart, LastOrder, ShopifyCart, ShopifyCartLine } from '../../services/cart';

// completed = checkout done, pending = cart still open, none = nothing to show
type OrderState = 'loading' | 'completed' | 'pending' | 'none' | 'error';

@Component({
  selector: 'app-order-confirmation',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './order-confirmation.html',
  styleUrl: './order-confirmation.css'
})
export class OrderConfirmationComponent implements OnInit {
  state: OrderState = 'loading';
  cart: ShopifyCart | LastOrder | null = null;
  orderedAt = '';

  constructor(
    private cartService: Cart,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // refreshCart() moves a checked-out cart to "last order" and clears it
    this.cartService.refreshCart().subscribe({
      next: cart => {
        if (cart && cart.totalQuantity > 0) {
          // Cart still exists -> checkout not finished yet
          this.cart = cart;
          this.state = 'pending';
        } else {
          const lastOrder = this.cartService.getLastOrder();
          this.cart = lastOrder;
          this.orderedAt = lastOrder?.orderedAt ?? '';
          this.state = lastOrder ? 'completed' : 'none';
        }
        // App is zoneless, so tell Angular to refresh the view after async data arrives
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Shopify cart error:', error);
        this.state = 'error';
        this.cdr.markForCheck();
      }
    });
  }

  get lines(): ShopifyCartLine[] {
    return this.cart?.lines.edges.map(edge => edge.node) ?? [];
  }

  // Shopify sends amount as a string, e.g. "949.95"
  toNumber(amount: string): number {
    return Number(amount);
  }
}
