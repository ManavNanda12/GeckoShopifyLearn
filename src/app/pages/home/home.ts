import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shopify, ShopifyProduct } from '../../services/shopify';
import { ProductCardComponent } from '../../components/product-card/product-card';
import { getAllImages, isSoldOut, productDiscount } from '../../utils/product-utils';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCardComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  featuredProducts: ShopifyProduct[] = [];
  saleProducts: ShopifyProduct[] = [];
  categories: { name: string; count: number; image: string | null }[] = [];
  heroImage: string | null = null;
  isLoading = true;
  errorMessage = '';

  constructor(
    private shopifyService: Shopify,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.shopifyService.getProducts().subscribe({
      next: products => {
        const inStock = products.filter(p => !isSoldOut(p));

        // Show the first 4 in-stock products as "featured"
        this.featuredProducts = inStock.slice(0, 4);
        this.saleProducts = inStock.filter(p => productDiscount(p) > 0).slice(0, 4);
        this.categories = this.buildCategories(products);
        // Use a product photo with several images (more interesting) for the hero
        const heroProduct = products.find(p => getAllImages(p).length > 2) ?? products.find(p => p.featuredImage);
        this.heroImage = heroProduct?.featuredImage?.url ?? null;

        this.isLoading = false;
        // App is zoneless, so tell Angular to refresh the view after async data arrives
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Shopify API error:', error);
        this.errorMessage = 'Could not load products from Shopify.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // One tile per product type, with a product photo and item count
  private buildCategories(products: ShopifyProduct[]) {
    const map = new Map<string, { name: string; count: number; image: string | null }>();

    products.filter(p => p.productType).forEach(p => {
      const entry = map.get(p.productType) ?? { name: p.productType, count: 0, image: null };
      entry.count++;
      entry.image = entry.image ?? p.featuredImage?.thumbUrl ?? null;
      map.set(p.productType, entry);
    });

    return [...map.values()];
  }
}
