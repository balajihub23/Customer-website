import { Component, OnInit, AfterViewInit, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

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

  hasActiveJob: boolean = true;
  showArrivedNotification: boolean = false;

  activeJobData = {
    operatorName: 'Arun Kumar',
    operatorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    vehicleName: 'JCB 3DX',
    vehicleNumber: 'TN 09 AB 1234',
    status: 'On the way',
    eta: '25 min',
    siteName: 'Metro Construction Site',
    siteAddress: 'Sector 18, Noida, Uttar Pradesh',
    operatorPhone: '+91 98765 12345',
    startLat: 28.5620,
    startLng: 77.3100,
    destLat: 28.5700,
    destLng: 77.3200
  };

  private leafletMap: any = null;
  private vehicleMarker: any = null;
  private animInterval: any = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['bookingId']) {
        this.hasActiveJob = true;
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.hasActiveJob) {
      setTimeout(() => {
        this.initLeafletMap();
      }, 200);
    }
  }

  initLeafletMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById('liveTrackingMap');
    if (!container) return;

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    const centerLat = (this.activeJobData.startLat + this.activeJobData.destLat) / 2;
    const centerLng = (this.activeJobData.startLng + this.activeJobData.destLng) / 2;

    this.leafletMap = L.map(container, {
      zoomControl: false,
      attributionControl: false
    }).setView([centerLat, centerLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.leafletMap);

    // Vehicle custom marker (Yellow machine icon)
    const vehicleIcon = L.divIcon({
      className: 'vehicle-map-pin',
      html: `<div style="background:#f59e0b;color:#000;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(245,158,11,0.5);">🚜</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    // Destination pin marker (Green location pin)
    const destIcon = L.divIcon({
      className: 'dest-map-pin',
      html: `<div style="background:#22c55e;width:28px;height:28px;border-radius:50%;border:4px solid #ffffff;box-shadow:0 4px 12px rgba(34,197,94,0.5);"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    this.vehicleMarker = L.marker([this.activeJobData.startLat, this.activeJobData.startLng], { icon: vehicleIcon }).addTo(this.leafletMap);
    L.marker([this.activeJobData.destLat, this.activeJobData.destLng], { icon: destIcon }).addTo(this.leafletMap);

    // Polyline Route line
    const routeCoords = [
      [this.activeJobData.startLat, this.activeJobData.startLng],
      [28.5660, 77.3150],
      [this.activeJobData.destLat, this.activeJobData.destLng]
    ];

    L.polyline(routeCoords, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.8,
      dashArray: '8, 8'
    }).addTo(this.leafletMap);

    // Subtle vehicle movement simulation
    let step = 0;
    this.animInterval = setInterval(() => {
      step = (step + 1) % 100;
      const progress = step / 100;
      const currentLat = this.activeJobData.startLat + (this.activeJobData.destLat - this.activeJobData.startLat) * progress;
      const currentLng = this.activeJobData.startLng + (this.activeJobData.destLng - this.activeJobData.startLng) * progress;
      if (this.vehicleMarker) {
        this.vehicleMarker.setLatLng([currentLat, currentLng]);
      }
    }, 1500);
  }

  toggleTrackingState(): void {
    this.hasActiveJob = !this.hasActiveJob;
    if (this.hasActiveJob) {
      setTimeout(() => this.initLeafletMap(), 200);
    }
  }

  triggerArrivedNotification(): void {
    this.showArrivedNotification = true;
  }

  closeArrivedNotification(): void {
    this.showArrivedNotification = false;
  }

  goToBookings(): void {
    this.router.navigate(['/bookings']);
  }

  ngOnDestroy(): void {
    if (this.animInterval) {
      clearInterval(this.animInterval);
    }
  }
}
