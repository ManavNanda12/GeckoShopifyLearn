import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Customer, ShopifyOrder, ShopifyOrderLineItem } from '../../../services/customer';
import { formatStatus, orderItemCount, statusBadgeClass } from '../../../utils/order-utils';
import { toNumber } from '../../../utils/product-utils';

@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css'
})
export class OrderDetailComponent implements OnInit {
  order: ShopifyOrder | null = null;
  isLoading = true;
  errorMessage = '';

  // Template helpers
  toNumber = toNumber;
  formatStatus = formatStatus;
  statusBadgeClass = statusBadgeClass;
  orderItemCount = orderItemCount;

  constructor(
    private route: ActivatedRoute,
    private customerService: Customer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // URL looks like /account/orders/1001
    const orderNumber = Number(this.route.snapshot.paramMap.get('orderNumber'));

    this.customerService.getOrder(orderNumber).subscribe({
      next: order => {
        this.order = order;
        this.isLoading = false;
        // App is zoneless, so tell Angular to refresh the view after async data arrives
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Order error:', error);
        this.errorMessage = 'Could not load this order.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get lines(): ShopifyOrderLineItem[] {
    return this.order?.lineItems.edges.map(edge => edge.node) ?? [];
  }

  // Simple progress tracker: Placed -> Paid -> Shipped
  get steps(): { label: string; done: boolean }[] {
    const paid = this.order?.financialStatus === 'PAID' || this.order?.financialStatus === 'PARTIALLY_REFUNDED';
    const shipped = this.order?.fulfillmentStatus === 'FULFILLED';
    return [
      { label: 'Placed', done: true },
      { label: 'Paid', done: paid },
      { label: 'Shipped', done: shipped }
    ];
  }
}
