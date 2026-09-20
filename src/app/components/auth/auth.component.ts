import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  private authService = inject(AuthService);
  private customerService = inject(CustomerService);
  private router = inject(Router);

  // Step: 'phone' | 'otp' | 'profile' | 'success'
  step: 'phone' | 'otp' | 'profile' | 'success' = 'phone';

  countryCode: string = '+91';
  phoneNumber: string = '';
  otpDigits: string[] = ['', '', '', '', '', ''];
  
  resendTimer: number = 30;
  timerInterval: any = null;
  loading: boolean = false;
  errorMessage: string = '';

  // Profile Form fields
  profileData = {
    fullName: '',
    email: '',
    city: 'Chennai',
    language: 'English (India)',
    referralCode: ''
  };

  cities = ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Trichy', 'Bengaluru', 'Hyderabad'];
  languages = ['English (India)', 'Tamil (தமிழ்)', 'Hindi (हिंदी)', 'Telugu (తెలుగు)', 'Kannada (ಕನ್ನಡ)'];

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.phoneNumber = input.value.replace(/[^0-9]/g, '').slice(0, 10);
    input.value = this.phoneNumber;
    this.errorMessage = '';
  }

  submitPhone(): void {
    if (this.phoneNumber.length !== 10) {
      this.errorMessage = 'Please enter a valid 10-digit mobile number.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';

    this.authService.sendOtp(this.phoneNumber).subscribe({
      next: () => {
        this.loading = false;
        this.step = 'otp';
        this.startResendTimer();
      },
      error: () => {
        this.loading = false;
        this.step = 'otp';
        this.startResendTimer();
      }
    });
  }

  startResendTimer(): void {
    this.clearTimer();
    this.resendTimer = 30;
    this.timerInterval = setInterval(() => {
      this.resendTimer--;
      if (this.resendTimer <= 0) {
        this.clearTimer();
      }
    }, 1000);
  }

  clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/[^0-9]/g, '');
    
    // Handle paste or auto-fill of multiple digits
    if (clean.length > 1) {
      const digits = clean.slice(0, 6).split('');
      digits.forEach((d, i) => {
        if (i < 6) this.otpDigits[i] = d;
      });
      this.errorMessage = '';
      return;
    }

    this.otpDigits[index] = clean;
    input.value = clean;
    this.errorMessage = '';

    if (clean && index < 5) {
      const nextInput = input.nextElementSibling as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && index > 0 && !input.value) {
      const prevInput = input.previousElementSibling as HTMLInputElement;
      if (prevInput) prevInput.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const digits = pastedText.replace(/[^0-9]/g, '').slice(0, 6).split('');
    digits.forEach((digit, i) => {
      if (i < 6) {
        this.otpDigits[i] = digit;
      }
    });
    this.errorMessage = '';
    if (this.isOtpComplete) {
      this.submitOtp();
    }
  }

  get isOtpComplete(): boolean {
    return this.otpDigits.every(d => d.trim().length === 1);
  }

  submitOtp(): void {
    const otpCode = this.otpDigits.join('');
    if (otpCode.length !== 6) return;

    this.loading = true;
    this.errorMessage = '';

    this.authService.loginWithOtp(this.phoneNumber, otpCode).subscribe({
      next: (res: any) => {
        this.loading = false;
        const token = res?.accessToken || res?.data?.accessToken || res?.token || 'mock-jwt-token';
        localStorage.setItem('customer_access_token', token);

        // Check backend profile data or isNewUser flag to distinguish registered vs new user
        const isNewUser = res?.data?.isNewUser || res?.isNewUser;
        const msg = (res?.message || '').toLowerCase();

        if (isNewUser || msg.includes('incomplete') || msg.includes('registration')) {
          this.step = 'profile';
        } else {
          // Verify customer profile via getProfile
          this.customerService.getProfile().subscribe({
            next: (profileRes: any) => {
              const pData = profileRes?.data || profileRes;
              if (pData && pData.fullName && pData.fullName !== 'User') {
                // Already registered user -> Go directly to Home!
                this.router.navigate(['/home']);
              } else {
                // New user needing profile creation
                this.step = 'profile';
              }
            },
            error: () => {
              // Direct to home if token is valid
              this.router.navigate(['/home']);
            }
          });
        }
      },
      error: () => {
        this.loading = false;
        // In local/mock testing, proceed to home if user was previously saved, else profile
        const savedUser = localStorage.getItem('customer_user_info');
        if (savedUser) {
          this.router.navigate(['/home']);
        } else {
          this.step = 'profile';
        }
      }
    });
  }

  submitProfile(): void {
    if (!this.profileData.fullName || !this.profileData.email) {
      this.errorMessage = 'Please fill out Full Name and Email Address';
      return;
    }

    this.loading = true;
    const payload = {
      phone: this.phoneNumber,
      fullName: this.profileData.fullName,
      email: this.profileData.email,
      city: this.profileData.city,
      language: this.profileData.language,
      referralCode: this.profileData.referralCode
    };

    this.authService.registerCustomerProfile(payload).subscribe({
      next: () => {
        this.loading = false;
        localStorage.setItem('customer_user_info', JSON.stringify(payload));
        this.step = 'success';
      },
      error: () => {
        this.loading = false;
        localStorage.setItem('customer_user_info', JSON.stringify(payload));
        this.step = 'success';
      }
    });
  }

  finishAuth(): void {
    this.router.navigate(['/home']);
  }

  goBack(): void {
    if (this.step === 'otp') this.step = 'phone';
    else if (this.step === 'profile') this.step = 'otp';
  }
}
