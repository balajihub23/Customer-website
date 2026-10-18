import { Component, OnInit, AfterViewInit, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookingService, LiveTrackingData, Booking } from '../../core/services/booking.service';
import { WebSocketService, BookingLifecycleEvent } from '../../core/services/websocket.service';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

declare var L: any;

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [CommonModule, BottomNavComponent],
  templateUrl: './track.component.html',
  styleUrl: './track.component.scss'
})
export class TrackComponent implements OnInit, AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingService);
  private wsService = inject(WebSocketService);

  bookingId: number | null = null;
  booking: Booking | null = null;
  liveTracking: LiveTrackingData | null = null;
  hasActiveJob: boolean = false;
  isLoading: boolean = false;
  showArrivedNotification: boolean = false;

  private leafletMap: any = null;
  private vehicleMarker: any = null;
  private pickupMarker: any = null;
  private dropMarker: any = null;
  private polylineRoute: any = null;
  private wsSubscription: Subscription | null = null;
  private recoveryInterval: any = null;

  ngOnInit(): void {
    this.wsService.connect();

    this.wsSubscription = this.wsService.bookingEvents$.subscribe({
      next: (event: BookingLifecycleEvent) => {
        this.handleWebSocketEvent(event);
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['bookingId']) {
        this.bookingId = Number(params['bookingId']);
        this.loadActiveBookingTracking(this.bookingId);
      } else {
        // Look for any ongoing booking
        this.loadLatestOngoingBooking();
      }
    });
  }

  loadLatestOngoingBooking(): void {
    this.isLoading = true;
    this.bookingService.getMyBookings().subscribe({
      next: (res) => {
        this.isLoading = false;
        const list = res?.data || (Array.isArray(res) ? res : []);
        const ongoing = list.find((b: Booking) => 
          ['ASSIGNED', 'ACCEPTED', 'DRIVER_ON_THE_WAY', 'ARRIVED', 'STARTED', 'IN_PROGRESS'].includes((b.status || '').toUpperCase())
        );

        if (ongoing) {
          this.bookingId = ongoing.id;
          this.booking = ongoing;
          this.hasActiveJob = true;
          this.loadActiveBookingTracking(ongoing.id);
        } else {
          this.hasActiveJob = false;
        }
      },
      error: () => {
        this.isLoading = false;
        this.hasActiveJob = false;
      }
    });
  }

  loadActiveBookingTracking(id: number): void {
    this.hasActiveJob = true;
    this.wsService.subscribeToBooking(id);

    this.bookingService.getBookingById(id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.booking = res.data;
        }
      }
    });

    this.bookingService.getLiveTracking(id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.liveTracking = res.data;
          this.initOrUpdateMap();
        }
      }
    });

    // Start background REST recovery interval
    this.startRecoveryInterval(id);
  }

  startRecoveryInterval(id: number): void {
    if (this.recoveryInterval) clearInterval(this.recoveryInterval);
    this.recoveryInterval = setInterval(() => {
      this.bookingService.getLiveTracking(id).subscribe({
        next: (res) => {
          if (res && res.data) {
            this.liveTracking = res.data;
            if (this.vehicleMarker && this.liveTracking.driverLatitude && this.liveTracking.driverLongitude) {
              this.vehicleMarker.setLatLng([this.liveTracking.driverLatitude, this.liveTracking.driverLongitude]);
            }
          }
        }
      });
    }, 8000);
  }

  handleWebSocketEvent(event: BookingLifecycleEvent): void {
    if (!event || event.bookingId !== this.bookingId) return;

    if (event.eventType === 'DRIVER_LOCATION_UPDATED') {
      const p = event.payload || {};
      if (p.driverLatitude && p.driverLongitude && this.vehicleMarker) {
        this.vehicleMarker.setLatLng([p.driverLatitude, p.driverLongitude]);
      }
    } else if (event.eventType === 'ARRIVED') {
      this.showArrivedNotification = true;
    } else if (event.eventType === 'COMPLETED') {
      this.router.navigate(['/bookings'], { queryParams: { tab: 'Completed', activeId: this.bookingId } });
    } else if (event.eventType === 'CANCELLED') {
      this.router.navigate(['/bookings'], { queryParams: { tab: 'Cancelled', activeId: this.bookingId } });
    }
  }

  ngAfterViewInit(): void {
    if (this.hasActiveJob) {
      setTimeout(() => this.initOrUpdateMap(), 300);
    }
  }

  initOrUpdateMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById('liveTrackingMap');
    if (!container) return;

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    const pLat = this.booking?.pickupLatitude || this.liveTracking?.pickupLatitude || 12.9226;
    const pLng = this.booking?.pickupLongitude || this.liveTracking?.pickupLongitude || 80.1275;
    const dLat = this.booking?.dropLatitude || this.liveTracking?.dropLatitude || 13.6288;
    const dLng = this.booking?.dropLongitude || this.liveTracking?.dropLongitude || 79.4192;
    const drvLat = this.liveTracking?.driverLatitude || pLat + 0.005;
    const drvLng = this.liveTracking?.driverLongitude || pLng + 0.005;

    this.leafletMap = L.map(container, {
      zoomControl: false,
      attributionControl: false
    }).setView([(pLat + dLat) / 2, (pLng + dLng) / 2], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.leafletMap);

    // Custom Map Markers
    const vehicleIcon = L.divIcon({
      className: 'vehicle-map-pin',
      html: `<div style="background:#f59e0b;color:#000;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(245,158,11,0.5);">🚖</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const pickupIcon = L.divIcon({
      className: 'pickup-map-pin',
      html: `<div style="background:#22c55e;width:26px;height:26px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(34,197,94,0.5);"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const destIcon = L.divIcon({
      className: 'dest-map-pin',
      html: `<div style="background:#ef4444;width:26px;height:26px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(239,68,68,0.5);"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    this.pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon }).addTo(this.leafletMap);
    this.dropMarker = L.marker([dLat, dLng], { icon: destIcon }).addTo(this.leafletMap);
    this.vehicleMarker = L.marker([drvLat, drvLng], { icon: vehicleIcon }).addTo(this.leafletMap);

    this.polylineRoute = L.polyline([
      [drvLat, drvLng],
      [pLat, pLng],
      [dLat, dLng]
    ], {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.85,
      dashArray: '6, 8'
    }).addTo(this.leafletMap);

    this.leafletMap.fitBounds([
      [pLat, pLng],
      [dLat, dLng],
      [drvLat, drvLng]
    ], { padding: [40, 40] });
  }

  closeArrivedNotification(): void {
    this.showArrivedNotification = false;
  }

  goToBookings(): void {
    this.router.navigate(['/bookings']);
  }

  ngOnDestroy(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    if (this.bookingId) {
      this.wsService.unsubscribeFromBooking(this.bookingId);
    }
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
  }
}
