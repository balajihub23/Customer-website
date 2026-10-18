import { Component, OnInit, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerHeaderComponent } from '../../shared/components/customer-header/customer-header.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { BookingService } from '../../core/services/booking.service';
import { CustomerService } from '../../core/services/customer.service';

declare var L: any;

export interface LocationItem {
  name: string;
  details: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomerHeaderComponent, BottomNavComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  
  activeTab: 'construction' | 'ride' = 'construction';
  userName: string = 'Suren';
  selectedLocation: string = 'Selaiyur, East Tambaram';

  // Work Location Modal state (search | adjust_map | confirm_details)
  showLocationModal: boolean = false;
  locationStep: 'search' | 'adjust_map' | 'confirm_details' = 'search';
  searchQuery: string = '';

  map: any = null;
  currentLat: number = 12.9226;
  currentLng: number = 80.1275;

  // Pure dynamic recent search locations (no hardcoded arrays!)
  recentLocations: LocationItem[] = [];
  filteredSuggestions: LocationItem[] = [];

  workSiteDetails = {
    address: 'Work Site Location',
    completeAddress: '',
    landmark: '',
    contactNumber: '+91 98765 43210',
    tag: 'Site'
  };

  machineryCategories = [
    { id: 'jcb', name: 'JCB Backhoe', icon: '🚜', rate: '₹1,000/hr' },
    { id: 'excavator', name: 'Excavator', icon: '🏗️', rate: '₹1,200/hr' },
    { id: 'crane', name: 'Mobile Crane', icon: '🏗️', rate: '₹2,500/hr' },
    { id: 'roller', name: 'Road Roller', icon: '🚜', rate: '₹900/hr' }
  ];

  rideCategories = [
    { id: 'taxi', name: 'Cab Taxi', icon: '🚕', rate: '₹15/km' },
    { id: 'silver_taxi', name: 'Silver Taxi', icon: '🚖', rate: '₹20/km' },
    { id: 'auto', name: 'Auto Ride', icon: '🛺', rate: '₹12/km' },
    { id: 'bike', name: 'Bike Taxi', icon: '🛵', rate: '₹8/km' }
  ];

  constructor(
    private router: Router,
    private bookingService: BookingService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.customerService.getProfile().subscribe({
      next: (profile) => {
        if (profile?.fullName) {
          this.userName = profile.fullName;
        }
      }
    });

    this.loadRecentLocations();
    this.loadDynamicProducts();
  }

  loadDynamicProducts(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.bookingService.getActiveProducts().subscribe({
      next: (res) => {
        const products = res?.data || (Array.isArray(res) ? res : []);
        if (products && products.length > 0) {
          const mach = products.filter((p: any) => p.productType === 'HEAVY_EQUIPMENT' || p.productType === 'JCB');
          if (mach.length > 0) {
            this.machineryCategories = mach.map((p: any) => ({
              id: p.code || String(p.id),
              name: p.name,
              icon: p.category === 'EXCAVATOR' || p.category === 'CRANE' ? '🏗️' : '🚜',
              rate: '₹1,000/hr'
            }));
          }

          const rides = products.filter((p: any) => p.productType === 'RIDE' || p.productType === 'CAR' || p.productType === 'AUTO' || p.productType === 'BIKE');
          if (rides.length > 0) {
            this.rideCategories = rides.map((p: any) => ({
              id: p.code || String(p.id),
              name: p.name,
              icon: p.category === 'BIKE' ? '🛵' : (p.category === 'AUTO' ? '🛺' : '🚕'),
              rate: p.category === 'BIKE' ? '₹8/km' : (p.category === 'AUTO' ? '₹12/km' : '₹15/km')
            }));
          }
        }
      }
    });
  }

  loadRecentLocations(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const saved = localStorage.getItem('rentron_recent_locations');
    if (saved) {
      try {
        this.recentLocations = JSON.parse(saved);
      } catch (e) {
        this.recentLocations = [];
      }
    } else {
      this.recentLocations = [];
    }

    // Fetch dynamic customer addresses from backend
    this.customerService.getSavedAddresses().subscribe({
      next: (res: any) => {
        const list = res?.data || res;
        if (Array.isArray(list) && list.length > 0) {
          list.forEach((item: any) => {
            const addrName = item.addressLine1 || item.address || item.label || 'Work Site';
            const details = item.landmark || item.city || item.state || 'Saved Location';
            const lat = item.latitude || 12.9226;
            const lng = item.longitude || 80.1275;
            if (!this.recentLocations.some(r => r.name === addrName)) {
              this.recentLocations.unshift({ name: addrName, details, lat, lng });
            }
          });
        }
        this.filterSearch();
      }
    });
  }

  addLocationToRecent(item: LocationItem): void {
    if (!item || !item.name) return;
    const existingIndex = this.recentLocations.findIndex(r => r.name.toLowerCase() === item.name.toLowerCase());
    if (existingIndex >= 0) {
      this.recentLocations.splice(existingIndex, 1);
    }
    this.recentLocations.unshift(item);
    if (this.recentLocations.length > 10) {
      this.recentLocations = this.recentLocations.slice(0, 10);
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rentron_recent_locations', JSON.stringify(this.recentLocations));
    }
  }

  removeRecentLocation(index: number, event: Event): void {
    event.stopPropagation();
    this.recentLocations.splice(index, 1);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rentron_recent_locations', JSON.stringify(this.recentLocations));
    }
    this.filterSearch();
  }

  openLocationModal(): void {
    this.showLocationModal = true;
    this.locationStep = 'search';
    this.searchQuery = '';
    this.loadRecentLocations();
  }

  filterSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredSuggestions = [...this.recentLocations];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filteredSuggestions = this.recentLocations.filter(s =>
      s.name.toLowerCase().includes(q) || s.details.toLowerCase().includes(q)
    );
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterSearch();
  }

  selectLocationSuggestion(item: LocationItem): void {
    this.searchQuery = item.name + (item.details ? ', ' + item.details : '');
    this.workSiteDetails.address = item.name;
    this.workSiteDetails.landmark = item.details;
    this.currentLat = item.lat;
    this.currentLng = item.lng;
    this.addLocationToRecent(item);

    this.locationStep = 'adjust_map';
    setTimeout(() => this.initLeafletMap(), 150);
  }

  useCurrentGPSLocation(): void {
    if (isPlatformBrowser(this.platformId) && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentLat = pos.coords.latitude;
          this.currentLng = pos.coords.longitude;
          const gpsItem: LocationItem = {
            name: 'Current Location',
            details: `GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          this.searchQuery = gpsItem.name;
          this.workSiteDetails.address = gpsItem.name;
          this.addLocationToRecent(gpsItem);
          this.locationStep = 'adjust_map';
          setTimeout(() => this.initLeafletMap(), 150);
        },
        () => {
          if (this.recentLocations.length > 0) {
            this.selectLocationSuggestion(this.recentLocations[0]);
          } else {
            this.locationStep = 'adjust_map';
            setTimeout(() => this.initLeafletMap(), 150);
          }
        }
      );
    } else {
      if (this.recentLocations.length > 0) {
        this.selectLocationSuggestion(this.recentLocations[0]);
      } else {
        this.locationStep = 'adjust_map';
        setTimeout(() => this.initLeafletMap(), 150);
      }
    }
  }

  initLeafletMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (typeof L === 'undefined') {
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => this.buildMapInstance();
        document.body.appendChild(script);
      }
    } else {
      this.buildMapInstance();
    }
  }

  buildMapInstance(): void {
    const el = document.getElementById('homeMapContainer');
    if (!el || typeof L === 'undefined') return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.map = L.map('homeMapContainer', {
      center: [this.currentLat, this.currentLng],
      zoom: 15,
      zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    this.map.on('moveend', () => {
      const center = this.map.getCenter();
      this.currentLat = center.lat;
      this.currentLng = center.lng;
      this.updateAddressFromCenter(center.lat, center.lng);
    });
  }

  updateAddressFromCenter(lat: number, lng: number): void {
    const nearest = this.recentLocations.find(
      s => Math.abs(s.lat - lat) < 0.02 && Math.abs(s.lng - lng) < 0.02
    );
    if (nearest) {
      this.workSiteDetails.address = nearest.name;
      this.searchQuery = nearest.name + (nearest.details ? ', ' + nearest.details : '');
    } else {
      const addr = `Work Site (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      this.workSiteDetails.address = addr;
      this.searchQuery = addr;
    }
  }

  recenterMap(): void {
    if (this.map) {
      this.map.setView([this.currentLat, this.currentLng], 16);
    }
  }

  confirmLocationAndContinue(): void {
    this.selectedLocation = this.workSiteDetails.address;
    
    const item: LocationItem = {
      name: this.workSiteDetails.address,
      details: this.workSiteDetails.landmark || 'Saved Work Site',
      lat: this.currentLat,
      lng: this.currentLng
    };
    this.addLocationToRecent(item);

    const payload = {
      label: this.workSiteDetails.tag || 'Site',
      addressType: (this.workSiteDetails.tag || 'SITE').toUpperCase(),
      addressLine1: this.workSiteDetails.address,
      landmark: this.workSiteDetails.landmark,
      phone: this.workSiteDetails.contactNumber,
      latitude: this.currentLat,
      longitude: this.currentLng
    };

    this.customerService.saveAddress(payload).subscribe({
      next: () => {
        this.showLocationModal = false;
      },
      error: () => {
        this.showLocationModal = false;
      }
    });
  }

  selectMachinery(id: string): void {
    this.bookingService.setSelectedMachinery(id);
    this.router.navigate(['/booking'], { queryParams: { category: 'EQUIPMENT', machineryId: id } });
  }

  selectRide(id: string): void {
    this.bookingService.setSelectedMachinery(id);
    this.router.navigate(['/booking'], { queryParams: { category: 'DAILY_RIDES', rideId: id } });
  }

  openCategory(cat: string): void {
    this.router.navigate(['/booking'], { queryParams: { category: cat } });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
