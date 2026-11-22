import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LanguageConfig, SupportedLanguage, TranslationDictionary } from './language.models';
import { DEFAULT_LANGUAGE_TOKEN, SUPPORTED_LANGUAGES_TOKEN } from './language.tokens';
import { LanguageStoreService } from './language-store.service';
import { TranslationLoaderService } from './translation-loader.service';
import { MachineTranslationService } from './machine-translation.service';

const MASTER_UI_DICTIONARY: Record<string, Record<string, string>> = {
  [SupportedLanguage.EN]: {},
  [SupportedLanguage.TA]: {
    'home': 'முகப்பு',
    'jobs': 'பணிகள்',
    'bookings': 'முன்பதிவுகள்',
    'track': 'கண்காணி',
    'earnings': 'சம்பாத்தியம்',
    'profile': 'சுயவிவரம்',
    'location': 'இடம்',
    'you are online': 'நீங்கள் ஆன்லைனில் உள்ளீர்கள்',
    "today's summary": 'இன்றைய சுருக்கம்',
    'jobs done': 'முடிந்த பணிகள்',
    'hours': 'மணிநேரம்',
    'earned': 'சம்பாதித்தது',
    'active job': 'செயலில் உள்ள பணி',
    'in progress': 'நடைபெறுகிறது',
    'site location': 'வேலை நடைபெறும் இடம்',
    'vehicle': 'வாகனம்',
    'work duration': 'வேலை நேரம்',
    'elapsed': 'முடிந்தது',
    'navigate': 'வழிசெலுத்து',
    'call': 'அழை',
    'ongoing': 'நடைபெறுபவை',
    'completed': 'முடிவடைந்தது',
    'cancelled': 'ரத்து செய்யப்பட்டது',
    'pending': 'நிலுவையில் உள்ளது',
    'new job request!': 'புதிய பணி கோரிக்கை!',
    'accept quickly to get the job': 'பணியைப் பெற விரைவாக ஏற்றுக்கொள்ளுங்கள்',
    'vehicle required': 'தேவையான வாகனம்',
    'duration': 'கால அளவு',
    'estimated earning': 'எதிர்பார்க்கப்படும் வருமானம்',
    'decline': 'நிராகரி',
    'accept': 'ஏற்றுக்கொள்',
    'no ongoing jobs': 'செயலில் உள்ள பணிகள் எதுவும் இல்லை',
    'no completed jobs': 'முடிவடைந்த பணிகள் எதுவும் இல்லை',
    'no cancelled jobs': 'ரத்து செய்யப்பட்ட பணிகள் எதுவும் இல்லை',
    'total earnings': 'மொத்த வருமானம்',
    'this week': 'இந்த வாரம்',
    'this month': 'இந்த மாதம்',
    'today': 'இன்று',
    'average': 'சராசரி',
    'total jobs': 'மொத்த பணிகள்',
    'work hours': 'வேலை நேரங்கள்',
    'weekly earnings': 'வாராந்திர வருமானம்',
    'weekly': 'வாராந்திர',
    'payment history': 'பணம் செலுத்திய வரலாறு',
    'view all': 'அனைத்தையும் காண்',
    'received': 'பெறப்பட்டது',
    'withdraw earnings': 'வருமானத்தை திரும்பப்பெறுக',
    'payment received': 'பணம் பெறப்பட்டது',
    'pay online': 'ஆன்லைனில் செலுத்தவும்',
    'cash payment': 'ரொக்கப் பணம்',
    'end job': 'வேலையை முடிக்கவும்',
    'start ride': 'பயணத்தைத் தொடங்கவும்',
    'complete ride': 'பயணத்தை முடிக்கவும்',
    'rating': 'மதிப்பீடு',
    'experience': 'அனுபவம்',
    'account': 'கணக்கு',
    'personal information': 'தனிப்பட்ட விவரங்கள்',
    'saved sites & addresses': 'சேமித்த இடங்கள் & முகவரிகள்',
    'my documents': 'என் ஆவணங்கள்',
    'my vehicles': 'என் வாகனங்கள்',
    'fleet': 'வாகனக் குழு',
    'preferences': 'விருப்பத்தேர்வுகள்',
    'notifications': 'அறிவிப்புகள்',
    'dark mode': 'இருண்ட முறை',
    'language': 'மொழி',
    'support': 'ஆதரவு',
    'help center': 'உதவி மையம்',
    'support & help desk': 'ஆதரவு & உதவி மையம்',
    'terms & conditions': 'விதிகள் மற்றும் நிபந்தனைகள்',
    'privacy policy': 'தனியுரிமைக் கொள்கை',
    'refer & earn': 'பரிந்துரைத்து சம்பாதிக்கவும்',
    'logout': 'வெளியேறு',
    'version 1.0.0': 'பதிப்பு 1.0.0',
    'select language': 'மொழியைத் தேர்ந்தெடுக்கவும்',
    'jcb operator': 'ஜேசிபி ஆபரேட்டர்',
    'apply selection': 'தேர்வைச் செயல்படுத்தவும்',
    'driver partner': 'ஓட்டுநர் கூட்டாளர்',
    'customer account': 'வாடிக்கையாளர் கணக்கு',
    'driver': 'ஓட்டுநர்',
    'valued customer': 'மதிப்புமிக்க வாடிக்கையாளர்',
    'welcome to rentron': 'ரென்ட்ரான்-க்கு வரவேற்கிறோம்',
    'log in to view profile & bookings': 'சுயவிவரம் மற்றும் முன்பதிவுகளைக் காண உள்நுழைக'
  },
  [SupportedLanguage.HI]: {
    'home': 'होम',
    'jobs': 'कार्य',
    'bookings': 'बुकिंग',
    'track': 'ट्रैक करें',
    'earnings': 'कमाई',
    'profile': 'प्रोफ़ाइल',
    'location': 'स्थान',
    'you are online': 'आप ऑनलाइन हैं',
    "today's summary": 'आज का सारांश',
    'jobs done': 'पूरे किए गए कार्य',
    'hours': 'घंटे',
    'earned': 'कमाए गए',
    'active job': 'सक्रिय कार्य',
    'in progress': 'प्रगति पर है',
    'site location': 'साइट का स्थान',
    'vehicle': 'वाहन',
    'work duration': 'कार्य की अवधि',
    'elapsed': 'बीता समय',
    'navigate': 'नेविगेट करें',
    'call': 'कॉल करें',
    'ongoing': 'जारी है',
    'completed': 'पूरा हुआ',
    'cancelled': 'रद्द किया गया',
    'pending': 'लंबित',
    'new job request!': 'नया काम का अनुरोध!',
    'accept quickly to get the job': 'काम पाने के लिए जल्दी स्वीकार करें',
    'vehicle required': 'आवश्यक वाहन',
    'duration': 'अवधि',
    'estimated earning': 'अनुमानित कमाई',
    'decline': 'अस्वीकार करें',
    'accept': 'स्वीकार करें',
    'no ongoing jobs': 'कोई सक्रिय कार्य नहीं है',
    'no completed jobs': 'कोई पूरा हुआ कार्य नहीं है',
    'no cancelled jobs': 'कोई रद्द कार्य नहीं है',
    'total earnings': 'कुल कमाई',
    'this week': 'इस सप्ताह',
    'this month': 'इस महीने',
    'today': 'आज',
    'average': 'औसत',
    'total jobs': 'कुल कार्य',
    'work hours': 'कार्य के घंटे',
    'weekly earnings': 'साप्ताहिक कमाई',
    'weekly': 'साप्ताहिक',
    'payment history': 'भुगतान का इतिहास',
    'view all': 'सभी देखें',
    'received': 'प्राप्त हुआ',
    'withdraw earnings': 'कमाई निकालें',
    'payment received': 'भुगतान प्राप्त हुआ',
    'pay online': 'ऑनलाइन भुगतान करें',
    'cash payment': 'नकद भुगतान',
    'end job': 'कार्य समाप्त करें',
    'start ride': 'सवारी शुरू करें',
    'complete ride': 'सवारी पूरी करें',
    'rating': 'रेटिंग',
    'experience': 'अनुभव',
    'account': 'खाता',
    'personal information': 'व्यक्तिगत जानकारी',
    'saved sites & addresses': 'सहेजे गए पते',
    'my documents': 'मेरे दस्तावेज़',
    'my vehicles': 'मेरे वाहन',
    'fleet': 'फ्लीट',
    'preferences': 'प्राथमिकताएं',
    'notifications': 'सूचनाएं',
    'dark mode': 'डार्क मोड',
    'language': 'भाषा',
    'support': 'सहायता',
    'help center': 'सहायता केंद्र',
    'support & help desk': 'सपोर्ट और हेल्प डेस्क',
    'terms & conditions': 'नियम और शर्तें',
    'privacy policy': 'गोपनीयता नीति',
    'refer & earn': 'रेफ़र करें और कमाएं',
    'logout': 'लॉग आउट',
    'version 1.0.0': 'संस्करण 1.0.0',
    'select language': 'भाषा चुनें',
    'jcb operator': 'जेसीबी ऑपरेटर',
    'apply selection': 'चयन लागू करें',
    'driver partner': 'ड्राइवर पार्टनर',
    'customer account': 'ग्राहक खाता',
    'driver': 'ड्राइवर',
    'valued customer': 'प्रतिष्ठित ग्राहक',
    'welcome to rentron': 'रेन्ट्रॉन में आपका स्वागत है',
    'log in to view profile & bookings': 'प्रोफ़ाइल और बुकिंग देखने के लिए लॉगिन करें'
  },
  [SupportedLanguage.TE]: {
    'home': 'హోమ్',
    'jobs': 'ఉద్యోగాలు',
    'bookings': 'బుకింగ్‌లు',
    'track': 'ట్రాక్',
    'earnings': 'ఆదాయాలు',
    'profile': 'ప్రొఫైల్',
    'account': 'ఖాతా',
    'personal information': 'వ్యక్తిగత సమాచారం',
    'saved sites & addresses': 'సేవ్ చేసిన చిరునామాలు',
    'my documents': 'నా పత్రాలు',
    'my vehicles': 'నా వాహనాలు',
    'fleet': 'ఫ్లీట్',
    'preferences': 'ప్రాధాన్యతలు',
    'notifications': 'నోటిఫికేషన్‌లు',
    'dark mode': 'డార్క్ మోడ్',
    'language': 'భాష',
    'support': 'మద్దతు',
    'help center': 'సహాయ కేంద్రం',
    'support & help desk': 'సపోర్ట్ & హెల్ప్ డెస్క్',
    'terms & conditions': 'నిబంధనలు & షరతులు',
    'privacy policy': 'గోప్యతా విధానం',
    'refer & earn': 'రిఫర్ చేయండి & సంపాదించండి',
    'logout': 'లాగ్ అవుట్',
    'version 1.0.0': 'వెర్షన్ 1.0.0',
    'rating': 'రేటింగ్',
    'experience': 'అనుభవం',
    'active': 'యాక్టివ్',
    'ongoing': 'కొనసాగుతోంది',
    'completed': 'పూర్తయింది',
    'cancelled': 'రద్దు చేయబడింది',
    'pending': 'పెండింగ్‌లో ఉంది',
    'total earnings': 'మొత్తం ఆదాయం',
    'today': 'ఈరోజు',
    'this week': 'ఈ వారం',
    'this month': 'ఈ నెల',
    'payment received': 'చెల్లింపు అందింది',
    'pay online': 'ఆన్‌లైన్‌లో చెల్లించండి',
    'cash payment': 'నగదు చెల్లింపు',
    'end job': 'పనిని ముగించండి',
    'start ride': 'రైడ్ ప్రారంభించండి',
    'complete ride': 'రైడ్ పూర్తి చేయండి',
    'accept': 'స్వీకరించండి',
    'decline': 'తిరస్కరించండి',
    'enter otp': 'OTP నమోదు చేయండి',
    'verify otp': 'OTP ధృవీకరించండి',
    'resend otp': 'OTP మళ్లీ పంపండి',
    'call': 'కాల్',
    'navigate': 'నావిగేట్',
    'apply selection': 'ఎంపికను వర్తింపజేయండి',
    'driver partner': 'డ్రైవర్ భాగస్వామి',
    'customer account': 'కస్టమర్ ఖాతా',
    'driver': 'డ్రైవర్',
    'valued customer': 'విలువైన కస్టమర్',
    'welcome to rentron': 'రెంట్రాన్‌కి స్వాగతం',
    'log in to view profile & bookings': 'ప్రొఫైల్ & బుకింగ్‌లను వీక్షించడానికి లాగిన్ చేయండి'
  },
  [SupportedLanguage.KN]: {
    'home': 'ಮುಖಪುಟ',
    'jobs': 'ಕೆಲಸಗಳು',
    'bookings': 'ಬುಕಿಂಗ್‌ಗಳು',
    'track': 'ಟ್ರ್ಯಾಕ್',
    'earnings': 'ಗಳಿಕೆಗಳು',
    'profile': 'ಪ್ರೊಫೈಲ್',
    'account': 'ಖಾತೆ',
    'personal information': 'ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ',
    'my documents': 'ನನ್ನ ದಾಖಲೆಗಳು',
    'notifications': 'ಅಧಿಸೂಚನೆಗಳು',
    'dark mode': 'ಡಾರ್ಕ್ ಮೋಡ್',
    'language': 'ಭಾಷೆ',
    'support': 'ಬೆಂಬಲ',
    'logout': 'ಲಾಗ್ ಔಟ್',
    'apply selection': 'ಆಯ್ಕೆಯನ್ನು ಅನ್ವಯಿಸಿ',
    'driver partner': 'ಚಾಲಕ ಪಾಲುದಾರ',
    'customer account': 'ಗ್ರಾಹಕ ಖಾತೆ',
    'driver': 'ಚಾಲಕ'
  }
};

@Injectable({
  providedIn: 'root'
})
export class LanguageManagerService {
  private currentLanguageSubject: BehaviorSubject<SupportedLanguage | string>;
  public currentLanguage$: Observable<SupportedLanguage | string>;

  private currentDictionarySubject = new BehaviorSubject<TranslationDictionary>({});
  public currentDictionary$: Observable<TranslationDictionary> = this.currentDictionarySubject.asObservable();

  private isInitialized = false;

  constructor(
    @Inject(DEFAULT_LANGUAGE_TOKEN) private defaultLanguage: SupportedLanguage | string,
    @Inject(SUPPORTED_LANGUAGES_TOKEN) private supportedLanguages: LanguageConfig[],
    private store: LanguageStoreService,
    private loader: TranslationLoaderService,
    private mtService: MachineTranslationService
  ) {
    this.currentLanguageSubject = new BehaviorSubject<SupportedLanguage | string>(this.defaultLanguage);
    this.currentLanguage$ = this.currentLanguageSubject.asObservable();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const savedLang = await this.store.getSavedLanguage();
    await this.setLanguageInternal(savedLang);
    this.isInitialized = true;
  }

  getCurrentLanguage(): SupportedLanguage | string {
    return this.currentLanguageSubject.value;
  }

  getSupportedLanguages(): LanguageConfig[] {
    return [...this.supportedLanguages];
  }

  async setLanguage(lang: SupportedLanguage | string): Promise<void> {
    await this.setLanguageInternal(lang);
    await this.store.saveLanguage(lang);
  }

  clearAllCaches(): void {
    this.mtService.clearCache();
    this.loader.clearCache();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('app_selected_language');
      }
    } catch (e) {
      console.warn('LanguageManagerService: Error clearing storage key', e);
    }
  }

  translateAuto(text: string, params?: Record<string, any>): Observable<string> {
    if (!text || !text.trim()) {
      return of('');
    }

    const trimmed = text.trim();

    if (this.isPureNumberOrCurrency(trimmed)) {
      return of(this.applyParams(trimmed, params));
    }

    const currentLang = String(this.getCurrentLanguage());
    if (currentLang === 'en') {
      return of(this.applyParams(trimmed, params));
    }

    // 1. Check Master UI Dictionary (Case-insensitive & Normalized)
    const masterDict = MASTER_UI_DICTIONARY[currentLang] || {};
    const normalizedKey = trimmed.toLowerCase();
    let match: any = masterDict[normalizedKey];

    // 2. Check dynamically loaded assets dictionary if available
    if (!match) {
      const dynamicDict = this.currentDictionarySubject.value;
      match = dynamicDict[trimmed] || this.getNestedValue(dynamicDict, trimmed) || this.findInDictionary(dynamicDict, trimmed);
    }

    if (match) {
      return of(this.applyParams(String(match), params));
    }

    // 3. Prevent translating personal names or entity names
    if (this.isProperNounOrName(trimmed)) {
      return of(this.applyParams(trimmed, params));
    }

    // 4. Fallback to Machine Translation Engine
    return this.mtService.translateText(trimmed, currentLang).pipe(
      map((translated) => this.applyParams(translated, params)),
      catchError(() => of(this.applyParams(trimmed, params)))
    );
  }

  translate(keyOrText: string, params?: Record<string, any>): string {
    if (!keyOrText) return '';

    const trimmed = keyOrText.trim();
    if (this.isPureNumberOrCurrency(trimmed)) {
      return this.applyParams(trimmed, params);
    }

    const currentLang = String(this.getCurrentLanguage());
    if (currentLang === 'en') {
      return this.applyParams(trimmed, params);
    }

    const masterDict = MASTER_UI_DICTIONARY[currentLang] || {};
    let value: any = masterDict[trimmed.toLowerCase()];

    if (!value) {
      const dict = this.currentDictionarySubject.value;
      value = dict[trimmed] || this.getNestedValue(dict, trimmed) || this.findInDictionary(dict, trimmed);
    }

    if (!value) {
      value = this.mtService.getCachedTranslation(trimmed, currentLang);
    }

    if (value === undefined || value === null) {
      value = keyOrText;
    }

    return this.applyParams(String(value), params);
  }

  private isPureNumberOrCurrency(text: string): boolean {
    return /^[\d.,₹$€£%+\-\s]+$/.test(text);
  }

  private isProperNounOrName(text: string): boolean {
    // If it's a person's name or custom title, not found in our UI dictionary:
    // e.g. "Balaji", "Balaji E", "Suresh Kumar" -> do NOT translate as common words
    const lower = text.toLowerCase();
    for (const dictLang of Object.keys(MASTER_UI_DICTIONARY)) {
      if (MASTER_UI_DICTIONARY[dictLang]?.[lower]) {
        return false;
      }
    }
    const dynamicDict = this.currentDictionarySubject.value;
    if (dynamicDict && (dynamicDict[text] || this.findInDictionary(dynamicDict, text))) {
      return false;
    }
    // Starts with uppercase, single or multiple words without standard UI punctuation
    return /^[A-Z][a-zA-Z0-9.\-_']+(\s[A-Z][a-zA-Z0-9.\-_']*)*$/.test(text);
  }

  private findInDictionary(dict: Record<string, any>, text: string): string | undefined {
    if (!dict || !text) return undefined;
    const lower = text.toLowerCase();
    for (const key of Object.keys(dict)) {
      if (typeof dict[key] === 'string' && key.toLowerCase() === lower) {
        return dict[key];
      }
    }
    return undefined;
  }

  private applyParams(text: string, params?: Record<string, any>): string {
    if (!params || !text) return text;
    let result = text;
    Object.keys(params).forEach((paramKey) => {
      result = result.replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), String(params[paramKey]));
    });
    return result;
  }

  private async setLanguageInternal(lang: SupportedLanguage | string): Promise<void> {
    try {
      const dict = await firstValueFrom(this.loader.loadLanguage(lang));
      this.currentDictionarySubject.next(dict || {});
    } catch (e) {
      this.currentDictionarySubject.next({});
    } finally {
      this.currentLanguageSubject.next(lang);
    }
  }

  private getNestedValue(obj: any, key: string): any {
    if (!obj || !key) return undefined;
    return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
  }
}
