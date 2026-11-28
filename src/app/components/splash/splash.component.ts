import { Component, OnInit, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash.component.html',
  styleUrl: './splash.component.scss'
})
export class SplashComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  
  // Mode: 'loading' | 'tutorial' | 'welcome'
  currentMode: 'loading' | 'tutorial' | 'welcome' = 'loading';
  currentSlide: number = 0;

  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private isMouseDown: boolean = false;
  private readonly minSwipeDistance: number = 35;

  slides = [
    {
      title: 'Everything You Need, Nearby.',
      description: 'Get access to JCBs, excavators, cranes and more with just a few taps',
      image: 'assets/images/jcb_onboarding.png'
    },
    {
      title: 'Book in Just a Few Taps.',
      description: 'Choose your vehicle or equipment, set your schedule, and confirm your booking.',
      image: 'assets/images/cab_onboarding.png'
    },
    {
      title: 'From Booking to Arrival.',
      description: 'Track your vehicle or operator in real time and stay updated every step of the way.',
      image: 'assets/images/bike_onboarding.png'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const hasSeen = localStorage.getItem('hasSeenSplash');
    if (hasSeen === 'true') {
      // Direct to welcome or home if already logged in
      const token = localStorage.getItem('customer_access_token') || localStorage.getItem('accessToken');
      if (token) {
        this.router.navigate(['/home']);
        return;
      }
      this.currentMode = 'welcome';
      this.cdr.detectChanges();
    } else {
      // Show loading for 1.8 seconds, then tutorial
      setTimeout(() => {
        if (this.currentMode === 'loading') {
          this.currentMode = 'tutorial';
          this.cdr.detectChanges();
        }
      }, 1800);
    }
  }

  nextSlide(): void {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
    } else {
      this.goToWelcome();
    }
    this.cdr.detectChanges();
  }

  prevSlide(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this.cdr.detectChanges();
    }
  }

  goToSlide(index: number): void {
    if (index >= 0 && index < this.slides.length) {
      this.currentSlide = index;
      this.cdr.detectChanges();
    }
  }

  onTouchStart(e: TouchEvent): void {
    if (this.currentMode !== 'tutorial' || !e.touches || e.touches.length === 0) return;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): void {
    if (this.currentMode !== 'tutorial' || !e.changedTouches || e.changedTouches.length === 0) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    this.processSwipe(this.touchStartX, this.touchStartY, endX, endY);
  }

  onMouseDown(e: MouseEvent): void {
    if (this.currentMode !== 'tutorial') return;
    this.isMouseDown = true;
    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
  }

  onMouseUp(e: MouseEvent): void {
    if (!this.isMouseDown || this.currentMode !== 'tutorial') return;
    this.isMouseDown = false;
    this.processSwipe(this.touchStartX, this.touchStartY, e.clientX, e.clientY);
  }

  onMouseLeave(e: MouseEvent): void {
    if (!this.isMouseDown || this.currentMode !== 'tutorial') return;
    this.isMouseDown = false;
    this.processSwipe(this.touchStartX, this.touchStartY, e.clientX, e.clientY);
  }

  private processSwipe(startX: number, startY: number, endX: number, endY: number): void {
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) >= this.minSwipeDistance) {
      if (deltaX < 0) {
        this.nextSlide();
      } else {
        this.prevSlide();
      }
    }
  }

  goToWelcome(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('hasSeenSplash', 'true');
    }
    this.currentMode = 'welcome';
    this.cdr.detectChanges();
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth']);
  }
}
