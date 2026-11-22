import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from './pipes/translate.pipe';
import { AutoTranslatePipe } from './pipes/auto-translate.pipe';
import { AutoTranslateDirective } from './directives/auto-translate.directive';
import { LanguageSwitcherComponent } from './components/language-switcher/language-switcher.component';

@NgModule({
  imports: [
    CommonModule,
    TranslatePipe,
    AutoTranslatePipe,
    AutoTranslateDirective,
    LanguageSwitcherComponent
  ],
  exports: [
    TranslatePipe,
    AutoTranslatePipe,
    AutoTranslateDirective,
    LanguageSwitcherComponent
  ]
})
export class LanguagePluginModule {}
