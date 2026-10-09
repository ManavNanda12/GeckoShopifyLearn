import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Customer } from '../../../services/customer';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: '../account-forms.css'
})
export class LoginComponent {
  // Form fields (bound with ngModel)
  email = '';
  password = '';
  showPassword = false;

  // "login" form or "forgot password" form
  mode: 'login' | 'recover' = 'login';

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private customerService: Customer,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  onLogin(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.startSubmit();
    this.customerService.login(this.email.trim(), this.password).subscribe({
      next: () => {
        // Go back to the page that sent us here (e.g. /account/orders/1001), or the account page
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/account';
        this.router.navigateByUrl(returnUrl);
      },
      error: error => this.showError(error)
    });
  }

  onRecover(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.startSubmit();
    this.customerService.recoverPassword(this.email.trim()).subscribe({
      next: () => {
        this.successMessage = `If an account exists for ${this.email}, Shopify has sent a password reset link to it.`;
        this.isSubmitting = false;
        this.cdr.markForCheck();
      },
      error: error => this.showError(error)
    });
  }

  setMode(mode: 'login' | 'recover'): void {
    this.mode = mode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  private startSubmit(): void {
    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  private showError(error: Error): void {
    console.error('Customer error:', error);
    this.errorMessage = error.message || 'Something went wrong. Please try again.';
    this.isSubmitting = false;
    // App is zoneless, so tell Angular to refresh the view after async data arrives
    this.cdr.markForCheck();
  }
}
