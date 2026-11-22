import { Inject, Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpInterceptorFn } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LanguageManagerService } from './language-manager.service';
import { HTTP_HEADER_NAME_TOKEN } from './language.tokens';

function isExternalOrAssetUrl(url: string): boolean {
  if (url.startsWith('assets/') || url.includes('/assets/')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return !url.includes('/rentron') && !url.includes(':8080') && !url.includes('rentron.in');
  }
  return false;
}

@Injectable()
export class LanguageInterceptor implements HttpInterceptor {
  constructor(
    private languageManager: LanguageManagerService,
    @Inject(HTTP_HEADER_NAME_TOKEN) private headerName: string
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (isExternalOrAssetUrl(req.url)) {
      return next.handle(req);
    }

    const currentLang = String(this.languageManager.getCurrentLanguage());

    if (currentLang) {
      const clonedReq = req.clone({
        headers: req.headers.set(this.headerName, currentLang)
      });
      return next.handle(clonedReq);
    }

    return next.handle(req);
  }
}

export const languageInterceptorFn: HttpInterceptorFn = (req, next) => {
  if (isExternalOrAssetUrl(req.url)) {
    return next(req);
  }

  const languageManager = inject(LanguageManagerService);
  const currentLang = String(languageManager.getCurrentLanguage());
  if (currentLang) {
    return next(req.clone({
      headers: req.headers.set('Accept-Language', currentLang)
    }));
  }
  return next(req);
};
