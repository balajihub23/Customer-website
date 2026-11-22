import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { LanguageManagerService } from '../language-manager.service';

@Pipe({
  name: 'translate',
  pure: false,
  standalone: true
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private value = '';
  private lastKey = '';
  private lastParams?: Record<string, any>;
  private subscription?: Subscription;

  constructor(
    private languageManager: LanguageManagerService,
    private cdr: ChangeDetectorRef
  ) {
    this.subscription = this.languageManager.currentDictionary$.subscribe(() => {
      if (this.lastKey) {
        this.updateValue(this.lastKey, this.lastParams);
        this.cdr.markForCheck();
      }
    });
  }

  transform(key: string, params?: Record<string, any>): string {
    if (!key) return '';

    if (key !== this.lastKey || JSON.stringify(params) !== JSON.stringify(this.lastParams)) {
      this.lastKey = key;
      this.lastParams = params;
      this.updateValue(key, params);
    }

    return this.value;
  }

  private updateValue(key: string, params?: Record<string, any>): void {
    this.value = this.languageManager.translate(key, params);
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
