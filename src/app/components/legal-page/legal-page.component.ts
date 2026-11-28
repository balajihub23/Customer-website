import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss'
})
export class LegalPageComponent implements OnInit {
  private router = inject(Router);
  private location = inject(Location);

  activeTab: 'TERMS' | 'PRIVACY' = 'TERMS';

  ngOnInit(): void {
    const url = this.router.url;
    if (url.includes('privacy')) {
      this.activeTab = 'PRIVACY';
    } else {
      this.activeTab = 'TERMS';
    }
  }

  setTab(tab: 'TERMS' | 'PRIVACY'): void {
    this.activeTab = tab;
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/auth']);
    }
  }
}
