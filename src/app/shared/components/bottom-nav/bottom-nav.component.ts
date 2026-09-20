import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss'
})
export class BottomNavComponent {
  @Input() activeTab: string = 'HOME';

  isTabActive(tabName: string): boolean {
    return (this.activeTab || '').toString().toUpperCase() === tabName.toUpperCase();
  }
}
