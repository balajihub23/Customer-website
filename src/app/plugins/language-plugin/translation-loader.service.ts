import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap, shareReplay } from 'rxjs/operators';
import { SupportedLanguage, TranslationDictionary } from './language.models';
import { I18N_ASSET_PATH_TOKEN } from './language.tokens';

@Injectable({
  providedIn: 'root'
})
export class TranslationLoaderService {
  private cache: Map<string, TranslationDictionary> = new Map();
  private loadingRequests: Map<string, Observable<TranslationDictionary>> = new Map();

  constructor(
    private http: HttpClient,
    @Inject(I18N_ASSET_PATH_TOKEN) private assetPath: string
  ) {}

  loadLanguage(lang: SupportedLanguage | string): Observable<TranslationDictionary> {
    const langKey = String(lang);
    if (this.cache.has(langKey)) {
      return of(this.cache.get(langKey)!);
    }

    if (this.loadingRequests.has(langKey)) {
      return this.loadingRequests.get(langKey)!;
    }

    const path = `${this.assetPath}${langKey}.json`;
    const request$ = this.http.get<TranslationDictionary>(path).pipe(
      tap((dict) => {
        this.cache.set(langKey, dict || {});
        this.loadingRequests.delete(langKey);
      }),
      catchError((err) => {
        console.warn(`TranslationLoaderService: Failed to load translation file at ${path}`, err);
        this.loadingRequests.delete(langKey);
        return of({});
      }),
      shareReplay(1)
    );

    this.loadingRequests.set(langKey, request$);
    return request$;
  }

  getLoadedDictionary(lang: SupportedLanguage | string): TranslationDictionary | undefined {
    return this.cache.get(String(lang));
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingRequests.clear();
  }
}
