import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

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
  {
    path: 'account',
    children: [
      {
        path: '', // /account (dashboard + order history)
        canActivate: [authGuard],
        loadComponent: () => import('./pages/account/account/account').then(m => m.AccountComponent)
      },
      {
        path: 'login', // /account/login (also handles "forgot password")
        canActivate: [guestGuard],
        loadComponent: () => import('./pages/account/login/login').then(m => m.LoginComponent)
      },
      {
        path: 'register', // /account/register
        canActivate: [guestGuard],
        loadComponent: () => import('./pages/account/register/register').then(m => m.RegisterComponent)
      },
      {
        path: 'orders/:orderNumber', // /account/orders/1001
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/account/order-detail/order-detail').then(m => m.OrderDetailComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'home' }
];
