import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { CustomerService } from '../../../core/services/customer.service';
import { LogoutModalComponent } from '../logout-modal/logout-modal.component';

@Component({
  selector: 'app-customer-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LogoutModalComponent],
  templateUrl: './customer-header.component.html',
  styleUrl: './customer-header.component.scss'
})
export class CustomerHeaderComponent implements OnInit {
  @Input() customerName: string = '';
  @Input() userName: string = '';
  @Input() locationName: string = '';
  @Input() currentLocation: string = '';

  @Output() locationClick = new EventEmitter<void>();
  @Output() onLocationClick = new EventEmitter<void>();

  notificationService = inject(NotificationService);
  themeService = inject(ThemeService);
  authService = inject(AuthService);
  customerService = inject(CustomerService);
  router = inject(Router);

  showLogoutModal: boolean = false;
  showNotificationsModal: boolean = false;

  fetchedCustomerName: string = '';
  fetchedLocation: string = '';

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.fetchedCustomerName = '';
      return;
    }

    const user = this.authService.getUser();
    if (user && (user.fullName || user.name || user.firstName)) {
      this.fetchedCustomerName = user.fullName || user.name || user.firstName;
    }

    this.customerService.getProfile().subscribe({
      next: (profile: any) => {
        const data = profile?.data || profile;
        if (data && data.fullName) {
          this.fetchedCustomerName = data.fullName;
        }
      },
      error: (err) => {
        if (err.status === 401) {
          this.authService.clearSession();
          this.router.navigate(['/splash']);
        }
      }
    });

    this.customerService.getSavedAddresses().subscribe({
      next: (res: any) => {
        const list = res?.data || res;
        if (Array.isArray(list) && list.length > 0) {
          const defaultSite = list.find((s: any) => s.isDefault) || list[0];
          this.fetchedLocation = defaultSite.nickname || defaultSite.addressLine1 || defaultSite.address || defaultSite.label || '';
        }
      }
    });
  }

  get greetingTime(): string {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good Morning';
    } else if (hour < 17) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  }

  get displayName(): string {
    return this.fetchedCustomerName || this.userName || this.customerName || 'Customer';
  }

  get displayLocation(): string {
    return this.currentLocation || this.locationName || this.fetchedLocation || 'Select Location';
  }

  handleLocationClick(): void {
    this.locationClick.emit();
    this.onLocationClick.emit();
  }

  toggleNotifications(): void {
    this.showNotificationsModal = !this.showNotificationsModal;
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  onLogout(): void {
    this.showLogoutModal = true;
  }

  cancelLogout(): void {
    this.showLogoutModal = false;
  }

  confirmLogout(): void {
    this.showLogoutModal = false;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth']),
      error: () => {
        this.authService.clearSession();
        this.router.navigate(['/auth']);
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
