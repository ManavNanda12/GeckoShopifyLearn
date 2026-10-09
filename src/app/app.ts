import { Component, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { Cart, ShopifyCart } from './services/cart';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  title = 'Gecko Store';
  cart$: Observable<ShopifyCart | null>;

  constructor(private cartService: Cart) {
    this.cart$ = this.cartService.cart$;
  }

  ngOnInit(): void {
    // Load the saved cart once on app start so the navbar badge shows the right count
    this.cartService.refreshCart().subscribe({
      error: error => console.error('Could not load cart:', error)
    });
  }
}
