import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  if (req.url.startsWith('https://maps.googleapis.com') || 
      req.url.includes('openstreetmap.org') || 
      req.url.includes('mymemory.translated.net') ||
      req.url.startsWith('assets/') ||
      req.url.includes('/assets/')) {
    return next(req);
  }

  // Only attach auth tokens & custom app key and handle error routing for Rentron backend APIs
  const isBackendApi = req.url.startsWith(environment.serverApi) ||
                       req.url.startsWith('/api/') ||
                       (!req.url.startsWith('http://') && !req.url.startsWith('https://'));
  if (!isBackendApi) {
    return next(req);
  }


  const token = authService.getAccessToken();
  let headers = req.headers.set('X-Client-App-Key', environment.mobileAppKey || 'rentron-customer-mobile-app-secret-key-492BC');

  if (token && !req.headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  const cloned = req.clone({ headers });
  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/v1/auth/login')) {
        console.warn('Unauthorized 401 (User not found or deleted). Clearing session and redirecting to splash screen.');
        authService.clearSession();
        router.navigate(['/splash']);
      }
      return throwError(() => error);
    })
  );
};
