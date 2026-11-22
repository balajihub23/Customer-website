import { Directive, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LanguageManagerService } from '../language-manager.service';

interface ManagedTextNode {
  node: Node;
  originalText: string;
}

@Directive({
  selector: '[autoTranslate]',
  standalone: true
})
export class AutoTranslateDirective implements OnInit, OnDestroy {
  private managedNodes: ManagedTextNode[] = [];
  private subscription?: Subscription;

  constructor(
    private el: ElementRef,
    private languageManager: LanguageManagerService
  ) {}

  ngOnInit(): void {
    this.extractTextNodes(this.el.nativeElement);

    this.subscription = this.languageManager.currentDictionary$.subscribe(() => {
      this.translateAllNodes();
    });
  }

  private extractTextNodes(element: Node): void {
    if (element.nodeType === Node.TEXT_NODE) {
      const text = element.textContent ? element.textContent.trim() : '';
      if (text.length > 0) {
        this.managedNodes.push({
          node: element,
          originalText: element.textContent || ''
        });
      }
    } else if (element.nodeType === Node.ELEMENT_NODE) {
      const tagName = (element as HTMLElement).tagName;
      if (tagName !== 'SCRIPT' && tagName !== 'STYLE') {
        for (let i = 0; i < element.childNodes.length; i++) {
          this.extractTextNodes(element.childNodes[i]);
        }
      }
    }
  }

  private translateAllNodes(): void {
    this.managedNodes.forEach((item) => {
      const trimmed = item.originalText.trim();
      if (!trimmed) return;

      this.languageManager.translateAuto(trimmed).subscribe((translated) => {
        if (translated) {
          const leadingSpace = item.originalText.match(/^\s*/)?.[0] || '';
          const trailingSpace = item.originalText.match(/\s*$/)?.[0] || '';
          item.node.textContent = leadingSpace + translated + trailingSpace;
        }
      });
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
