import { ShopifyOrder } from '../services/customer';

// Helpers for showing Shopify order statuses nicely

// "PARTIALLY_FULFILLED" -> "Partially fulfilled"
export function formatStatus(status: string | null): string {
  if (!status) return 'Unknown';
  const text = status.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Bootstrap badge colour for a financial or fulfillment status
export function statusBadgeClass(status: string | null): string {
  switch (status) {
    case 'PAID':
    case 'FULFILLED':
      return 'text-bg-success';
    case 'PENDING':
    case 'AUTHORIZED':
    case 'PARTIALLY_PAID':
    case 'PARTIALLY_FULFILLED':
    case 'IN_PROGRESS':
      return 'text-bg-warning';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
    case 'VOIDED':
      return 'text-bg-secondary';
    default:
      return 'bg-body-tertiary text-body border';
  }
}

export function orderItemCount(order: ShopifyOrder): number {
  return order.lineItems.edges.reduce((sum, edge) => sum + edge.node.quantity, 0);
}
