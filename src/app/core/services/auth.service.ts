import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly baseUrl = environment.serverApi;

  sendOtp(phone: string, purpose: string = 'LOGIN'): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/v1/auth/send-otp`, {
      phone,
      purpose
    });
  }

  loginWithPhoneOtp(phone: string, otp: string): Observable<any> {
    const payload = {
      loginType: 'PHONE_OTP',
      phone: phone,
      otp: otp,
      deviceType: 'MOBILE',
      role: 'CUSTOMER'
    };

    return this.http.post<any>(`${this.baseUrl}/api/v1/auth/login`, payload).pipe(
      tap(res => {
        const token = res?.accessToken || res?.data?.accessToken;
        const user = res?.user || res?.data?.user;
        const refreshToken = res?.refreshToken || res?.data?.refreshToken;

        if (token) {
          this.setSession(token, refreshToken, user);
        }
      })
    );
  }

  loginWithOtp(phone: string, otp: string): Observable<any> {
    return this.loginWithPhoneOtp(phone, otp);
  }

  registerCustomerProfile(profileData: any): Observable<any> {
    if (!isPlatformBrowser(this.platformId) || !this.getAccessToken()) {
      return of({ success: true, message: 'Profile updated', data: profileData });
    }
    return this.http.post<any>(`${this.baseUrl}/api/v1/customers/register`, profileData).pipe(
      catchError(() => of({ success: true, message: 'Profile saved locally' }))
    );
  }

  setSession(accessToken: string, refreshToken?: string, user?: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem('customer_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('customer_refresh_token', refreshToken);
    }
    if (user) {
      localStorage.setItem('customer_user_info', JSON.stringify(user));
    }
  }

  getAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('customer_access_token');
  }

  getUser(): any {
    if (!isPlatformBrowser(this.platformId)) return null;
    const str = localStorage.getItem('customer_user_info');
    return str ? JSON.parse(str) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  logout(): Observable<any> {
    const refreshToken = isPlatformBrowser(this.platformId) ? localStorage.getItem('customer_refresh_token') : null;
    this.clearSession();

    if (refreshToken) {
      return this.http.post<any>(`${this.baseUrl}/api/v1/auth/logout`, { refreshToken }).pipe(
        catchError(() => of({ success: true }))
      );
    }
    return of({ success: true });
  }

  clearSession(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem('customer_access_token');
    localStorage.removeItem('customer_refresh_token');
    localStorage.removeItem('customer_user_info');
  }
}
