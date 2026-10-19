import { Component, OnInit, AfterViewInit, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookingService, LiveTrackingData, Booking } from '../../core/services/booking.service';
import { WebSocketService, BookingLifecycleEvent } from '../../core/services/websocket.service';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

declare var L: any;

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [CommonModule, FormsModule, BottomNavComponent],
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

  // Radar & Search States (Screenshot 3)
  radarState: 'SEARCHING' | 'NO_DRIVERS' | 'CONFIRMED' | 'CANCELLED' | 'SCHEDULED' | 'PAY_FOR_RIDE' | 'PAYMENT_DONE' | 'RATING' = 'SEARCHING';
  selectedDriverTip: number = 20;
  driverRatingScore: number = 5;
  driverRatingNote: string = '';
  selectedAddonTip: number = 30;
  addonTipOptions: number[] = [20, 30, 40, 50];
  searchTimeoutHandle: any = null;

  // In-app chat message
  driverChatMessage: string = '';
  chatSentNotification: boolean = false;

  // Cancellation Flow Modals (Screenshots 4 & 5)
  showTripDetailsSheet: boolean = false;
  showCancelReasonSheet: boolean = false;
  showDriverNearWarning: boolean = false;
  selectedCancelReason: string = 'Pick up location issue';
  cancellationReasons: string[] = [
    'Site clearance postponed',
    'Too high price',
    'Pick up location issue',
    'Driver not moving'
  ];

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
          ['PENDING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'DRIVER_ON_THE_WAY', 'ARRIVED', 'STARTED', 'IN_PROGRESS'].includes((b.status || '').toUpperCase())
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
          this.evaluateRadarState();
        }
      }
    });

    this.bookingService.getLiveTracking(id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.liveTracking = res.data;
          this.evaluateRadarState();
          if (this.radarState === 'CONFIRMED') {
            setTimeout(() => this.initOrUpdateMap(), 250);
          }
        }
      }
    });

    // Start background REST recovery interval
    this.startRecoveryInterval(id);
  }

  evaluateRadarState(): void {
    const status = (this.booking?.status || '').toUpperCase();
    if (status === 'CANCELLED') {
      this.radarState = 'CANCELLED';
      if (this.searchTimeoutHandle) clearTimeout(this.searchTimeoutHandle);
      return;
    }

    if (status === 'COMPLETED') {
      this.radarState = 'PAY_FOR_RIDE';
      if (this.searchTimeoutHandle) clearTimeout(this.searchTimeoutHandle);
      return;
    }

    if (status === 'SCHEDULED' && (!this.liveTracking?.driverName || !this.booking?.driverId)) {
      this.radarState = 'SCHEDULED';
      if (this.searchTimeoutHandle) clearTimeout(this.searchTimeoutHandle);
      return;
    }

    if (['ASSIGNED', 'ACCEPTED', 'DRIVER_ON_THE_WAY', 'ARRIVED', 'STARTED', 'IN_PROGRESS'].includes(status) || this.liveTracking?.driverName) {
      this.radarState = 'CONFIRMED';
      if (this.searchTimeoutHandle) clearTimeout(this.searchTimeoutHandle);
      setTimeout(() => this.initOrUpdateMap(), 250);
    } else {
      this.radarState = 'SEARCHING';
      this.startSearchTimeout();
    }
  }

  startSearchTimeout(): void {
    if (this.searchTimeoutHandle) clearTimeout(this.searchTimeoutHandle);
    // After 14 seconds of searching without driver accept, transition to NO_DRIVERS fallback
    this.searchTimeoutHandle = setTimeout(() => {
      if (this.radarState === 'SEARCHING') {
        this.radarState = 'NO_DRIVERS';
      }
    }, 14000);
  }

  selectAddonTip(amount: number): void {
    this.selectedAddonTip = amount;
  }

  retrySearchWithTip(): void {
    if (this.bookingId && this.selectedAddonTip > 0) {
      this.bookingService.addTip(this.bookingId, this.selectedAddonTip).subscribe({
        next: () => {
          this.radarState = 'SEARCHING';
          this.startSearchTimeout();
        },
        error: () => {
          this.radarState = 'SEARCHING';
          this.startSearchTimeout();
        }
      });
    } else {
      this.radarState = 'SEARCHING';
      this.startSearchTimeout();
    }
  }

  startRecoveryInterval(id: number): void {
    if (this.recoveryInterval) clearInterval(this.recoveryInterval);
    this.recoveryInterval = setInterval(() => {
      this.bookingService.getLiveTracking(id).subscribe({
        next: (res) => {
          if (res && res.data) {
            this.liveTracking = res.data;
            if (this.radarState !== 'CONFIRMED') {
              this.evaluateRadarState();
            }
            if (this.vehicleMarker && this.liveTracking.driverLatitude && this.liveTracking.driverLongitude) {
              this.vehicleMarker.setLatLng([this.liveTracking.driverLatitude, this.liveTracking.driverLongitude]);
            }
          }
        }
      });
    }, 6000);
  }

  handleWebSocketEvent(event: BookingLifecycleEvent): void {
    if (!event || event.bookingId !== this.bookingId) return;

    if (event.eventType === 'DRIVER_LOCATION_UPDATED') {
      const p = event.payload || {};
      if (p.driverLatitude && p.driverLongitude && this.vehicleMarker) {
        this.vehicleMarker.setLatLng([p.driverLatitude, p.driverLongitude]);
      }
    } else if (event.eventType === 'ASSIGNED' || event.eventType === 'ACCEPTED') {
      this.radarState = 'CONFIRMED';
      if (this.searchTimeoutHandle) clearTimeout(this.searchTimeoutHandle);
      this.loadActiveBookingTracking(this.bookingId!);
    } else if (event.eventType === 'ARRIVED') {
      this.showArrivedNotification = true;
      if (this.booking) this.booking.status = 'ARRIVED';
    } else if (event.eventType === 'STARTED') {
      if (this.booking) this.booking.status = 'STARTED';
      this.showArrivedNotification = false;
    } else if (event.eventType === 'COMPLETED') {
      if (this.booking) this.booking.status = 'COMPLETED';
      this.radarState = 'PAY_FOR_RIDE';
    } else if (event.eventType === 'CANCELLED') {
      this.radarState = 'CANCELLED';
    }
  }

  ngAfterViewInit(): void {
    if (this.hasActiveJob && this.radarState === 'CONFIRMED') {
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
    const dLat = this.booking?.dropLatitude || this.liveTracking?.dropLatitude || 12.9200;
    const dLng = this.booking?.dropLongitude || this.liveTracking?.dropLongitude || 80.1250;
    const drvLat = this.liveTracking?.driverLatitude || (pLat + 0.003);
    const drvLng = this.liveTracking?.driverLongitude || (pLng + 0.003);

    this.leafletMap = L.map(container, {
      zoomControl: false,
      attributionControl: false
    }).setView([(pLat + drvLat) / 2, (pLng + drvLng) / 2], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.leafletMap);

    // Custom Map Markers matching Figma
    const vehicleIcon = L.divIcon({
      className: 'vehicle-map-pin',
      html: '<div style="background:#f59e0b;color:#000;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(245,158,11,0.5);">🚖</div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const pickupIcon = L.divIcon({
      className: 'pickup-map-pin',
      html: '<div style="background:#10b981;width:24px;height:24px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(16,185,129,0.5);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const destIcon = L.divIcon({
      className: 'dest-map-pin',
      html: '<div style="background:#ef4444;width:24px;height:24px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(239,68,68,0.5);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon }).addTo(this.leafletMap);
    this.dropMarker = L.marker([dLat, dLng], { icon: destIcon }).addTo(this.leafletMap);
    this.vehicleMarker = L.marker([drvLat, drvLng], { icon: vehicleIcon }).addTo(this.leafletMap);

    const sLat = this.booking?.stopLatitude || (this.liveTracking as any)?.stopLatitude;
    const sLng = this.booking?.stopLongitude || (this.liveTracking as any)?.stopLongitude;
    const sAddr = this.booking?.stopAddressText || (this.liveTracking as any)?.stopAddressText;

    if (sLat && sLng) {
      const stopIcon = L.divIcon({
        className: 'stop-map-pin',
        html: '<div style="background:#f59e0b;color:#fff;width:26px;height:26px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(245,158,11,0.5);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;">S</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker([sLat, sLng], { icon: stopIcon }).addTo(this.leafletMap).bindPopup('Stop: ' + (sAddr || 'Intermediate Stop'));
    }

    const routeCoords: any[] = [[drvLat, drvLng], [pLat, pLng]];
    if (sLat && sLng) {
      routeCoords.push([sLat, sLng]);
    }
    routeCoords.push([dLat, dLng]);

    this.polylineRoute = L.polyline(routeCoords, {
      color: '#f59e0b',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      dashArray: '6, 8'
    }).addTo(this.leafletMap);

    try {
      this.leafletMap.fitBounds([
        [pLat, pLng],
        [drvLat, drvLng]
      ], { padding: [50, 50] });
    } catch (e) {}
  }

  
  get driverVehiclePlate(): string {
    return (this.liveTracking as any)?.vehicleRegistration || 'TS 34 T 7080';
  }

  get driverVehicleModel(): string {
    return this.liveTracking?.vehicleType || 'White • Toyota Innova';
  }

  get driverName(): string {
    return this.liveTracking?.driverName || 'Naresh S';
  }

  get driverHeadingMessage(): string {
    return (this.liveTracking as any)?.driverHeadingMessage || '';
  }

  get isScheduledDateReached(): boolean {
    if (!this.booking?.scheduledPickupAt) return true;
    const sched = new Date(this.booking.scheduledPickupAt).getTime();
    const now = Date.now();
    return (sched - now) <= 30 * 60 * 1000;
  }

  get driverRating(): number | string {
    return this.liveTracking?.driverRating || '4.8';
  }

  recenterTrackingMap(): void {
    if (this.leafletMap && this.vehicleMarker) {
      this.leafletMap.setView(this.vehicleMarker.getLatLng(), 16);
    }
  }

  sendChatMessage(): void {
    if (!this.driverChatMessage.trim()) return;
    this.chatSentNotification = true;
    setTimeout(() => {
      this.driverChatMessage = '';
      this.chatSentNotification = false;
    }, 2000);
  }

  // Cancellation Flow Methods (Screenshots 4 & 5)
  openTripDetails(): void {
    this.showTripDetailsSheet = true;
  }

  closeTripDetails(): void {
    this.showTripDetailsSheet = false;
  }

  openCancelReasons(): void {
    this.showTripDetailsSheet = false;
    this.showCancelReasonSheet = true;
  }

  closeCancelReasons(): void {
    this.showCancelReasonSheet = false;
  }

  selectCancelReason(reason: string): void {
    this.selectedCancelReason = reason;
    this.showCancelReasonSheet = false;
    // Check if driver is close (< 4 min away) as in Screenshot 5
    this.showDriverNearWarning = true;
  }

  confirmFinalCancellation(): void {
    this.showDriverNearWarning = false;
    if (this.bookingId) {
      this.bookingService.cancelBooking(this.bookingId, this.selectedCancelReason).subscribe({
        next: () => {
          this.radarState = 'CANCELLED';
        },
        error: () => {
          this.radarState = 'CANCELLED';
        }
      });
    } else {
      this.radarState = 'CANCELLED';
    }
  }

  findAnotherDriver(): void {
    this.showDriverNearWarning = false;
    this.radarState = 'SEARCHING';
    this.startSearchTimeout();
  }

  bookAnotherRide(): void {
    this.router.navigate(['/booking']);
  }

  closeArrivedNotification(): void {
    this.showArrivedNotification = false;
  }

  goToBookings(): void {
    this.router.navigate(['/bookings']);
  }

  
  selectDriverTip(amt: number): void {
    this.selectedDriverTip = amt;
  }

  setDriverRating(score: number): void {
    this.driverRatingScore = score;
  }

  processPayment(): void {
    this.radarState = 'PAYMENT_DONE';
  }

  finishPaymentAndRate(): void {
    this.radarState = 'RATING';
  }

  submitRatingAndComplete(): void {
    this.router.navigate(['/bookings'], { queryParams: { tab: 'Completed', activeId: this.bookingId } });
  }

  cancelScheduledRide(): void {
    if (this.bookingId) {
      this.bookingService.cancelBooking(this.bookingId, 'Customer cancelled scheduled ride').subscribe({
        next: () => {
          this.radarState = 'CANCELLED';
        },
        error: () => {
          this.radarState = 'CANCELLED';
        }
      });
    }
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  ngOnDestroy(): void {
    if (this.searchTimeoutHandle) {
      clearTimeout(this.searchTimeoutHandle);
    }
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
