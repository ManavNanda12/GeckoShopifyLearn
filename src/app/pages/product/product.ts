import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Shopify, ShopifyProduct } from '../../services/shopify';
import { ProductCardComponent } from '../../components/product-card/product-card';
import { isSoldOut, toNumber } from '../../utils/product-utils';

type StockFilter = 'all' | 'inStock' | 'soldOut';
type SortOption = 'featured' | 'priceLow' | 'priceHigh' | 'nameAZ';

@Component({
  selector: 'app-product',
  imports: [ProductCardComponent],
  templateUrl: './product.html',
  styleUrl: './product.css'
})
export class ProductComponent implements OnInit {
  shopifyProducts: ShopifyProduct[] = [];
  isLoading = true;
  errorMessage = '';

  // Filters
  searchText = '';
  selectedCategory = ''; // '' = all categories
  selectedFilter: StockFilter = 'all';
  sortBy: SortOption = 'featured';

  constructor(
    private shopifyService: Shopify,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Allow links like /products?type=snowboard (used by Home categories)
    this.selectedCategory = this.route.snapshot.queryParamMap.get('type') ?? '';

    this.shopifyService.getProducts().subscribe({
      next: products => {
        this.shopifyProducts = products;
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

  // Unique product types, e.g. ['accessories', 'giftcard', 'snowboard']
  get categories(): string[] {
    const types = this.shopifyProducts.map(p => p.productType).filter(type => !!type);
    return [...new Set(types)].sort();
  }

  // Products after search + category + stock filter + sort
  get filteredProducts(): ShopifyProduct[] {
    const search = this.searchText.trim().toLowerCase();

    let products = this.shopifyProducts.filter(p => {
      const matchesSearch = !search
        || p.title.toLowerCase().includes(search)
        || p.vendor.toLowerCase().includes(search)
        || p.tags.some(tag => tag.toLowerCase().includes(search));
      const matchesCategory = !this.selectedCategory || p.productType === this.selectedCategory;
      const matchesStock = this.selectedFilter === 'all'
        || (this.selectedFilter === 'inStock' && !isSoldOut(p))
        || (this.selectedFilter === 'soldOut' && isSoldOut(p));
      return matchesSearch && matchesCategory && matchesStock;
    });

    const price = (p: ShopifyProduct) => toNumber(p.priceRange.minVariantPrice.amount);

    if (this.sortBy === 'priceLow') {
      products = [...products].sort((a, b) => price(a) - price(b));
    } else if (this.sortBy === 'priceHigh') {
      products = [...products].sort((a, b) => price(b) - price(a));
    } else if (this.sortBy === 'nameAZ') {
      products = [...products].sort((a, b) => a.title.localeCompare(b.title));
    }
    return products;
  }

  get inStockCount(): number {
    return this.shopifyProducts.filter(p => !isSoldOut(p)).length;
  }

  get soldOutCount(): number {
    return this.shopifyProducts.length - this.inStockCount;
  }

  get hasActiveFilters(): boolean {
    return !!this.searchText || !!this.selectedCategory || this.selectedFilter !== 'all';
  }

  // ----- Event handlers (plain DOM events, no FormsModule needed) -----

  onSearch(event: Event): void {
    this.searchText = (event.target as HTMLInputElement).value;
  }

  onSortChange(event: Event): void {
    this.sortBy = (event.target as HTMLSelectElement).value as SortOption;
  }

  setCategory(category: string): void {
    this.selectedCategory = category;
  }

  setFilter(filter: StockFilter): void {
    this.selectedFilter = filter;
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedCategory = '';
    this.selectedFilter = 'all';
  }
}
