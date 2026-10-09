import { Component, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { Cart, ShopifyCart } from './services/cart';
import { Customer, ShopifyCustomer } from './services/customer';
import { ThemeService } from './services/theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  title = 'Gecko Store';
  cart$: Observable<ShopifyCart | null>;
  customer$: Observable<ShopifyCustomer | null>;

  constructor(
    private cartService: Cart,
    private customerService: Customer,
    private themeService: ThemeService
  ) {
    this.cart$ = this.cartService.cart$;
    this.customer$ = this.customerService.customer$;
  }

  get isDark(): boolean {
    return this.themeService.isDark;
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  ngOnInit(): void {
    // Load the saved cart once on app start so the navbar badge shows the right count
    this.cartService.refreshCart().subscribe({
      error: error => console.error('Could not load cart:', error)
    });

    // Log the customer back in if they have a saved (not expired) token
    this.customerService.restoreSession().subscribe({
      error: error => console.error('Could not restore customer session:', error)
    });
  }
}
