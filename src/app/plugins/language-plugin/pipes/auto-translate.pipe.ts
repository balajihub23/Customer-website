import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { LanguageManagerService } from '../language-manager.service';

@Pipe({
  name: 'autoTranslate',
  pure: false,
  standalone: true
})
export class AutoTranslatePipe implements PipeTransform, OnDestroy {
  private value = '';
  private lastInput = '';
  private lastParams?: Record<string, any>;
  private subscription?: Subscription;

  constructor(
    private languageManager: LanguageManagerService,
    private cdr: ChangeDetectorRef
  ) {
    this.subscription = this.languageManager.currentDictionary$.subscribe(() => {
      if (this.lastInput) {
        this.updateValue(this.lastInput, this.lastParams);
        this.cdr.markForCheck();
      }
    });
  }

  transform(input: string, params?: Record<string, any>): string {
    if (!input) return '';

    if (input !== this.lastInput || JSON.stringify(params) !== JSON.stringify(this.lastParams)) {
      this.lastInput = input;
      this.lastParams = params;
      this.updateValue(input, params);
    }

    return this.value || input;
  }

  private updateValue(input: string, params?: Record<string, any>): void {
    this.languageManager.translateAuto(input, params).subscribe((translated) => {
      this.value = translated;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
