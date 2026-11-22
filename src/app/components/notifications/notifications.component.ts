import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NotificationService, AppNotification } from '../../core/services/notification.service';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, BottomNavComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent {
  notificationService = inject(NotificationService);
  router = inject(Router);
  location = inject(Location);
  public themeService = inject(ThemeService);

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/home']);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  onNotificationTap(notif: AppNotification): void {
    if (notif.isUnread) {
      this.notificationService.toggleReadStatus(notif.id);
    }
    if (notif.type === 'confirmed') {
      this.router.navigate(['/bookings']);
    } else if (notif.type === 'offer') {
      this.router.navigate(['/booking']);
    }
  }
}
