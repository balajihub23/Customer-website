export enum SupportedLanguage {
  EN = 'en',
  HI = 'hi',
  TA = 'ta',
  TE = 'te',
  KN = 'kn',
  ML = 'ml',
  MR = 'mr',
  BN = 'bn'
}

export interface LanguageConfig {
  code: SupportedLanguage | string;
  name: string;
  nativeName: string;
  flag?: string;
  isRtl?: boolean;
}

export interface LanguagePluginOptions {
  defaultLanguage?: SupportedLanguage | string;
  supportedLanguages?: LanguageConfig[];
  storageKey?: string;
  headerName?: string;
  i18nAssetPath?: string;
}

export type TranslationDictionary = Record<string, any>;
