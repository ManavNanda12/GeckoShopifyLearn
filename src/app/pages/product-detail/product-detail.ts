import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Shopify, ShopifyImage, ShopifyProduct, ShopifyVariant } from '../../services/shopify';
import { Cart, ShopifyCart } from '../../services/cart';
import { ProductCardComponent } from '../../components/product-card/product-card';
import {
  discountPercent, getAllImages, getVariants, hasOnlyDefaultVariant, toNumber
} from '../../utils/product-utils';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, CurrencyPipe, ProductCardComponent],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css'
})
export class ProductDetailComponent implements OnInit {
  product: ShopifyProduct | null = null;
  variants: ShopifyVariant[] = [];
  selectedVariant: ShopifyVariant | undefined;
  selectedOptions: Record<string, string> = {}; // e.g. { Color: 'Ice' }
  relatedProducts: ShopifyProduct[] = [];
  producthandle = '';
  isLoading = true;
  errorMessage = '';

  // Gallery
  images: ShopifyImage[] = [];
  activeImageIndex = 0;
  isZooming = false;
  zoomOrigin = 'center center';

  // Cart state
  quantity = 1;
  isAddingToCart = false;
  cart: ShopifyCart | undefined;
  cartMessage = '';
  cartError = '';

  toNumber = toNumber;

  constructor(
    private route: ActivatedRoute,
    private shopifyService: Shopify,
    private cartService: Cart,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe (not snapshot) so clicking a "You may also like" product reloads this page
    this.route.paramMap.subscribe(params => {
      this.producthandle = params.get('id') ?? '';
      this.loadProduct();
    });
  }

  private loadProduct(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cartMessage = '';
    this.cartError = '';
    this.quantity = 1;
    this.relatedProducts = [];

    this.shopifyService.getProductByHandle(this.producthandle).subscribe({
      next: product => {
        this.product = product;

        if (product) {
          this.images = getAllImages(product);
          this.variants = getVariants(product);
          // Pre-select the first variant that can be bought, otherwise the first one
          this.selectVariant(this.variants.find(v => v.availableForSale) ?? this.variants[0]);
          this.loadRelatedProducts();
        }

        this.isLoading = false;
        // App is zoneless, so tell Angular to refresh the view after async data arrives
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Shopify API error:', error);
        this.errorMessage = 'Could not load product from Shopify.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadRelatedProducts(): void {
    this.shopifyService.getRecommendations(this.producthandle).subscribe({
      next: products => {
        this.relatedProducts = products.slice(0, 4);
        this.cdr.markForCheck();
      },
      error: error => console.warn('Could not load recommendations:', error)
    });
  }

  // ---------- Variants & options ----------

  get hasRealVariants(): boolean {
    return !!this.product && !hasOnlyDefaultVariant(this.product);
  }

  selectVariant(variant: ShopifyVariant | undefined): void {
    if (!variant) return;
    this.selectedVariant = variant;
    this.cartMessage = '';
    this.cartError = '';

    // Keep option buttons in sync with the chosen variant
    this.selectedOptions = {};
    variant.selectedOptions.forEach(o => this.selectedOptions[o.name] = o.value);

    // Show the variant's own photo in the gallery
    if (variant.image) {
      const index = this.findImageIndex(variant.image);
      if (index >= 0) this.activeImageIndex = index;
    }
  }

  // Option button clicked, e.g. selectOption('Color', 'Ice')
  selectOption(name: string, value: string): void {
    const wanted = { ...this.selectedOptions, [name]: value };
    // Exact match for all selected options, otherwise any variant with this value
    const variant = this.variants.find(v => this.matches(v, wanted))
      ?? this.variants.find(v => v.selectedOptions.some(o => o.name === name && o.value === value));
    this.selectVariant(variant);
  }

  // Can this option value be bought together with the other selected options?
  isValueAvailable(name: string, value: string): boolean {
    const wanted = { ...this.selectedOptions, [name]: value };
    return this.variants.some(v => v.availableForSale && this.matches(v, wanted));
  }

  // Small image used as a swatch on option buttons (e.g. board colors)
  swatchImage(name: string, value: string): string | null {
    const variant = this.variants.find(v => v.selectedOptions.some(o => o.name === name && o.value === value));
    return variant?.image?.thumbUrl ?? null;
  }

  private matches(variant: ShopifyVariant, wanted: Record<string, string>): boolean {
    return variant.selectedOptions.every(o => wanted[o.name] === o.value);
  }

  // ---------- Price ----------

  get discount(): number {
    return this.selectedVariant
      ? discountPercent(this.selectedVariant.price.amount, this.selectedVariant.compareAtPrice?.amount)
      : 0;
  }

  get savings(): number {
    if (!this.selectedVariant?.compareAtPrice) return 0;
    return toNumber(this.selectedVariant.compareAtPrice.amount) - toNumber(this.selectedVariant.price.amount);
  }

  // ---------- Gallery ----------

  get activeImage(): ShopifyImage | undefined {
    return this.images[this.activeImageIndex];
  }

  selectImage(index: number): void {
    this.activeImageIndex = index;
  }

  nextImage(): void {
    this.activeImageIndex = (this.activeImageIndex + 1) % this.images.length;
  }

  previousImage(): void {
    this.activeImageIndex = (this.activeImageIndex - 1 + this.images.length) % this.images.length;
  }

  // Zoom follows the mouse: set transform-origin to the cursor position
  onImageMouseMove(event: MouseEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100;
    const y = ((event.clientY - box.top) / box.height) * 100;
    this.zoomOrigin = `${x}% ${y}%`;
    this.isZooming = true;
  }

  onImageMouseLeave(): void {
    this.isZooming = false;
  }

  private findImageIndex(image: ShopifyImage): number {
    const key = image.url.split('?')[0];
    return this.images.findIndex(img => img.url.split('?')[0] === key);
  }

  // ---------- Cart ----------

  increaseQuantity(): void {
    this.quantity++;
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    if (!this.selectedVariant || !this.selectedVariant.availableForSale) {
      return;
    }

    this.isAddingToCart = true;
    this.cartMessage = '';
    this.cartError = '';

    // Cart service decides whether to create a new cart or add to the existing one
    this.cartService.addToCart(this.selectedVariant.id, this.quantity).subscribe({
      next: cart => {
        this.cart = cart;
        this.cartMessage = `Added ${this.quantity} × ${this.product?.title} to cart.`;
        this.quantity = 1;
        this.isAddingToCart = false;
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Shopify cart error:', error);
        this.cartError = 'Could not add to cart. Please try again.';
        this.isAddingToCart = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Link to the same product on the Shopify online store, built from its handle
  get shopifyUrl(): string {
    return `https://${environment.shopifyStoreDomain}/products/${this.product?.handle}`;
  }
}
