import { Injectable } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SupportedLanguage } from './language.models';

@Injectable({
  providedIn: 'root'
})
export class MachineTranslationService {
  private http: HttpClient;
  private cacheMap: Map<string, Map<string, string>> = new Map();

  constructor(handler: HttpBackend) {
    // HttpBackend completely bypasses all application HttpInterceptors
    this.http = new HttpClient(handler);
    this.loadCacheFromStorage();
  }

  translateText(text: string, targetLang: SupportedLanguage | string, sourceLang: string = 'en'): Observable<string> {
    const tgt = String(targetLang);
    if (!text || !text.trim() || tgt === 'en') {
      return of(text);
    }

    const trimmedText = text.trim();
    const cached = this.getCachedTranslation(trimmedText, tgt);
    if (cached) {
      return of(cached);
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmedText)}&langpair=${sourceLang}|${tgt}`;

    return this.http.get<any>(url).pipe(
      map((response) => {
        if (response && response.responseData && response.responseData.translatedText) {
          const rawTranslated = response.responseData.translatedText;
          const cleaned = this.sanitizeTranslation(rawTranslated);
          if (cleaned && cleaned !== trimmedText) {
            this.setCachedTranslation(trimmedText, tgt, cleaned);
            return cleaned;
          }
        }
        return trimmedText;
      }),
      catchError((err) => {
        console.warn(`MachineTranslationService: Failed MT for "${trimmedText}" (${tgt})`, err);
        return of(trimmedText);
      })
    );
  }

  private sanitizeTranslation(text: string): string {
    if (!text) return '';
    let result = text;
    // Strip all XML/HTML placeholders like <ph .../>, <g ...>, etc.
    result = result.replace(/<[^>]+>/g, '');
    // Strip accidental brand intrusions like Uber
    result = result.replace(/\bUber\b/gi, '').trim();
    result = result.replace(/&quot;/g, '"');
    result = result.replace(/&#39;/g, "'");
    result = result.replace(/&amp;/g, '&');
    result = result.replace(/&lt;/g, '<');
    result = result.replace(/&gt;/g, '>');
    return result.replace(/\s+/g, ' ').trim();
  }

  getCachedTranslation(text: string, lang: string): string | undefined {
    const langCache = this.cacheMap.get(lang);
    return langCache ? langCache.get(text) : undefined;
  }

  setCachedTranslation(text: string, lang: string, translation: string): void {
    if (!this.cacheMap.has(lang)) {
      this.cacheMap.set(lang, new Map());
    }
    this.cacheMap.get(lang)!.set(text, translation);
    this.saveCacheToStorage(lang);
  }

  clearCache(): void {
    this.cacheMap.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        ['en', 'ta', 'hi', 'te', 'kn', 'ml', 'mr', 'bn'].forEach((lang) => {
          localStorage.removeItem(`app_mt_cache_${lang}`);
        });
      }
    } catch (e) {
      console.warn('MachineTranslationService: Error clearing storage cache', e);
    }
  }

  private loadCacheFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        ['en', 'ta', 'hi', 'te', 'kn', 'ml', 'mr', 'bn'].forEach((lang) => {
          const stored = localStorage.getItem(`app_mt_cache_${lang}`);
          if (stored) {
            const obj = JSON.parse(stored);
            const langMap = new Map<string, string>();
            let hadCorruptData = false;
            Object.keys(obj).forEach((key) => {
              const val = String(obj[key] || '');
              // Clean corrupt crowd-sourced or placeholder artifacts
              if (val && !val.includes('<ph') && !val.includes('Uber') && !val.includes('Aditya Sharma')) {
                langMap.set(key, val);
              } else {
                hadCorruptData = true;
              }
            });
            this.cacheMap.set(lang, langMap);
            if (hadCorruptData) {
              this.saveCacheToStorage(lang);
            }
          }
        });
      }
    } catch (e) {
      console.warn('MachineTranslationService: Error loading MT cache from storage', e);
    }
  }

  private saveCacheToStorage(lang: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const langMap = this.cacheMap.get(lang);
        if (langMap) {
          const obj: Record<string, string> = {};
          langMap.forEach((val, key) => (obj[key] = val));
          localStorage.setItem(`app_mt_cache_${lang}`, JSON.stringify(obj));
        }
      }
    } catch (e) {
      console.warn('MachineTranslationService: Error saving MT cache to storage', e);
    }
  }
}
