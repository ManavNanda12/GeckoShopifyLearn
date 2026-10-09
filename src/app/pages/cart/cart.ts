import { ChangeDetectorRef, Component } from '@angular/core';
import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Cart, ShopifyCart, ShopifyCartLine } from '../../services/cart';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, CurrencyPipe, AsyncPipe],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class CartComponent {
  // Live cart from the service; the async pipe in the template subscribes/unsubscribes for us
  cart$: Observable<ShopifyCart | null>;

  // Line currently being updated/removed (to disable its buttons + show spinner)
  busyLineId = '';
  errorMessage = '';

  constructor(
    private cartService: Cart,
    private cdr: ChangeDetectorRef
  ) {
    this.cart$ = this.cartService.cart$;
  }

  getLines(cart: ShopifyCart): ShopifyCartLine[] {
    return cart.lines.edges.map(edge => edge.node);
  }

  increase(line: ShopifyCartLine): void {
    this.changeQuantity(line, line.quantity + 1);
  }

  decrease(line: ShopifyCartLine): void {
    // Going below 1 removes the item
    this.changeQuantity(line, line.quantity - 1);
  }

  remove(line: ShopifyCartLine): void {
    this.runLineAction(line, this.cartService.removeLine(line.id));
  }

  private changeQuantity(line: ShopifyCartLine, quantity: number): void {
    this.runLineAction(line, this.cartService.updateQuantity(line.id, quantity));
  }

  // Shared busy/error handling for update + remove
  private runLineAction(line: ShopifyCartLine, action: Observable<ShopifyCart>): void {
    this.busyLineId = line.id;
    this.errorMessage = '';

    action.subscribe({
      next: () => {
        // cart$ updates automatically from the service
        this.busyLineId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Shopify cart error:', error);
        this.errorMessage = 'Could not update your cart. Please try again.';
        this.busyLineId = '';
        this.cdr.markForCheck();
      }
    });
  }

  // Shopify sends amount as a string, e.g. "949.95"
  toNumber(amount: string): number {
    return Number(amount);
  }
}
