import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  
  themeMode = signal<ThemeMode>('SYSTEM');
  activeTheme = signal<'LIGHT' | 'DARK'>('LIGHT');

  private mediaQueryListener?: (e: MediaQueryListEvent) => void;

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const savedMode = (localStorage.getItem('rentron_theme_mode') as ThemeMode) || 'SYSTEM';
    this.setThemeMode(savedMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      if (this.themeMode() === 'SYSTEM') {
        this.applyEffectiveTheme(e.matches ? 'DARK' : 'LIGHT');
      }
    };
    mediaQuery.addEventListener('change', this.mediaQueryListener);
  }

  theme(): 'light' | 'dark' {
    return this.activeTheme().toLowerCase() as 'light' | 'dark';
  }

  toggleTheme(): void {
    const current = this.activeTheme();
    this.setThemeMode(current === 'DARK' ? 'LIGHT' : 'DARK');
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rentron_theme_mode', mode);
    }

    if (mode === 'SYSTEM') {
      const isSystemDark = isPlatformBrowser(this.platformId) && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyEffectiveTheme(isSystemDark ? 'DARK' : 'LIGHT');
    } else {
      this.applyEffectiveTheme(mode);
    }
  }

  private applyEffectiveTheme(theme: 'LIGHT' | 'DARK'): void {
    this.activeTheme.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      const root = document.documentElement;
      if (theme === 'DARK') {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.setAttribute('data-theme', 'light');
      }
    }
  }

  isDarkMode(): boolean {
    return this.activeTheme() === 'DARK';
  }
}
