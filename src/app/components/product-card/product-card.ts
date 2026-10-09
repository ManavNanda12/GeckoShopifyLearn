import { Component, Input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShopifyImage, ShopifyProduct } from '../../services/shopify';
import {
  getAllImages, hasOnlyDefaultVariant, isSoldOut, productDiscount, toNumber
} from '../../utils/product-utils';

// Reusable product card: used on Home, Products and "You may also like"
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ShopifyProduct;

  toNumber = toNumber;

  get images(): ShopifyImage[] {
    return getAllImages(this.product);
  }

  // Second image is shown when hovering the card (if the product has one)
  get hoverImage(): ShopifyImage | undefined {
    return this.images[1];
  }

  get soldOut(): boolean {
    return isSoldOut(this.product);
  }

  get discount(): number {
    return productDiscount(this.product);
  }

  // Show "From" when variants have different prices
  get hasPriceRange(): boolean {
    return this.product.priceRange.minVariantPrice.amount !== this.product.priceRange.maxVariantPrice.amount;
  }

  // e.g. "5 Colors" for products with real options
  get optionSummary(): string {
    if (hasOnlyDefaultVariant(this.product)) {
      return '';
    }
    const option = this.product.options[0];
    const count = option.optionValues.length;
    return `${count} ${option.name.toLowerCase()}${count > 1 && !option.name.endsWith('s') ? 's' : ''}`;
  }
}
