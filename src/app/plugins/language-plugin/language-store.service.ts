import { Inject, Injectable } from '@angular/core';
import { LanguageConfig, SupportedLanguage } from './language.models';
import { DEFAULT_LANGUAGE_TOKEN, STORAGE_KEY_TOKEN, SUPPORTED_LANGUAGES_TOKEN } from './language.tokens';

@Injectable({
  providedIn: 'root'
})
export class LanguageStoreService {
  constructor(
    @Inject(STORAGE_KEY_TOKEN) private storageKey: string,
    @Inject(DEFAULT_LANGUAGE_TOKEN) private defaultLanguage: SupportedLanguage | string,
    @Inject(SUPPORTED_LANGUAGES_TOKEN) private supportedLanguages: LanguageConfig[]
  ) {}

  async getSavedLanguage(): Promise<SupportedLanguage | string> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored && this.isSupported(stored)) {
          return stored;
        }
      }
    } catch (e) {
      console.warn('LanguageStoreService: Failed to read from localStorage', e);
    }

    const detected = this.detectDeviceLocale();
    if (detected && this.isSupported(detected)) {
      return detected;
    }

    return this.defaultLanguage;
  }

  async saveLanguage(lang: SupportedLanguage | string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, lang);
      }
    } catch (e) {
      console.warn('LanguageStoreService: Failed to write to localStorage', e);
    }
  }

  private detectDeviceLocale(): string | null {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.split('-')[0].toLowerCase();
    }
    return null;
  }

  private isSupported(lang: string): boolean {
    return this.supportedLanguages.some((l) => l.code === lang);
  }
}
