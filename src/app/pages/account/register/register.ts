import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Customer } from '../../../services/customer';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../account-forms.css'
})
export class RegisterComponent {
  // Form fields (bound with ngModel)
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  acceptsMarketing = false;
  showPassword = false;

  isSubmitting = false;
  errorMessage = '';

  constructor(
    private customerService: Customer,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  onRegister(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.customerService
      .register(this.firstName.trim(), this.lastName.trim(), this.email.trim(), this.password, this.acceptsMarketing)
      .subscribe({
        // Account created and logged in
        next: () => this.router.navigateByUrl('/account'),
        error: error => {
          console.error('Register error:', error);
          this.errorMessage = error.message || 'Could not create your account. Please try again.';
          this.isSubmitting = false;
          // App is zoneless, so tell Angular to refresh the view after async data arrives
          this.cdr.markForCheck();
        }
      });
  }
}
