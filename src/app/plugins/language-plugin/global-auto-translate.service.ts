import { ApplicationRef, Injectable, NgZone } from '@angular/core';
import { Subscription } from 'rxjs';
import { LanguageManagerService } from './language-manager.service';
import { SupportedLanguage } from './language.models';

interface StoredNodeData {
  originalText: string;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalAutoTranslateService {
  private nodeMap = new WeakMap<Node, StoredNodeData>();
  private trackedTextNodes: Set<Node> = new Set();
  private observer?: MutationObserver;
  private subscription?: Subscription;
  private isTranslating = false;

  constructor(
    private languageManager: LanguageManagerService,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {}

  startGlobalAutoTranslate(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    this.setupObserver();

    this.subscription = this.languageManager.currentLanguage$.subscribe(() => {
      this.forceReTranslate();
    });
  }

  stopGlobalAutoTranslate(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  public forceReTranslate(): void {
    if (typeof document === 'undefined') return;

    if (this.observer) {
      this.observer.disconnect();
    }

    this.scanAndTranslateDocument();

    setTimeout(() => {
      this.scanAndTranslateDocument();
      this.setupObserver();
      this.appRef.tick();
    }, 50);
  }

  private setupObserver(): void {
    if (typeof document === 'undefined') return;
    if (this.observer) {
      this.observer.disconnect();
    }

    this.ngZone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => {
        this.scanAndTranslateDocument();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });
  }

  private scanAndTranslateDocument(): void {
    if (this.isTranslating || typeof document === 'undefined') return;
    this.isTranslating = true;

    const currentLang = String(this.languageManager.getCurrentLanguage());

    try {
      this.collectTextNodes(document.body);

      const nodesArray = Array.from(this.trackedTextNodes);

      nodesArray.forEach((node) => {
        if (!node.isConnected) {
          this.trackedTextNodes.delete(node);
          return;
        }

        const data = this.nodeMap.get(node);
        if (!data || !data.originalText) return;

        const original = data.originalText.trim();
        if (!original) return;

        if (currentLang === 'en') {
          if (node.textContent !== data.originalText) {
            node.textContent = data.originalText;
          }
        } else {
          this.languageManager.translateAuto(original).subscribe((translated) => {
            if (translated && node.isConnected) {
              const leading = data.originalText.match(/^\s*/)?.[0] || '';
              const trailing = data.originalText.match(/\s*$/)?.[0] || '';
              const newText = leading + translated + trailing;
              if (node.textContent !== newText) {
                node.textContent = newText;
              }
            }
          });
        }
      });
    } finally {
      this.isTranslating = false;
    }
  }

  private collectTextNodes(element: Node): void {
    if (!element) return;

    if (element.nodeType === Node.TEXT_NODE) {
      const parent = element.parentElement;
      if (parent) {
        const tagName = parent.tagName.toUpperCase();
        if (
          tagName === 'SCRIPT' ||
          tagName === 'STYLE' ||
          tagName === 'CODE' ||
          tagName === 'NOSCRIPT' ||
          parent.closest('app-language-switcher') !== null ||
          parent.closest('app-service-error') !== null ||
          parent.closest('.driver-name') !== null ||
          parent.closest('.user-name') !== null ||
          parent.closest('.customer-name') !== null ||
          parent.closest('.driver-phone') !== null ||
          parent.closest('.user-phone') !== null ||
          parent.closest('.initials-avatar') !== null ||
          parent.closest('.avatar-wrapper') !== null ||
          parent.closest('.notranslate') !== null ||
          parent.hasAttribute('notranslate') ||
          parent.getAttribute('translate') === 'no' ||
          parent.classList.contains('driver-name') ||
          parent.classList.contains('user-name') ||
          parent.classList.contains('customer-name') ||
          parent.classList.contains('driver-phone') ||
          parent.classList.contains('user-phone') ||
          parent.classList.contains('notranslate') ||
          parent.classList.contains('lang-native') ||
          parent.classList.contains('lang-name') ||
          parent.classList.contains('sheet-title')
        ) {
          return;
        }
      }

      const text = element.textContent || '';
      if (text.trim().length > 0) {
        if (!this.nodeMap.has(element)) {
          this.nodeMap.set(element, { originalText: text });
          this.trackedTextNodes.add(element);
        }
      }
    } else if (element.nodeType === Node.ELEMENT_NODE) {
      const el = element as HTMLElement;
      const tagName = el.tagName.toUpperCase();
      if (
        tagName !== 'SCRIPT' &&
        tagName !== 'STYLE' &&
        tagName !== 'CODE' &&
        tagName !== 'NOSCRIPT' &&
        !el.closest('app-language-switcher') &&
        !el.closest('app-service-error') &&
        !el.closest('.driver-name') &&
        !el.closest('.user-name') &&
        !el.closest('.customer-name') &&
        !el.closest('.driver-phone') &&
        !el.closest('.user-phone') &&
        !el.closest('.initials-avatar') &&
        !el.closest('.notranslate') &&
        !el.hasAttribute('notranslate') &&
        el.getAttribute('translate') !== 'no' &&
        !el.classList.contains('driver-name') &&
        !el.classList.contains('user-name') &&
        !el.classList.contains('customer-name') &&
        !el.classList.contains('notranslate') &&
        !el.classList.contains('lang-option-card')
      ) {
        for (let i = 0; i < element.childNodes.length; i++) {
          this.collectTextNodes(element.childNodes[i]);
        }
      }
    }
  }
}
