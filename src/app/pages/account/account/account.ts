import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Customer, ShopifyCustomer, ShopifyOrder } from '../../../services/customer';
import { formatStatus, orderItemCount, statusBadgeClass } from '../../../utils/order-utils';
import { toNumber } from '../../../utils/product-utils';

@Component({
  selector: 'app-account',
  imports: [RouterLink, AsyncPipe, CurrencyPipe, DatePipe],
  templateUrl: './account.html',
  styleUrl: './account.css'
})
export class AccountComponent implements OnInit {
  customer$: Observable<ShopifyCustomer | null>;
  orders: ShopifyOrder[] = [];
  isLoadingOrders = true;
  errorMessage = '';

  // Template helpers
  toNumber = toNumber;
  formatStatus = formatStatus;
  statusBadgeClass = statusBadgeClass;
  orderItemCount = orderItemCount;

  constructor(
    private customerService: Customer,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.customer$ = this.customerService.customer$;
  }

  ngOnInit(): void {
    this.customerService.getOrders().subscribe({
      next: orders => {
        this.orders = orders;
        this.isLoadingOrders = false;
        // App is zoneless, so tell Angular to refresh the view after async data arrives
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Orders error:', error);
        this.errorMessage = 'Could not load your orders.';
        this.isLoadingOrders = false;
        this.cdr.markForCheck();
      }
    });
  }

  get totalSpent(): number {
    return this.orders.reduce((sum, order) => sum + toNumber(order.currentTotalPrice.amount), 0);
  }

  get currencyCode(): string {
    return this.orders[0]?.currentTotalPrice.currencyCode ?? 'USD';
  }

  // First 3 product photos of an order, shown as small thumbnails
  orderImages(order: ShopifyOrder): string[] {
    return order.lineItems.edges
      .map(edge => edge.node.variant?.image?.url)
      .filter((url): url is string => !!url)
      .slice(0, 3);
  }

  logout(): void {
    this.customerService.logout();
    this.router.navigateByUrl('/home');
  }
}
