import { Component, OnInit, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { 
  BookingService, 
  Booking, 
  LiveTrackingData, 
  AllocationProgressData, 
  InvoiceData 
} from '../../core/services/booking.service';
import { WebSocketService, BookingLifecycleEvent } from '../../core/services/websocket.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

declare var L: any;

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, BottomNavComponent],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss'
})
export class BookingsComponent implements OnInit, OnDestroy {
  public themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);
  private bookingService = inject(BookingService);
  private wsService = inject(WebSocketService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  activeTab: 'Ongoing' | 'Completed' | 'Cancelled' = 'Ongoing';
  activeDetailView: 'NONE' | 'SCHEDULED' | 'SEARCHING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' = 'NONE';
  
  bookingsList: Booking[] = [];
  filteredBookings: Booking[] = [];
  selectedBooking: Booking | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';

  // Searching & Allocation Progress
  allocationProgress: AllocationProgressData | null = null;

  // Live Tracking state
  liveTracking: LiveTrackingData | null = null;
  map: any = null;
  driverMarker: any = null;
  pickupMarker: any = null;
  dropMarker: any = null;
  routePolyline: any = null;

  // Driver Tipping state
  selectedTipAmount: number = 30;
  customTipAmount: number | null = null;
  isTipSubmitting: boolean = false;
  tipSuccessMessage: string = '';

  // Invoice State
  invoiceData: InvoiceData | null = null;
  showInvoiceModal: boolean = false;
  isLoadingInvoice: boolean = false;

  // Cancellation State
  showCancelModal: boolean = false;
  cancelReason: string = 'Changed plans';
  isCancelling: boolean = false;

  private wsSubscription: Subscription | null = null;
  private pollInterval: any = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Connect WebSocket
    const user = this.authService.getUser();
    this.wsService.connect(user?.id);

    // Subscribe to STOMP lifecycle events
    this.wsSubscription = this.wsService.bookingEvents$.subscribe({
      next: (event: BookingLifecycleEvent) => {
        this.handleWebSocketEvent(event);
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const t = params['tab'];
        if (t === 'Ongoing' || t === 'Completed' || t === 'Cancelled') {
          this.activeTab = t;
        }
      }
      const activeId = params['activeId'];
      this.fetchBookings(activeId ? Number(activeId) : undefined);
    });
  }

  fetchBookings(autoSelectId?: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.bookingService.getMyBookings().subscribe({
      next: (res) => {
        this.isLoading = false;
        const list = res?.data || (Array.isArray(res) ? res : []);
        this.bookingsList = Array.isArray(list) ? list : [];
        this.applyTabFilter();

        if (autoSelectId) {
          const found = this.bookingsList.find(b => b.id === autoSelectId);
          if (found) {
            this.openBookingDetail(found);
          }
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load bookings. Please check connection.';
        console.error('Failed to load bookings:', err);
      }
    });
  }

  setTab(tab: 'Ongoing' | 'Completed' | 'Cancelled'): void {
    this.activeTab = tab;
    this.activeDetailView = 'NONE';
    this.selectedBooking = null;
    this.applyTabFilter();
  }

  applyTabFilter(): void {
    if (this.activeTab === 'Ongoing') {
      const ongoingStatuses = [
        'PENDING', 'CONFIRMED', 'SCHEDULED', 'SEARCHING_DRIVER', 
        'ASSIGNED', 'ACCEPTED', 'DRIVER_ON_THE_WAY', 'ARRIVED', 
        'STARTED', 'IN_PROGRESS'
      ];
      this.filteredBookings = this.bookingsList.filter(b => 
        ongoingStatuses.includes((b.status || '').toUpperCase())
      );
    } else if (this.activeTab === 'Completed') {
      this.filteredBookings = this.bookingsList.filter(b => 
        (b.status || '').toUpperCase() === 'COMPLETED'
      );
    } else if (this.activeTab === 'Cancelled') {
      const cancelledStatuses = ['CANCELLED', 'REJECTED', 'NO_DRIVER_AVAILABLE', 'EXPIRED'];
      this.filteredBookings = this.bookingsList.filter(b => 
        cancelledStatuses.includes((b.status || '').toUpperCase())
      );
    }
  }

  openBookingDetail(b: Booking): void {
    this.selectedBooking = b;
    this.tipSuccessMessage = '';
    const st = (b.status || '').toUpperCase();

    // Subscribe to WebSocket updates for this specific booking
    this.wsService.subscribeToBooking(b.id);

    if (st === 'SCHEDULED') {
      this.activeDetailView = 'SCHEDULED';
    } else if (st === 'SEARCHING_DRIVER' || st === 'CONFIRMED' || st === 'PENDING') {
      this.activeDetailView = 'SEARCHING';
      this.fetchAllocationProgress(b.id);
      this.startRecoveryPolling(b.id);
    } else if (['ASSIGNED', 'ACCEPTED', 'DRIVER_ON_THE_WAY', 'ARRIVED', 'STARTED', 'IN_PROGRESS'].includes(st)) {
      this.activeDetailView = 'IN_PROGRESS';
      this.fetchLiveTracking(b.id);
      this.startRecoveryPolling(b.id);
    } else if (st === 'COMPLETED') {
      this.activeDetailView = 'COMPLETED';
    } else {
      this.activeDetailView = 'CANCELLED';
    }
  }

  closeDetailView(): void {
    if (this.selectedBooking) {
      this.wsService.unsubscribeFromBooking(this.selectedBooking.id);
    }
    this.stopRecoveryPolling();
    this.activeDetailView = 'NONE';
    this.selectedBooking = null;
    this.liveTracking = null;
    this.allocationProgress = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  fetchAllocationProgress(bookingId: number): void {
    this.bookingService.getAllocationProgress(bookingId).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.allocationProgress = res.data;
          if (this.allocationProgress.driverAssigned && this.selectedBooking) {
            this.selectedBooking.status = 'ASSIGNED';
            this.openBookingDetail(this.selectedBooking);
          }
        }
      }
    });
  }

  fetchLiveTracking(bookingId: number): void {
    this.bookingService.getLiveTracking(bookingId).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.liveTracking = res.data;
          setTimeout(() => this.initLeafletMap(), 200);
        }
      }
    });
  }

  startRecoveryPolling(bookingId: number): void {
    this.stopRecoveryPolling();
    // REST recovery poll every 7 seconds in case WS is dropped
    this.pollInterval = setInterval(() => {
      if (this.selectedBooking && this.selectedBooking.id === bookingId) {
        this.bookingService.getBookingById(bookingId).subscribe({
          next: (res) => {
            const updated = res?.data;
            if (updated && updated.status !== this.selectedBooking?.status) {
              this.selectedBooking = updated;
              this.openBookingDetail(updated);
            }
          }
        });
      }
    }, 7000);
  }

  stopRecoveryPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  handleWebSocketEvent(event: BookingLifecycleEvent): void {
    console.log('[Rentron Bookings] WS event received:', event);
    if (!event || !this.selectedBooking) return;

    if (event.bookingId === this.selectedBooking.id) {
      const newStatus = event.eventType;
      this.selectedBooking.status = newStatus;

      if (newStatus === 'DRIVER_ASSIGNED' || newStatus === 'ASSIGNED' || newStatus === 'DRIVER_ON_THE_WAY' || newStatus === 'ARRIVED' || newStatus === 'STARTED') {
        this.activeDetailView = 'IN_PROGRESS';
        this.fetchLiveTracking(this.selectedBooking.id);
      } else if (newStatus === 'DRIVER_LOCATION_UPDATED') {
        const payload = event.payload || {};
        if (payload.driverLatitude && payload.driverLongitude && this.driverMarker) {
          this.driverMarker.setLatLng([payload.driverLatitude, payload.driverLongitude]);
        }
      } else if (newStatus === 'COMPLETED') {
        this.activeDetailView = 'COMPLETED';
        this.fetchBookings();
      } else if (newStatus === 'CANCELLED' || newStatus === 'NO_DRIVER_AVAILABLE') {
        this.activeDetailView = 'CANCELLED';
        this.fetchBookings();
      }
    } else {
      // Background update for non-selected booking
      const item = this.bookingsList.find(b => b.id === event.bookingId);
      if (item) {
        item.status = event.eventType;
        this.applyTabFilter();
      }
    }
  }

  initLeafletMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const L = (window as any).L;
    if (!L) return;

    const el = document.getElementById('trackingMapContainer');
    if (!el) return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const pLat = this.selectedBooking?.pickupLatitude || 12.9226;
    const pLng = this.selectedBooking?.pickupLongitude || 80.1275;
    const dLat = this.selectedBooking?.dropLatitude || 13.6288;
    const dLng = this.selectedBooking?.dropLongitude || 79.4192;

    this.map = L.map(el, {
      zoomControl: false,
      attributionControl: false
    }).setView([(pLat + dLat) / 2, (pLng + dLng) / 2], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    // Custom Marker Icons
    const carIcon = L.divIcon({
      className: 'driver-car-icon',
      html: `<div style="background:#f59e0b;color:#000;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 4px 12px rgba(245,158,11,0.5);">🚖</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const pickupIcon = L.divIcon({
      className: 'pickup-dot-icon',
      html: `<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 8px rgba(34,197,94,0.5);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const destIcon = L.divIcon({
      className: 'dest-dot-icon',
      html: `<div style="background:#ef4444;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 8px rgba(239,68,68,0.5);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const drvLat = this.liveTracking?.driverLatitude || pLat + 0.005;
    const drvLng = this.liveTracking?.driverLongitude || pLng + 0.005;

    this.pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon }).addTo(this.map);
    this.dropMarker = L.marker([dLat, dLng], { icon: destIcon }).addTo(this.map);
    this.driverMarker = L.marker([drvLat, drvLng], { icon: carIcon }).addTo(this.map);

    // Route Polyline
    this.routePolyline = L.polyline([
      [drvLat, drvLng],
      [pLat, pLng],
      [dLat, dLng]
    ], {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.85,
      dashArray: '6, 8'
    }).addTo(this.map);

    this.map.fitBounds([
      [pLat, pLng],
      [dLat, dLng],
      [drvLat, drvLng]
    ], { padding: [40, 40] });
  }

  // Driver Tipping Flow
  selectTip(amount: number): void {
    this.selectedTipAmount = amount;
    this.customTipAmount = null;
  }

  submitDriverTip(): void {
    if (!this.selectedBooking) return;
    const tip = this.customTipAmount || this.selectedTipAmount;
    if (tip <= 0) return;

    this.isTipSubmitting = true;
    this.bookingService.addTip(this.selectedBooking.id, tip).subscribe({
      next: (res) => {
        this.isTipSubmitting = false;
        this.tipSuccessMessage = `₹${tip} tip added successfully! Thank you for appreciating your driver.`;
        if (this.selectedBooking) {
          this.selectedBooking.driverTip = tip;
          this.selectedBooking.totalAmount = (this.selectedBooking.totalAmount || 0) + tip;
        }
      },
      error: (err) => {
        this.isTipSubmitting = false;
        this.tipSuccessMessage = 'Tip recorded.';
      }
    });
  }

  // Invoice Download / View Flow
  downloadInvoice(bookingId: number): void {
    this.isLoadingInvoice = true;
    this.bookingService.getInvoice(bookingId).subscribe({
      next: (res) => {
        this.isLoadingInvoice = false;
        if (res && res.data) {
          this.invoiceData = res.data;
          this.showInvoiceModal = true;
        }
      },
      error: () => {
        this.isLoadingInvoice = false;
      }
    });
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.invoiceData = null;
  }

  printInvoice(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  // Cancellation Flow
  promptCancel(): void {
    this.showCancelModal = true;
  }

  confirmCancellation(): void {
    if (!this.selectedBooking) return;
    this.isCancelling = true;

    this.bookingService.cancelBooking(this.selectedBooking.id, this.cancelReason).subscribe({
      next: (res) => {
        this.isCancelling = false;
        this.showCancelModal = false;
        if (this.selectedBooking) {
          this.selectedBooking.status = 'CANCELLED';
          this.selectedBooking.cancellationReason = this.cancelReason;
        }
        this.activeDetailView = 'CANCELLED';
        this.fetchBookings();
      },
      error: (err) => {
        this.isCancelling = false;
        this.showCancelModal = false;
        if (this.selectedBooking) {
          this.selectedBooking.status = 'CANCELLED';
        }
        this.activeDetailView = 'CANCELLED';
      }
    });
  }

  getStatusBadgeClass(status?: string): string {
    const s = (status || '').toUpperCase();
    if (['CONFIRMED', 'STARTED', 'IN_PROGRESS', 'ARRIVED'].includes(s)) return 'badge-active';
    if (['SCHEDULED'].includes(s)) return 'badge-scheduled';
    if (['COMPLETED'].includes(s)) return 'badge-completed';
    if (['CANCELLED', 'REJECTED', 'NO_DRIVER_AVAILABLE'].includes(s)) return 'badge-cancelled';
    return 'badge-searching';
  }

  ngOnDestroy(): void {
    this.stopRecoveryPolling();
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    if (this.selectedBooking) {
      this.wsService.unsubscribeFromBooking(this.selectedBooking.id);
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
