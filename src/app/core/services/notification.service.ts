import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface AppNotification {
  id: number;
  type: 'confirmed' | 'offer' | 'delay' | 'info';
  title: string;
  message: string;
  time: string;
  isUnread: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private readonly baseUrl = environment.serverApi;

  unreadCount = signal<number>(0);
  notifications = signal<AppNotification[]>([]);

  constructor() {
    this.fetchNotifications();
  }

  fetchNotifications(): void {
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      this.loadFallbackNotifications();
      return;
    }

    this.http.get<any>(`${this.baseUrl}/api/v1/notifications/inbox`).subscribe({
      next: (res) => {
        const rawList = res?.data || res || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          const mapped: AppNotification[] = rawList.map((item: any) => ({
            id: item.id,
            type: this.mapType(item.notificationType),
            title: item.title,
            message: item.message,
            time: this.formatTimeAgo(item.createdAt),
            isUnread: item.isRead === false
          }));

          this.notifications.set(mapped);
          this.unreadCount.set(mapped.filter(n => n.isUnread).length);
        } else {
          this.loadFallbackNotifications();
        }
      },
      error: () => {
        this.loadFallbackNotifications();
      }
    });
  }

  markAllAsRead(): void {
    this.unreadCount.set(0);
    this.notifications.update(list => list.map(n => ({ ...n, isUnread: false })));

    if (isPlatformBrowser(this.platformId) && this.authService.getAccessToken()) {
      this.http.post<any>(`${this.baseUrl}/api/v1/notifications/mark-all-read`, {}).subscribe({
        error: (err) => console.warn('Error marking notifications read on backend:', err)
      });
    }
  }

  toggleReadStatus(id: number): void {
    this.notifications.update(list => {
      const updated = list.map(n => n.id === id ? { ...n, isUnread: !n.isUnread } : n);
      this.unreadCount.set(updated.filter(n => n.isUnread).length);
      return updated;
    });

    if (isPlatformBrowser(this.platformId) && this.authService.getAccessToken()) {
      this.http.post<any>(`${this.baseUrl}/api/v1/notifications/mark-read/${id}`, {}).subscribe({
        error: (err) => console.warn('Error toggling notification read status:', err)
      });
    }
  }

  private mapType(nType: string): 'confirmed' | 'offer' | 'delay' | 'info' {
    if (!nType) return 'info';
    const upper = nType.toUpperCase();
    if (upper.includes('BOOKING')) return 'confirmed';
    if (upper.includes('PROMOTION') || upper.includes('OFFER')) return 'offer';
    if (upper.includes('DELAY')) return 'delay';
    return 'info';
  }

  private formatTimeAgo(dateStr: string): string {
    if (!dateStr) return 'Recently';
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHrs < 1) return 'Just now';
      if (diffHrs < 24) return `${diffHrs} hours ago`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return 'Recently';
    }
  }

  private loadFallbackNotifications(): void {
    const defaultItems: AppNotification[] = [
      {
        id: 1,
        type: 'confirmed',
        title: 'Booking Confirmed',
        message: 'Your JCB 3DX booking is confirmed for May 9, 09:00 AM',
        time: '2 hours ago',
        isUnread: true
      },
      {
        id: 2,
        type: 'offer',
        title: 'Special Offer!',
        message: 'Get 20% off on weekend bookings. Use code WEEKEND20',
        time: '1 day ago',
        isUnread: true
      },
      {
        id: 3,
        type: 'delay',
        title: 'Slight Delay',
        message: 'Your vehicle will arrive 15 mins late due to traffic',
        time: '2 days ago',
        isUnread: false
      }
    ];
    this.notifications.set(defaultItems);
    this.unreadCount.set(defaultItems.filter(n => n.isUnread).length);
  }
}

