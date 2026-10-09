import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Customer } from '../services/customer';

// Only logged in customers can open the page; others go to login (and come back after)
export const authGuard: CanActivateFn = (route, state) => {
  const customerService = inject(Customer);
  const router = inject(Router);

  if (customerService.isLoggedIn) {
    return true;
  }
  return router.createUrlTree(['/account/login'], { queryParams: { returnUrl: state.url } });
};

// Login/register pages: already logged in customers go straight to their account
export const guestGuard: CanActivateFn = () => {
  const customerService = inject(Customer);
  const router = inject(Router);

  return customerService.isLoggedIn ? router.createUrlTree(['/account']) : true;
};
