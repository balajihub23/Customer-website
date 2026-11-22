import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { LanguageConfig, SupportedLanguage } from '../../language.models';
import { LanguageManagerService } from '../../language-manager.service';
import { GlobalAutoTranslateService } from '../../global-auto-translate.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss']
})
export class LanguageSwitcherComponent implements OnInit {
  @Input() displayMode: 'bottom-sheet' | 'inline' = 'bottom-sheet';
  @Input() isOpen = false;

  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() languageChanged = new EventEmitter<SupportedLanguage | string>();

  supportedLanguages: LanguageConfig[] = [];
  currentLanguage$: Observable<SupportedLanguage | string>;

  constructor(
    private languageManager: LanguageManagerService,
    private globalAutoTranslate: GlobalAutoTranslateService
  ) {
    this.currentLanguage$ = this.languageManager.currentLanguage$;
  }

  ngOnInit(): void {
    this.supportedLanguages = this.languageManager.getSupportedLanguages();
  }

  selectLanguage(langCode: SupportedLanguage | string): void {
    this.languageManager.setLanguage(langCode).then(() => {
      this.globalAutoTranslate.forceReTranslate();
      this.languageChanged.emit(langCode);
      this.close();

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 80);
    });
  }

  close(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }
}
