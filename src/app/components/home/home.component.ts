import { Component, OnInit, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomerHeaderComponent } from '../../shared/components/customer-header/customer-header.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { BookingService } from '../../core/services/booking.service';
import { CustomerService } from '../../core/services/customer.service';
import { GoogleMapService, AutoCompletePlace } from '../../core/services/google-map.service';
import { AuthService } from '../../core/services/auth.service';

declare var L: any;
declare var google: any;

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
  private googleMapService = inject(GoogleMapService);
  private authService = inject(AuthService);
  isDetectingGPS: boolean = false;
  isSearchingPlaces: boolean = false;
  googlePlacesSuggestions: AutoCompletePlace[] = [];
  googleApiKey: string = '';
  private platformId = inject(PLATFORM_ID);
  
  activeTab: 'construction' | 'ride' = 'construction';
  userName: string = 'Customer';
  selectedLocation: string = 'Detecting location...';

  // Work Location Modal state (search | adjust_map | confirm_details)
  showLocationModal: boolean = false;
  locationStep: 'search' | 'adjust_map' | 'confirm_details' = 'search';
  searchQuery: string = '';

  map: any = null;
  googleMap: any = null;
  marker: any = null;
  leafletMarker: any = null;
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
    if (!this.authService.isLoggedIn()) {
      console.warn('No active customer session. Redirecting to splash screen.');
      this.router.navigate(['/splash']);
      return;
    }

    this.customerService.getProfile().subscribe({
      next: (res: any) => {
        const profile = res?.data || res;
        if (profile && profile.fullName) {
          this.userName = profile.fullName;
        } else if (!profile) {
          this.authService.clearSession();
          this.router.navigate(['/splash']);
        }
      },
      error: (err) => {
        if (err.status === 401) {
          console.warn('Customer account not found in database. Redirecting to splash/register screen.');
          this.authService.clearSession();
          this.router.navigate(['/splash']);
        }
      }
    });

    this.autoDetectCurrentLocation();
    this.loadRecentLocations();
    this.loadDynamicProducts();
    this.loadBookingSettingsAndMapKey();
  }

  autoDetectCurrentLocation(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // 1. Check saved location from localStorage
    const savedTitle = localStorage.getItem('rentron_current_title') || localStorage.getItem('title');
    const savedAddress = localStorage.getItem('rentron_current_address') || localStorage.getItem('FullAddress');
    const savedLat = localStorage.getItem('rentron_current_lat') || localStorage.getItem('latitude');
    const savedLng = localStorage.getItem('rentron_current_lng') || localStorage.getItem('longitude');

    if (savedTitle || savedAddress) {
      this.selectedLocation = savedTitle || savedAddress || '';
      if (savedAddress) {
        this.workSiteDetails.address = savedAddress;
        this.workSiteDetails.completeAddress = savedAddress;
        this.workSiteDetails.landmark = savedTitle || '';
      }
      if (savedLat && savedLng) {
        this.currentLat = parseFloat(savedLat);
        this.currentLng = parseFloat(savedLng);
      }
    } else {
      this.selectedLocation = 'Detecting location...';
    }

    // 2. Automatically detect device current GPS coordinates
    if (navigator.geolocation) {
      this.isDetectingGPS = true;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          this.isDetectingGPS = false;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.currentLat = lat;
          this.currentLng = lng;

          try {
            const place = await this.googleMapService.getPlaceDetails(lat, lng, this.googleApiKey);
            if (place && (place.title || place.address)) {
              this.selectedLocation = place.title || place.address;
              this.workSiteDetails.address = place.address;
              this.workSiteDetails.completeAddress = place.address;
              this.workSiteDetails.landmark = place.title;

              localStorage.setItem('rentron_current_lat', lat.toString());
              localStorage.setItem('rentron_current_lng', lng.toString());
              localStorage.setItem('rentron_current_address', place.address);
              localStorage.setItem('rentron_current_title', place.title);
              localStorage.setItem('latitude', lat.toString());
              localStorage.setItem('longitude', lng.toString());
              localStorage.setItem('title', place.title);
              localStorage.setItem('FullAddress', place.address);
            }
          } catch (e) {
            console.warn('Error reverse geocoding current location:', e);
          }
        },
        (err) => {
          this.isDetectingGPS = false;
          console.warn('GPS location detection skipped or unavailable:', err.message);
          if (!this.selectedLocation || this.selectedLocation === 'Detecting location...') {
            this.selectedLocation = 'Select Location';
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      if (!this.selectedLocation || this.selectedLocation === 'Detecting location...') {
        this.selectedLocation = 'Select Location';
      }
    }
  }

  loadDynamicProducts(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.bookingService.getActiveProducts().subscribe({
      next: (res) => {
        const products = res?.data || (Array.isArray(res) ? res : []);
        if (products && products.length > 0) {
          this.bookingService.getMachineryCatalog().subscribe({
            next: (catRes) => {
              if (catRes && catRes.data && catRes.data.length > 0) {
                this.machineryCategories = catRes.data.map((m: any) => ({
                  id: m.code || m.id,
                  name: m.name,
                  icon: m.image && m.image.length <= 4 ? m.image : (m.category === 'Excavator' || m.category === 'Crane' ? '🏗️' : '🚜'),
                  rate: `₹${m.hourlyRate?.toLocaleString('en-IN') || '1,000'}/hr`
                }));
              }
            }
          });

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

  async filterSearch(): Promise<void> {
    const q = (this.searchQuery || '').trim();
    if (!q) {
      this.googlePlacesSuggestions = [];
      this.isSearchingPlaces = false;
      this.filteredSuggestions = [...this.recentLocations];
      return;
    }

    const qLower = q.toLowerCase();
    this.filteredSuggestions = this.recentLocations.filter(s =>
      s.name.toLowerCase().includes(qLower) || s.details.toLowerCase().includes(qLower)
    );

    this.isSearchingPlaces = true;
    try {
      const places = await this.googleMapService.getPlaces(q, this.googleApiKey);
      this.googlePlacesSuggestions = places || [];
    } catch {
      this.googlePlacesSuggestions = [];
    } finally {
      this.isSearchingPlaces = false;
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.googlePlacesSuggestions = [];
    this.isSearchingPlaces = false;
    this.filterSearch();
  }

  selectLocationSuggestion(item: LocationItem): void {
    const full = item.details ? (item.details.includes(item.name) ? item.details : item.name + ', ' + item.details) : item.name;
    this.searchQuery = full;
    this.workSiteDetails.address = full;
    this.workSiteDetails.completeAddress = full;
    this.workSiteDetails.landmark = item.name;
    this.currentLat = item.lat;
    this.currentLng = item.lng;
    this.addLocationToRecent(item);

    this.locationStep = 'adjust_map';
    setTimeout(() => this.initLeafletMap(), 150);
  }

  useCurrentGPSLocation(): void {
    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
      if (this.recentLocations.length > 0) {
        this.selectLocationSuggestion(this.recentLocations[0]);
      }
      return;
    }

    this.isDetectingGPS = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.currentLat = lat;
        this.currentLng = lng;

        // Perform reverse geocoding to resolve real human-readable place and full address
        const place = await this.googleMapService.getPlaceDetails(lat, lng);
        this.isDetectingGPS = false;

        const gpsItem: LocationItem = {
          name: place.title,
          details: place.address,
          lat: lat,
          lng: lng
        };

        this.searchQuery = place.address;
        this.workSiteDetails.address = place.address;
        this.workSiteDetails.completeAddress = place.address;
        this.workSiteDetails.landmark = place.title;
        this.selectedLocation = place.address;
        this.addLocationToRecent(gpsItem);

        // Persist to localStorage for booking flow and customer session
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('rentron_current_lat', lat.toString());
          localStorage.setItem('rentron_current_lng', lng.toString());
          localStorage.setItem('rentron_current_address', place.address);
          localStorage.setItem('rentron_current_title', place.title);
        }

        this.locationStep = 'adjust_map';
        setTimeout(() => this.initLeafletMap(), 150);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        this.isDetectingGPS = false;
        if (this.recentLocations.length > 0) {
          this.selectLocationSuggestion(this.recentLocations[0]);
        } else {
          this.locationStep = 'adjust_map';
          setTimeout(() => this.initLeafletMap(), 150);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  initLeafletMap(): void {
    this.initMap();
  }

  initMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const el = document.getElementById('homeMapContainer');
    if (!el) return;

    const win = window as any;
    if (win.google && win.google.maps) {
      this.initGoogleMap(el);
    } else if (this.googleApiKey) {
      this.googleMapService.loadGoogleMaps(this.googleApiKey)
        .then(() => this.initGoogleMap(el))
        .catch(() => this.initLeafletMapFallback(el));
    } else {
      this.initLeafletMapFallback(el);
    }
  }

  private initGoogleMap(el: HTMLElement): void {
    if (this.map) {
      try { this.map.remove(); } catch (_) {}
      this.map = null;
    }

    const latLng = new google.maps.LatLng(this.currentLat, this.currentLng);
    this.googleMap = new google.maps.Map(el, {
      center: latLng,
      zoom: 17,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy'
    });

    this.marker = new google.maps.Marker({
      position: latLng,
      map: this.googleMap,
      draggable: true,
      animation: google.maps.Animation.DROP,
      title: 'Drag to adjust location'
    });

    // ONLY change location when the user explicitly moves the point / marker!
    // Zooming in/out NEVER changes the coordinates or address.
    this.marker.addListener('dragend', async () => {
      const pos = this.marker.getPosition();
      this.currentLat = pos.lat();
      this.currentLng = pos.lng();
      await this.updateAddressFromMarker(this.currentLat, this.currentLng);
    });

    // Clicking anywhere on the map also moves the marker point to that spot
    this.googleMap.addListener('click', async (e: any) => {
      if (e.latLng) {
        this.currentLat = e.latLng.lat();
        this.currentLng = e.latLng.lng();
        this.marker.setPosition(e.latLng);
        await this.updateAddressFromMarker(this.currentLat, this.currentLng);
      }
    });
  }

  private initLeafletMapFallback(el: HTMLElement): void {
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
        script.onload = () => this.buildLeafletMap(el);
        document.body.appendChild(script);
      }
    } else {
      this.buildLeafletMap(el);
    }
  }

  private buildLeafletMap(el: HTMLElement): void {
    if (this.map) {
      try { this.map.remove(); } catch (_) {}
      this.map = null;
    }

    this.map = L.map('homeMapContainer', {
      center: [this.currentLat, this.currentLng],
      zoom: 16,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    const marker = L.marker([this.currentLat, this.currentLng], { draggable: true }).addTo(this.map);
    this.leafletMarker = marker;

    // ONLY update on marker dragend or click - NOT on zoom or map move
    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      this.currentLat = pos.lat;
      this.currentLng = pos.lng;
      await this.updateAddressFromMarker(this.currentLat, this.currentLng);
    });

    this.map.on('click', async (e: any) => {
      this.currentLat = e.latlng.lat;
      this.currentLng = e.latlng.lng;
      marker.setLatLng(e.latlng);
      await this.updateAddressFromMarker(this.currentLat, this.currentLng);
    });
  }

  async updateAddressFromMarker(lat: number, lng: number): Promise<void> {
    const place = await this.googleMapService.getPlaceDetails(lat, lng, this.googleApiKey);
    this.workSiteDetails.address = place.address;
    this.workSiteDetails.completeAddress = place.address;
    this.workSiteDetails.landmark = place.title;
    this.searchQuery = place.address;
    this.selectedLocation = place.address;

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rentron_current_lat', lat.toString());
      localStorage.setItem('rentron_current_lng', lng.toString());
      localStorage.setItem('rentron_current_address', place.address);
      localStorage.setItem('rentron_current_title', place.title);
      localStorage.setItem('latitude', lat.toString());
      localStorage.setItem('longitude', lng.toString());
      localStorage.setItem('title', place.title);
      localStorage.setItem('FullAddress', place.address);
    }
  }

  recenterMap(): void {
    if (this.googleMap && this.marker) {
      const latLng = new google.maps.LatLng(this.currentLat, this.currentLng);
      this.googleMap.panTo(latLng);
      this.googleMap.setZoom(17);
      this.marker.setPosition(latLng);
    } else if (this.map) {
      this.map.setView([this.currentLat, this.currentLng], 16);
      if (this.leafletMarker) {
        this.leafletMarker.setLatLng([this.currentLat, this.currentLng]);
      }
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

  loadBookingSettingsAndMapKey(): void {
    this.bookingService.getBookingSettings().subscribe({
      next: (res) => {
        if (res && res.data && res.data.mapKey) {
          this.googleApiKey = res.data.mapKey;
          if (isPlatformBrowser(this.platformId)) {
            this.googleMapService.loadGoogleMaps(this.googleApiKey);
          }
        }
      }
    });
  }

  async selectGooglePlace(place: AutoCompletePlace): Promise<void> {
    this.searchQuery = place.address;
    this.workSiteDetails.address = place.address;
    this.workSiteDetails.completeAddress = place.address;
    this.workSiteDetails.landmark = place.title;
    this.selectedLocation = place.address;

    let lat = place.lat;
    let lng = place.lng;

    if (!lat || !lng) {
      const coords = await this.googleMapService.geoCode(place.address, this.googleApiKey);
      lat = coords.lat;
      lng = coords.lng;
    }

    this.currentLat = lat;
    this.currentLng = lng;

    const item: LocationItem = {
      name: place.title,
      details: place.address,
      lat: lat,
      lng: lng
    };
    this.addLocationToRecent(item);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rentron_current_lat', lat.toString());
      localStorage.setItem('rentron_current_lng', lng.toString());
      localStorage.setItem('rentron_current_address', place.address);
      localStorage.setItem('rentron_current_title', place.title);
      localStorage.setItem('latitude', lat.toString());
      localStorage.setItem('longitude', lng.toString());
      localStorage.setItem('title', place.title);
      localStorage.setItem('FullAddress', place.address);
    }

    this.locationStep = 'adjust_map';
    setTimeout(() => this.initLeafletMap(), 150);
  }

}