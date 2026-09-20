import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
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
  
  // Mode: 'loading' | 'tutorial' | 'welcome'
  currentMode: 'loading' | 'tutorial' | 'welcome' = 'loading';
  currentSlide: number = 0;

  slides = [
    {
      title: 'Everything You Need, Nearby.',
      subtitle: 'Get access to JCBs, excavators, cranes and more with just a few taps',
      svgType: 'jcb',
      bgColor: '#F4EFEA'
    },
    {
      title: 'Book in Just a Few Taps.',
      subtitle: 'Choose your vehicle or equipment, set your schedule, and confirm your booking.',
      svgType: 'taxi',
      bgColor: '#FFF9E6'
    },
    {
      title: 'From Booking to Arrival.',
      subtitle: 'Track your vehicle or operator in real time and stay updated every step of the way.',
      svgType: 'scooter',
      bgColor: '#F0F4F8'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const hasSeen = localStorage.getItem('hasSeenSplash');
    if (hasSeen === 'true') {
      // Direct to welcome or home if already logged in
      const token = localStorage.getItem('customer_access_token');
      if (token) {
        this.router.navigate(['/home']);
        return;
      }
      this.currentMode = 'welcome';
    } else {
      // Show loading for 2 seconds, then tutorial
      setTimeout(() => {
        this.currentMode = 'tutorial';
      }, 2000);
    }
  }

  nextSlide(): void {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
    } else {
      this.goToWelcome();
    }
  }

  goToWelcome(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('hasSeenSplash', 'true');
    }
    this.currentMode = 'welcome';
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth']);
  }
}
