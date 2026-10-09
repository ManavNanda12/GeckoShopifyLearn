import { Routes } from '@angular/router';

// Every page is lazy loaded with loadComponent, so its code is only
// downloaded when the user visits that route.
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'products',
    children: [
      {
        path: '', // /products
        loadComponent: () => import('./pages/product/product').then(m => m.ProductComponent)
      },
      {
        path: ':id', // /products/1
        loadComponent: () =>
          import('./pages/product-detail/product-detail').then(m => m.ProductDetailComponent)
      }
    ]
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart').then(m => m.CartComponent)
  },
  {
    path: 'order-confirmation',
    loadComponent: () =>
      import('./pages/order-confirmation/order-confirmation').then(m => m.OrderConfirmationComponent)
  },
  { path: '**', redirectTo: 'home' }
];
