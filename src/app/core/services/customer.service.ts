import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface CustomerProfile {
  id?: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  language: string;
  dob?: string;
  gender?: string;
  address?: string;
  profilePhotoUrl?: string;
  referralCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private readonly baseUrl = environment.serverApi;

  getProfile(): Observable<any> {
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ 
        success: true, 
        data: null
      });
    }
    return this.http.get<any>(`${this.baseUrl}/api/v1/customers/me`);
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/v1/customers/me`, data);
  }

  getSavedAddresses(): Observable<any> {
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ success: true, data: [] });
    }
    return this.http.get<any>(`${this.baseUrl}/api/v1/customers/me/addresses`);
  }

  saveAddress(address: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/v1/customers/me/addresses`, address);
  }
}
