import { InjectionToken } from '@angular/core';
import { LanguageConfig, SupportedLanguage } from './language.models';

export const DEFAULT_SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: SupportedLanguage.EN, name: 'English', nativeName: 'English' },
  { code: SupportedLanguage.HI, name: 'Hindi', nativeName: 'हिंदी' },
  { code: SupportedLanguage.TA, name: 'Tamil', nativeName: 'தமிழ்' },
  { code: SupportedLanguage.TE, name: 'Telugu', nativeName: 'తెలుగు' },
  { code: SupportedLanguage.KN, name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: SupportedLanguage.ML, name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: SupportedLanguage.MR, name: 'Marathi', nativeName: 'मराठी' },
  { code: SupportedLanguage.BN, name: 'Bengali', nativeName: 'বাংলা' }
];

export const DEFAULT_LANGUAGE_TOKEN = new InjectionToken<SupportedLanguage | string>(
  'LANGUAGE_PLUGIN_DEFAULT_LANGUAGE',
  { providedIn: 'root', factory: () => SupportedLanguage.EN }
);

export const SUPPORTED_LANGUAGES_TOKEN = new InjectionToken<LanguageConfig[]>(
  'LANGUAGE_PLUGIN_SUPPORTED_LANGUAGES',
  { providedIn: 'root', factory: () => DEFAULT_SUPPORTED_LANGUAGES }
);

export const STORAGE_KEY_TOKEN = new InjectionToken<string>(
  'LANGUAGE_PLUGIN_STORAGE_KEY',
  { providedIn: 'root', factory: () => 'app_selected_language' }
);

export const HTTP_HEADER_NAME_TOKEN = new InjectionToken<string>(
  'LANGUAGE_PLUGIN_HTTP_HEADER_NAME',
  { providedIn: 'root', factory: () => 'Accept-Language' }
);

export const I18N_ASSET_PATH_TOKEN = new InjectionToken<string>(
  'LANGUAGE_PLUGIN_I18N_ASSET_PATH',
  { providedIn: 'root', factory: () => 'assets/i18n/' }
);
