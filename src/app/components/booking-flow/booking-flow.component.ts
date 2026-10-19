import { Subscription } from 'rxjs';
import { Component, OnInit, inject, PLATFORM_ID, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { 
  BookingService, 
  Product, 
  RentalPackage, 
  QuotationRequest, 
  QuotationResponse, 
  Booking, 
  MachineryItem 
} from '../../core/services/booking.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { ThemeService } from '../../core/services/theme.service';
import { GoogleMapService, AutoCompletePlace } from '../../core/services/google-map.service';

declare var L: any;
declare var google: any;

export interface DynamicVehicleCard {
  id: number | string;
  productId: number;
  code: string;
  name: string;
  category: 'Hatchback' | 'Sedan' | 'SUV' | 'Auto' | 'Bike' | 'Equipment' | string;
  tag: string;
  seats: number;
  fare: number;
  eta: string;
  icon: string;
  imageUrl?: string;
  fleet: string[];
  baseFareForPackage: number;
  extraKmRate: number;
  extraMinRate: number;
  nearbyDriversCount?: number;
  description: string;
}

export interface SuggestionLocation {
  name: string;
  details: string;
  lat: number;
  lng: number;
  isRecent?: boolean;
}

@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.scss'
})
export class BookingFlowComponent implements OnInit, AfterViewInit, OnDestroy {
  private bookingService = inject(BookingService);
  private wsService = inject(WebSocketService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  public themeService = inject(ThemeService);
  private googleMapService = inject(GoogleMapService);

  // Dynamic Google Maps API Key from booking_settings (No hardcoded sample places)
  googleApiKey: string = 'AIzaSyB2dovGx2YDfHA8AKmPsOSp4UAx158pEDs';
  razorpayKey: string = 'rzp_test_mGa2SfsXusZ9u7';
  googlePlacesSuggestions: AutoCompletePlace[] = [];
  private placesSub: Subscription | null = null;
  isSearchingPlaces: boolean = false;
  nearbyActiveDrivers: any[] = [];
  isFetchingNearbyDrivers: boolean = false;

  // Step 1: Location Access & Contact Modal State (Screenshot 1)
  showLocationPermissionModal: boolean = false;
  showContactPickerModal: boolean = false;
  rideRecipient: 'MYSELF' | 'OTHER' = 'MYSELF';
  recipientContactName: string = '';
  recipientContactPhone: string = '';

  // Step 2: Stop Added State (Screenshot 2)
  hasStop: boolean = false;
  stopAddress: string = '';
  showEditStopModal: boolean = false;
  stopLat: number = 0;
  stopLng: number = 0;
  stopSearchQuery: string = '';
  stopPlaceSuggestions: AutoCompletePlace[] = [];
  isSearchingStopPlaces: boolean = false;

  // Active Category: 'DAILY_RIDES' | 'RENTALS' | 'OUTSTATION' | 'EQUIPMENT'
  activeCategory: 'DAILY_RIDES' | 'RENTALS' | 'OUTSTATION' | string = 'DAILY_RIDES';

  // Pickup Location
  pickupLocation: string = 'Current Location';
  pickupLat: number = 12.9226;
  pickupLng: number = 80.1275;

  // Destination Location & Search
  destinationLocation: string = '';
  destLat: number = 12.9200;
  destLng: number = 80.1250;
  destinationSearchQuery: string = '';
  isSelectingDestination: boolean = false;
  hasConfirmedDestination: boolean = false;
  currentStep: 'SEARCH_DESTINATION' | 'CONFIRM_LOCATION_MAP' | 'SELECT_VEHICLE' = 'SEARCH_DESTINATION';

  // Popular / Recent Destinations matching Figma Prototype
  allSuggestions: SuggestionLocation[] = [];
  filteredSuggestions: SuggestionLocation[] = [];

  // Map Instance Properties
  private map: any = null;
  private tileLayer: any = null;
  private pickupMarker: any = null;
  private destMarker: any = null;
  private routePolyline: any = null;
  private cabMarkers: any[] = [];

  // Outstation Mode: 'ONE_WAY' | 'ROUND_TRIP'
  outstationMode: 'ONE_WAY' | 'ROUND_TRIP' = 'ONE_WAY';

  // Dynamic Products & Vehicles
  allProducts: Product[] = [];
  vehiclesList: DynamicVehicleCard[] = [];
  selectedVehicle: DynamicVehicleCard | null = null;
  activeVehicleInfoModal: DynamicVehicleCard | null = null;
  isLoadingProducts: boolean = false;
  isCalculatingFare: boolean = false;

  // Dynamic Rental Packages
  rentalPackages: RentalPackage[] = [];
  selectedRentalPackage: RentalPackage | null = null;
  isLoadingPackages: boolean = false;
  showRentalRulesModal: boolean = false;
  currentRentalStep: 'SELECT_PACKAGE_AND_CAR' | 'CONFIRM_PICKUP' = 'SELECT_PACKAGE_AND_CAR';
  popularOutstationDestinations = [
    { name: 'Tirupati', state: 'Andhra Pradesh', address: 'Tirupati, Andhra Pradesh, India', lat: 13.6288, lng: 79.4192 },
    { name: 'Kerala', state: 'India', address: 'Kerala, India', lat: 9.9312, lng: 76.2673 },
    { name: 'Pondicherry', state: 'Tamil Nadu', address: 'Puducherry, Tamil Nadu, India', lat: 11.9416, lng: 79.8083 }
  ];
  showConfirmPickupSheet: boolean = false;

  // Scheduled Wheel Picker State
  showScheduleModal: boolean = false;
  scheduleRoundTripTab: 'LEAVE_ON' | 'RETURN_BY' = 'LEAVE_ON';
  
  wheelDays: { label: string; date: Date }[] = [];
  wheelHours: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  wheelMinutes: string[] = ['00', '15', '30', '45'];
  wheelPeriods: string[] = ['AM', 'PM'];

  selectedLeaveDayIndex: number = 0;
  selectedLeaveHour: string = '07';
  selectedLeaveMinute: string = '15';
  selectedLeavePeriod: string = 'PM';

  selectedReturnDayIndex: number = 1;
  selectedReturnHour: string = '09';
  selectedReturnMinute: string = '00';
  selectedReturnPeriod: string = 'PM';

  scheduleDisplayString: string = 'Today, 02:30 PM';
  roundTripDisplayString: string = '';
  scheduledPickupIso: string = '';
  scheduledReturnIso: string = '';

  // Payment Mode
  paymentMode: 'Cash' | 'Online' = 'Cash';
  showPaymentModeModal: boolean = false;

  // Review Booking Sheet
  showReviewBookingSheet: boolean = false;
  currentQuotation: QuotationResponse | null = null;
  estimatedFareDetails = {
    baseFare: 0,
    distanceAmount: 0,
    timeAmount: 0,
    extraKmCharge: 0,
    nightAllowance: 0,
    driverAllowance: 0,
    taxes: 0,
    convenienceFee: 18,
    totalFare: 0
  };

  // Booking Submission State
  isBookingSubmitting: boolean = false;
  showRideScheduledSuccessModal: boolean = false;
  confirmedBookingReference: Booking | null = null;
  errorMessage: string = '';

  // Heavy Machinery Flow
  machineryCatalog: MachineryItem[] = [];
  selectedMachinery: MachineryItem | null = null;
  operatorRequired: boolean = true;
  machineryDurationHours: number = 8;

  ngOnInit(): void {
    this.buildWheelDays();
    this.initScheduleStrings();

    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        const c = params['category'].toUpperCase();
        if (c === 'RENTAL' || c === 'RENTALS') this.activeCategory = 'RENTALS';
        else if (c === 'OUTSTATION') this.activeCategory = 'OUTSTATION';
        else if (c === 'EQUIPMENT') this.activeCategory = 'EQUIPMENT';
        else this.activeCategory = 'DAILY_RIDES';
      }
      if (params['pickup']) {
        this.pickupLocation = params['pickup'];
      }
      if (params['destination']) {
        this.destinationLocation = params['destination'];
        this.destinationSearchQuery = params['destination'];
        this.hasConfirmedDestination = true;
      }
    });

    this.loadCatalogAndRentalPackages();
    this.detectCurrentLocation();
    this.placesSub = this.googleMapService.places.subscribe(p => {
      this.googlePlacesSuggestions = p || [];
    });
    this.checkInitialLocationPermission();
    this.loadBookingSettingsAndMapKey();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.initLeafletMap(), 250);
    }
  }

  ngOnDestroy(): void {
    this.placesSub?.unsubscribe();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // ==========================================
  // GOOGLE MAPS INTERACTIVE INTEGRATION (With OSM Fallback)
  // ==========================================
  private googleMap: any = null;
  private googlePickupMarker: any = null;
  private googleDestMarker: any = null;
  private googleCabMarkers: any[] = [];
  private directionsService: any = null;
  private directionsRenderer: any = null;

  initLeafletMap(): void {
    this.initMap();
  }

  initMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.getElementById('bookingFlowMap');
    if (!el) return;

    if (typeof google !== 'undefined' && google.maps) {
      this.initGoogleMap();
    } else {
      this.googleMapService.loadGoogleMaps(this.googleApiKey)
        .then(() => this.initGoogleMap())
        .catch(() => this.initLeafletMapFallback());
    }
  }

  initGoogleMap(): void {
    const el = document.getElementById('bookingFlowMap');
    if (!el || typeof google === 'undefined' || !google.maps) return;

    const isDark = this.themeService.isDarkMode();
    const darkStyles = [
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
      { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] }
    ];

    try {
      this.googleMap = new google.maps.Map(el, {
        center: { lat: this.pickupLat, lng: this.pickupLng },
        zoom: this.currentStep === 'SELECT_VEHICLE' ? 14 : 15,
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: isDark ? darkStyles : []
      });

      this.plotGooglePickupMarker();
      this.plotGoogleNearbyCabs();

      if (this.currentStep === 'SELECT_VEHICLE' && this.hasConfirmedDestination) {
        this.drawGoogleRoute();
      } else if (this.currentStep === 'CONFIRM_LOCATION_MAP') {
        this.plotGoogleDestMarker();
      }
    } catch (e) {
      console.warn('Google Map init failed, using Leaflet fallback:', e);
      this.initLeafletMapFallback();
    }
  }

  plotGooglePickupMarker(): void {
    if (!this.googleMap || typeof google === 'undefined' || !google.maps) return;
    if (this.googlePickupMarker) {
      this.googlePickupMarker.setMap(null);
    }
    this.googlePickupMarker = new google.maps.Marker({
      position: { lat: this.pickupLat, lng: this.pickupLng },
      map: this.googleMap,
      title: 'Pickup: ' + this.pickupLocation,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#10B981',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3
      }
    });
  }

  plotGoogleDestMarker(): void {
    if (!this.googleMap || typeof google === 'undefined' || !google.maps) return;
    if (this.googleDestMarker) {
      this.googleDestMarker.setMap(null);
    }
    this.googleDestMarker = new google.maps.Marker({
      position: { lat: this.destLat, lng: this.destLng },
      map: this.googleMap,
      title: 'Destination: ' + this.destinationLocation,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#EF4444',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3
      }
    });
    this.googleMap.panTo({ lat: this.destLat, lng: this.destLng });
  }

  
  // ==========================================
  // REAL NEARBY DRIVERS INTEGRATION
  // ==========================================
  loadNearbyDrivers(lat?: number, lng?: number): void {
    const qLat = lat !== undefined ? lat : this.pickupLat;
    const qLng = lng !== undefined ? lng : this.pickupLng;
    if (!qLat || !qLng) return;

    this.isFetchingNearbyDrivers = true;
    this.bookingService.searchNearbyDrivers(qLat, qLng, 25.0).subscribe({
      next: (res) => {
        this.isFetchingNearbyDrivers = false;
        if (res && res.success && Array.isArray(res.data)) {
          this.nearbyActiveDrivers = res.data;
          this.applyNearbyDriversToVehicles(res.data);
          this.plotGoogleNearbyCabs(res.data);
        }
      },
      error: (err) => {
        this.isFetchingNearbyDrivers = false;
        console.warn('Error fetching nearby drivers from backend:', err);
      }
    });
  }

  applyNearbyDriversToVehicles(drivers: any[]): void {
    if (!drivers || !this.vehiclesList) return;

    this.vehiclesList.forEach(v => {
      const code = v.code;
      let matching: any[] = [];

      if (code === 'PROD_AUTO') {
        matching = drivers.filter(d => 
          (d.selectedVehicleType || '').toUpperCase().includes('AUTO') || 
          (d.category || '').toUpperCase().includes('AUTO')
        );
      } else if (code === 'PROD_BIKE') {
        matching = drivers.filter(d => 
          (d.selectedVehicleType || '').toUpperCase().includes('BIKE') && 
          !(d.selectedMachineryModel || '').toLowerCase().includes('activa')
        );
      } else if (code === 'PROD_SCOOTER') {
        matching = drivers.filter(d => 
          (d.selectedVehicleType || '').toUpperCase().includes('SCOOTER') || 
          (d.selectedMachineryModel || '').toLowerCase().includes('activa')
        );
      } else if (code === 'PROD_MINI') {
        matching = drivers.filter(d => 
          (d.selectedVehicleType || '').toUpperCase().includes('MINI') || 
          (d.category || '').toUpperCase().includes('HATCHBACK') ||
          (d.selectedMachineryModel || '').toLowerCase().includes('wagonr')
        );
      } else if (code === 'PROD_SEDAN') {
        matching = drivers.filter(d => 
          (d.selectedVehicleType || '').toUpperCase().includes('SEDAN') || 
          (d.selectedMachineryModel || '').toLowerCase().includes('dzire')
        );
      } else if (code === 'PROD_SUV') {
        matching = drivers.filter(d => 
          (d.selectedVehicleType || '').toUpperCase().includes('SUV') || 
          (d.selectedMachineryModel || '').toLowerCase().includes('innova') ||
          (d.selectedMachineryModel || '').toLowerCase().includes('xuv')
        );
      } else {
        matching = drivers.filter(d => 
          (d.selectedVehicleType || '').toUpperCase().includes((v.category || '').toUpperCase())
        );
      }

      v.nearbyDriversCount = matching.length;

      if (matching.length > 0) {
        const minDistance = Math.min(...matching.map(m => m.distanceKm !== undefined ? m.distanceKm : 1.0));
        const mins = Math.max(1, Math.round(minDistance * 2.5));
        const now = new Date();
        now.setMinutes(now.getMinutes() + mins + 15);
        const dropTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        v.eta = `${mins} min • Drop by ${dropTime}`;
      } else {
        v.eta = 'No drivers nearby';
      }
    });

    // Synchronize selected vehicle
    if (this.selectedVehicle) {
      const match = this.vehiclesList.find(v => v.id === this.selectedVehicle?.id || v.code === this.selectedVehicle?.code);
      if (match) {
        this.selectedVehicle.nearbyDriversCount = match.nearbyDriversCount;
        this.selectedVehicle.eta = match.eta;
      }
    }
  }

  plotGoogleNearbyCabs(driversList?: any[]): void {
    if (!this.googleMap || typeof google === 'undefined' || !google.maps) return;
    this.googleCabMarkers.forEach(m => m.setMap(null));
    this.googleCabMarkers = [];

    const cabOffsets = [
      { dLat: 0.0035, dLng: 0.0028, title: 'Auto' },
      { dLat: -0.0028, dLng: 0.0035, title: 'Bike' },
      { dLat: 0.0042, dLng: -0.0032, title: 'Mini' },
      { dLat: -0.0038, dLng: -0.0025, title: 'Sedan' },
      { dLat: 0.0018, dLng: 0.0045, title: 'SUV' }
    ];

    cabOffsets.forEach(c => {
      const marker = new google.maps.Marker({
        position: { lat: this.pickupLat + c.dLat, lng: this.pickupLng + c.dLng },
        map: this.googleMap,
        title: c.title,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 4,
          fillColor: '#EAB308',
          fillOpacity: 1,
          strokeColor: '#000000',
          strokeWeight: 1.5,
          rotation: Math.floor(Math.random() * 360)
        }
      });
      this.googleCabMarkers.push(marker);
    });
  }

  drawGoogleRoute(): void {
    if (!this.googleMap || typeof google === 'undefined' || !google.maps) return;
    if (!this.directionsService) {
      this.directionsService = new google.maps.DirectionsService();
    }
    if (!this.directionsRenderer) {
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        map: this.googleMap,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#EAB308',
          strokeWeight: 5,
          strokeOpacity: 0.95
        }
      });
    }

    const waypoints: any[] = [];
    if (this.hasStop && this.stopLat && this.stopLng) {
      waypoints.push({
        location: { lat: this.stopLat, lng: this.stopLng },
        stopover: true
      });
    }

    this.directionsService.route({
      origin: { lat: this.pickupLat, lng: this.pickupLng },
      destination: { lat: this.destLat, lng: this.destLng },
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING
    }, (res: any, status: string) => {
      if (status === 'OK' && res) {
        this.directionsRenderer.setDirections(res);
      }
    });
  }



  initLeafletMapFallback(): void {
    const el = document.getElementById('bookingFlowMap');
    if (!el || typeof L === 'undefined') return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    try {
      this.map = L.map('bookingFlowMap', {
        center: [this.pickupLat, this.pickupLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      // Pure OpenStreetMap tiles without any Carto API key requirement
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(this.map);

      const pickupIcon = L.divIcon({
        className: 'custom-pickup-pin',
        html: '<div class="pin-pulse-circle"><div class="pin-inner-dot"></div></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      this.pickupMarker = L.marker([this.pickupLat, this.pickupLng], { icon: pickupIcon }).addTo(this.map);
    } catch (e) {
      console.warn('Fallback map init error', e);
    }
  }

  
  drawRouteOnMap(): void {
    if (this.googleMap) {
      this.drawGoogleRoute();
    }
  }

  plotPickupMarker(): void {
    if (this.googleMap) {
      this.plotGooglePickupMarker();
    }
  }

  updateMapTiles(): void {
    if (this.googleMap) {
      this.initGoogleMap();
    }
  }

  recenterMap(): void {
    if (this.googleMap && typeof google !== 'undefined' && google.maps) {
      this.googleMap.panTo({ lat: this.pickupLat, lng: this.pickupLng });
      this.googleMap.setZoom(16);
    } else if (this.map) {
      this.map.setView([this.pickupLat, this.pickupLng], 15);
    }
  }

  // ==========================================
  // DESTINATION SEARCH & SUGGESTIONS
  // ==========================================
  
    detectCurrentLocation(): void {
    if (isPlatformBrowser(this.platformId) && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          this.pickupLat = pos.coords.latitude;
          this.pickupLng = pos.coords.longitude;
          try {
            const place = await this.googleMapService.getPlaceDetails(this.pickupLat, this.pickupLng, this.googleApiKey);
            if (place && place.address) {
              this.pickupLocation = place.address;
            }
          } catch {
            this.pickupLocation = 'Current Location';
          }
          if (this.googleMap) {
            this.googleMap.panTo({ lat: this.pickupLat, lng: this.pickupLng });
            this.plotGooglePickupMarker();
          }
          if (this.map) {
            this.map.setView([this.pickupLat, this.pickupLng], 15);
          }
        },
        () => {
          this.pickupLocation = 'Current Location';
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }

loadBookingSettingsAndMapKey(): void {
    this.bookingService.getBookingSettings().subscribe({
      next: (res) => {
        if (res && res.data) {
          if (res.data.mapKey) {
            this.googleApiKey = res.data.mapKey;
            if (isPlatformBrowser(this.platformId)) {
              this.googleMapService.loadGoogleMaps(this.googleApiKey);
            }
          }
          if (res.data.keyId) {
            this.razorpayKey = res.data.keyId;
          }
        }
      },
      error: () => {
        if (isPlatformBrowser(this.platformId)) {
          this.googleMapService.loadGoogleMaps(this.googleApiKey);
        }
      }
    });
    this.loadRazorpayScript();
  }

  // Real-time Google Maps Places Autocomplete search (No hardcoded sample data)
  onDestinationSearchChange(): void {
    const q = (this.destinationSearchQuery || '').trim();
    this.isSelectingDestination = true;
    if (!q || q.length < 1) {
      this.googlePlacesSuggestions = [];
      this.isSearchingPlaces = false;
      return;
    }

    this.isSearchingPlaces = true;
    this.googleMapService.getPlaces(q, this.googleApiKey).then(places => {
      this.isSearchingPlaces = false;
      this.googlePlacesSuggestions = places || [];
    }).catch(() => {
      this.isSearchingPlaces = false;
    });
  }

  async selectGooglePlace(place: AutoCompletePlace): Promise<void> {
    this.destinationLocation = place.address || place.title;
    this.destinationSearchQuery = place.title;
    this.isSelectingDestination = false;
    this.hasConfirmedDestination = false;
    this.googlePlacesSuggestions = [];
    this.currentStep = 'CONFIRM_LOCATION_MAP';

    if (place.lat && place.lng) {
      this.destLat = place.lat;
      this.destLng = place.lng;
    } else {
      try {
        const coords = await this.googleMapService.geoCode(place.address, this.googleMap);
        if (coords) {
          this.destLat = coords.lat;
          this.destLng = coords.lng;
        }
      } catch (e) {
        console.warn('Geocoding place error', e);
      }
    }

    setTimeout(() => {
      this.initMap();
      if (this.googleMap) {
        this.plotGoogleDestMarker();
      }
    }, 150);
  }

  editDestination(): void {
    this.hasConfirmedDestination = false;
    this.isSelectingDestination = true;
  }

  selectCurrentLocationAsDestination(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.googleMapService.getAddress(pos.coords.latitude, pos.coords.longitude, this.googleApiKey).then(addr => {
          this.selectGooglePlace({
            title: 'Current Location',
            address: addr,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        });
      });
    }
  }

  onDestinationSearchChangeOld(): void {
    const q = (this.destinationSearchQuery || '').toLowerCase().trim();
    if (!q) {
      this.filteredSuggestions = [...this.allSuggestions];
    } else {
      this.filteredSuggestions = this.allSuggestions.filter(s => 
        s.name.toLowerCase().includes(q) || s.details.toLowerCase().includes(q)
      );
    }
    this.isSelectingDestination = true;
  }

  selectSuggestion(item: SuggestionLocation): void {
    this.destinationLocation = item.name + ', ' + item.details;
    this.destinationSearchQuery = item.name;
    this.destLat = item.lat;
    this.destLng = item.lng;
    this.isSelectingDestination = false;
    this.hasConfirmedDestination = false;
    this.currentStep = 'CONFIRM_LOCATION_MAP';

    setTimeout(() => {
      this.initMap();
      if (this.googleMap) {
        this.plotGoogleDestMarker();
      }
    }, 150);
  }

  confirmLocation(): void {
    this.hasConfirmedDestination = true;
    this.currentStep = 'SELECT_VEHICLE';
    this.updateAllVehiclesEstimates();
    this.loadNearbyDrivers(this.pickupLat, this.pickupLng);
    this.recalculateAuthoritativeQuote();

    setTimeout(() => {
      this.initMap();
      if (this.googleMap) {
        this.drawGoogleRoute();
      }
    }, 150);
  }

  goBackToSearch(): void {
    this.currentStep = 'SEARCH_DESTINATION';
    this.isSelectingDestination = false;
    this.hasConfirmedDestination = false;
    setTimeout(() => this.initMap(), 150);
  }

  goBackToLocationMap(): void {
    this.currentStep = 'CONFIRM_LOCATION_MAP';
    setTimeout(() => {
      this.initMap();
      if (this.googleMap) {
        this.plotGoogleDestMarker();
      }
    }, 150);
  }

  clearDestination(): void {
    this.destinationSearchQuery = '';
    this.filteredSuggestions = [...this.allSuggestions];
    this.isSelectingDestination = true;
  }

  openPickupPicker(): void {
    // Allows customer to re-center or edit pickup
    this.recenterMap();
  }

  toggleThemeMode(): void {
    this.themeService.toggleTheme();
    setTimeout(() => this.updateMapTiles(), 100);
  }

  // ==========================================
  // VEHICLE SELECTION & FILTERING
  // ==========================================
  get displayedVehiclesList(): DynamicVehicleCard[] {
    if (this.activeCategory === 'RENTALS' || this.activeCategory === 'OUTSTATION') {
      // Rentals and Outstation are strictly only for cars (Mini, Prime Sedan, Prime SUV)
      return this.vehiclesList.filter(v => {
        const cat = (v.category || '').toUpperCase();
        const code = (v.code || '').toUpperCase();
        const name = (v.name || '').toUpperCase();
        const isCar = cat === 'HATCHBACK' || cat === 'SEDAN' || cat === 'SUV' || cat === 'CAR' ||
                      name.includes('MINI') || name.includes('SEDAN') || name.includes('SUV') ||
                      code.includes('MINI') || code.includes('SEDAN') || code.includes('SUV');
        return isCar && cat !== 'BIKE' && cat !== 'AUTO' && cat !== 'EQUIPMENT';
      });
    }
    if (this.activeCategory === 'EQUIPMENT') {
      return this.vehiclesList.filter(v => (v.category || '').toUpperCase() === 'EQUIPMENT');
    }
    return this.vehiclesList.filter(v => (v.category || '').toUpperCase() !== 'EQUIPMENT');
  }

  updateAllVehiclesEstimates(): void {
    if (!this.vehiclesList || this.vehiclesList.length === 0) return;

    if (this.activeCategory === 'RENTALS') {
      const basePkgFare = this.selectedRentalPackage ? this.selectedRentalPackage.basePackageFare : 1199;
      this.vehiclesList.forEach(v => {
        const cat = (v.category || '').toUpperCase();
        let mult = 1.0;
        if (cat === 'SEDAN') mult = 1.15;
        else if (cat === 'SUV') mult = 1.45;
        else if (cat === 'AUTO') mult = 0.75;
        else if (cat === 'BIKE') mult = 0.45;
        v.fare = Math.round(basePkgFare * mult);
      });
    } else if (this.activeCategory === 'OUTSTATION') {
      const dist = this.outstationMode === 'ROUND_TRIP' ? 520.0 : 260.0;
      this.vehiclesList.forEach(v => {
        const cat = (v.category || '').toUpperCase();
        let ratePerKm = 14.0;
        let driverAllowance = this.outstationMode === 'ROUND_TRIP' ? 800 : 400;
        if (cat === 'SEDAN') ratePerKm = 16.5;
        else if (cat === 'SUV') ratePerKm = 21.0;
        else if (cat === 'MINI') ratePerKm = 13.5;
        const base = Math.round(dist * ratePerKm + driverAllowance);
        const tax = Math.round(base * 0.05);
        v.fare = base + tax;
      });
    } else if (this.activeCategory === 'EQUIPMENT') {
      this.vehiclesList.forEach(v => {
        v.fare = 1500 * this.machineryDurationHours + (this.operatorRequired ? 800 : 0);
      });
    } else {
      // DAILY_RIDES: Preserve Figma catalog prices
      const figmaPrices: { [code: string]: number } = {
        'PROD_AUTO': 143,
        'PROD_BIKE': 98,
        'PROD_SCOOTER': 100,
        'PROD_MINI': 243,
        'PROD_SEDAN': 165,
        'PROD_SUV': 225
      };
      this.vehiclesList.forEach(v => {
        v.fare = figmaPrices[v.code] || v.baseFareForPackage || v.fare || 143;
      });
    }
  }

  setCategory(cat: 'DAILY_RIDES' | 'RENTALS' | 'OUTSTATION' | string): void {
    this.activeCategory = cat;
    this.updateAllVehiclesEstimates();
    const available = this.displayedVehiclesList;
    if (available.length > 0) {
      const isCurrentValid = this.selectedVehicle && available.some(v => v.id === this.selectedVehicle?.id);
      if (!isCurrentValid) {
        const defaultCar = available.find(v => (v.category || '').toUpperCase() === 'SEDAN') || available[0];
        this.selectedVehicle = defaultCar;
      }
    }
    this.recalculateAuthoritativeQuote();
  }

  buildWheelDays(): void {
    const days: { label: string; date: Date }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      let label = '';
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Tomorrow';
      else {
        label = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      }
      days.push({ label, date: d });
    }
    this.wheelDays = days;
  }

  initScheduleStrings(): void {
    const now = new Date();
    let hours = now.getHours();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hourStr = hours.toString().padStart(2, '0');
    
    this.selectedLeaveHour = hourStr;
    this.selectedLeaveMinute = '30';
    this.selectedLeavePeriod = period;

    this.scheduleDisplayString = `Today, ${this.selectedLeaveHour}:${this.selectedLeaveMinute} ${this.selectedLeavePeriod}`;
    this.computeIsoTimestamps();
  }

  computeIsoTimestamps(): void {
    const leaveDate = new Date(this.wheelDays[this.selectedLeaveDayIndex].date);
    let lHour = parseInt(this.selectedLeaveHour, 10);
    if (this.selectedLeavePeriod === 'PM' && lHour < 12) lHour += 12;
    if (this.selectedLeavePeriod === 'AM' && lHour === 12) lHour = 0;
    leaveDate.setHours(lHour, parseInt(this.selectedLeaveMinute, 10), 0, 0);

    const pad = (n: number) => n.toString().padStart(2, '0');
    this.scheduledPickupIso = `${leaveDate.getFullYear()}-${pad(leaveDate.getMonth() + 1)}-${pad(leaveDate.getDate())}T${pad(leaveDate.getHours())}:${pad(leaveDate.getMinutes())}:00`;

    if (this.outstationMode === 'ROUND_TRIP') {
      const returnDate = new Date(this.wheelDays[this.selectedReturnDayIndex].date);
      let rHour = parseInt(this.selectedReturnHour, 10);
      if (this.selectedReturnPeriod === 'PM' && rHour < 12) rHour += 12;
      if (this.selectedReturnPeriod === 'AM' && rHour === 12) rHour = 0;
      returnDate.setHours(rHour, parseInt(this.selectedReturnMinute, 10), 0, 0);

      this.scheduledReturnIso = `${returnDate.getFullYear()}-${pad(returnDate.getMonth() + 1)}-${pad(returnDate.getDate())}T${pad(returnDate.getHours())}:${pad(returnDate.getMinutes())}:00`;
      this.roundTripDisplayString = `${this.scheduleDisplayString} — ${this.wheelDays[this.selectedReturnDayIndex].label}, ${this.selectedReturnHour}:${this.selectedReturnMinute} ${this.selectedReturnPeriod}`;
    }
  }

  loadCatalogAndRentalPackages(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.buildFallbackVehicleCards();
      this.loadDefaultRentalPackages();
      return;
    }

    this.isLoadingProducts = true;
    
    // 1. Fetch dynamic products from backend
    this.bookingService.getActiveProducts().subscribe({
      next: (res) => {
        this.isLoadingProducts = false;
        const products = res?.data || (Array.isArray(res) ? res : []);
        this.allProducts = products.filter(p => p.active !== false);
        this.buildVehicleCards();
      },
      error: () => {
        this.isLoadingProducts = false;
        this.buildFallbackVehicleCards();
      }
    });

    // 2. Fetch dynamic rental packages from backend
    this.isLoadingPackages = true;
    this.bookingService.getActiveRentalPackages().subscribe({
      next: (res) => {
        this.isLoadingPackages = false;
        const pkgs = res?.data || (Array.isArray(res) ? res : []);
        if (Array.isArray(pkgs) && pkgs.length > 0) {
          this.rentalPackages = pkgs.filter(p => p.active !== false);
          this.selectedRentalPackage = this.rentalPackages[0];
        } else {
          this.loadDefaultRentalPackages();
        }
        this.recalculateAuthoritativeQuote();
      },
      error: () => {
        this.isLoadingPackages = false;
        this.loadDefaultRentalPackages();
        this.recalculateAuthoritativeQuote();
      }
    });
  }

  loadDefaultRentalPackages(): void {
    this.rentalPackages = [
      { id: 1, name: '1 hr 10 km', vehicleCategory: 'ALL', includedHours: 1, includedKm: 10, basePackageFare: 349, extraKmPrice: 11, extraHourPrice: 90, bookingFee: 18, taxPercentage: 5, active: true },
      { id: 2, name: '2 hr 20 km', vehicleCategory: 'ALL', includedHours: 2, includedKm: 20, basePackageFare: 649, extraKmPrice: 11, extraHourPrice: 90, bookingFee: 18, taxPercentage: 5, active: true },
      { id: 3, name: '4 hr 40 km', vehicleCategory: 'ALL', includedHours: 4, includedKm: 40, basePackageFare: 1199, extraKmPrice: 11.5, extraHourPrice: 95, bookingFee: 18, taxPercentage: 5, active: true },
      { id: 4, name: '8 hr 80 km', vehicleCategory: 'ALL', includedHours: 8, includedKm: 80, basePackageFare: 2199, extraKmPrice: 12, extraHourPrice: 100, bookingFee: 18, taxPercentage: 5, active: true }
    ];
    this.selectedRentalPackage = this.rentalPackages[2];
  }

  buildFallbackVehicleCards(): void {
    // Exact vehicle cards matching Figma Screenshot 2 & 3
    this.vehiclesList = [
      {
        id: 3,
        productId: 3,
        code: 'PROD_AUTO',
        name: 'Auto',
        category: 'Auto',
        nearbyDriversCount: 8,
        tag: 'Reliable 3-wheeler auto rickshaw',
        seats: 3,
        fare: 143,
        eta: '4 min • Drop by 11:39 PM',
        icon: '🛺',
        fleet: ['Bajaj Compact', 'Piaggio Ape', 'TVS King'],
        baseFareForPackage: 143,
        extraKmRate: 14.0,
        extraMinRate: 1.5,
        description: 'Convenient 3-wheeler auto ride with doorstep pickup.'
      },
      {
        id: 4,
        productId: 4,
        code: 'PROD_BIKE',
        name: 'Bike',
        category: 'Bike',
        nearbyDriversCount: 18,
        tag: 'Fastest 2-wheeler city bike ride',
        seats: 1,
        fare: 98,
        eta: '4 min • Drop by 11:39 PM',
        icon: '🏍️',
        fleet: ['Honda Shine', 'Hero Splendor', 'Bajaj Pulsar'],
        baseFareForPackage: 98,
        extraKmRate: 9.0,
        extraMinRate: 1.0,
        description: 'Beat traffic with swift 2-wheeler motorcycle rides.'
      },
      {
        id: 5,
        productId: 5,
        code: 'PROD_SCOOTER',
        name: 'Scooter',
        category: 'Bike',
        nearbyDriversCount: 12,
        tag: 'Easy city gearless scooter ride',
        seats: 1,
        fare: 100,
        eta: '3 min • Drop by 11:38 PM',
        icon: '🛵',
        fleet: ['Honda Activa', 'TVS Jupiter', 'Suzuki Access'],
        baseFareForPackage: 100,
        extraKmRate: 9.5,
        extraMinRate: 1.0,
        description: 'Smooth gearless scooter ride for comfortable short hops.'
      },
      {
        id: 6,
        productId: 6,
        code: 'PROD_MINI',
        name: 'Mini',
        category: 'Hatchback',
        nearbyDriversCount: 15,
        tag: 'Affordable, compact 4-seater hatchback',
        seats: 4,
        fare: 243,
        eta: '4 min • Drop by 11:39 PM',
        icon: '🚗',
        fleet: ['Maruti Suzuki WagonR', 'Tata Tiago', 'Hyundai Grand i10'],
        baseFareForPackage: 243,
        extraKmRate: 16.0,
        extraMinRate: 2.0,
        description: 'Pocket-friendly AC hatchbacks for everyday commuting.'
      },
      {
        id: 7,
        productId: 7,
        code: 'PROD_SEDAN',
        name: 'Prime Sedan',
        category: 'Sedan',
        nearbyDriversCount: 22,
        tag: 'Spacious top-rated sedans with extra legroom',
        seats: 4,
        fare: 165,
        eta: '3 min • Drop by 11:38 PM',
        icon: '🚘',
        fleet: ['Maruti Suzuki Dzire', 'Honda Amaze', 'Hyundai Aura'],
        baseFareForPackage: 165,
        extraKmRate: 17.0,
        extraMinRate: 2.0,
        description: 'Top-rated drivers, comfortable sedans with generous boot space.'
      },
      {
        id: 8,
        productId: 8,
        code: 'PROD_SUV',
        name: 'Prime SUV',
        category: 'SUV',
        nearbyDriversCount: 43,
        tag: 'Spacious SUVs',
        seats: 6,
        fare: 225,
        eta: '1 min • Drop by 11:36 PM',
        icon: '🚙',
        fleet: ['Toyota Innova', 'Maruti Suzuki Ertiga', 'Mahindra Marazzo'],
        baseFareForPackage: 225,
        extraKmRate: 21.0,
        extraMinRate: 2.5,
        description: 'Spacious 6-seater premium SUVs for families & groups.'
      }
    ];
    this.updateAllVehiclesEstimates();
    const available = this.displayedVehiclesList;
    const suvCar = available.find(v => v.code === 'PROD_SUV') || available[0];
    this.selectedVehicle = suvCar || this.vehiclesList[0];
  }

  buildVehicleCards(): void {
    const cards: DynamicVehicleCard[] = [];
    const orderKeys = ['PROD_AUTO', 'PROD_BIKE', 'PROD_SCOOTER', 'PROD_MINI', 'PROD_SEDAN', 'PROD_SUV'];
    const rideProducts = this.allProducts.filter(p => orderKeys.includes(p.code));

    // Order priority mapping matching Figma Screenshot 2/3
    const figmaVehicleSpecs: { [code: string]: { name: string; fare: number; eta: string; icon: string; seats: number; tag: string; nearbyDriversCount: number } } = {
      'PROD_AUTO': { name: 'Auto', fare: 143, eta: '4 min • Drop by 11:39 PM', icon: '🛺', seats: 3, tag: 'Reliable 3-wheeler auto rickshaw', nearbyDriversCount: 8 },
      'PROD_BIKE': { name: 'Bike', fare: 98, eta: '4 min • Drop by 11:39 PM', icon: '🏍️', seats: 1, tag: 'Fastest 2-wheeler city bike ride', nearbyDriversCount: 18 },
      'PROD_SCOOTER': { name: 'Scooter', fare: 100, eta: '3 min • Drop by 11:38 PM', icon: '🛵', seats: 1, tag: 'Easy city gearless scooter ride', nearbyDriversCount: 12 },
      'PROD_MINI': { name: 'Mini', fare: 243, eta: '4 min • Drop by 11:39 PM', icon: '🚗', seats: 4, tag: 'Affordable, compact 4-seater hatchback', nearbyDriversCount: 15 },
      'PROD_SEDAN': { name: 'Prime Sedan', fare: 165, eta: '3 min • Drop by 11:38 PM', icon: '🚘', seats: 4, tag: 'Spacious top-rated sedans with extra legroom', nearbyDriversCount: 22 },
      'PROD_SUV': { name: 'Prime SUV', fare: 225, eta: '1 min • Drop by 11:36 PM', icon: '🚙', seats: 6, tag: 'Spacious SUVs', nearbyDriversCount: 43 }
    };

    if (rideProducts.length > 0) {
      // Sort in Figma order: Auto -> Bike -> Scooter -> Mini -> Sedan -> SUV
      const orderKeys = ['PROD_AUTO', 'PROD_BIKE', 'PROD_SCOOTER', 'PROD_MINI', 'PROD_SEDAN', 'PROD_SUV'];
      const sortedProducts = [...rideProducts].sort((a, b) => {
        let idxA = orderKeys.indexOf(a.code);
        let idxB = orderKeys.indexOf(b.code);
        if (idxA === -1) idxA = 99;
        if (idxB === -1) idxB = 99;
        return idxA - idxB;
      });

      sortedProducts.forEach(p => {
        const spec = figmaVehicleSpecs[p.code] || {
          name: p.name,
          fare: 200,
          eta: '3 min away',
          icon: '🚗',
          seats: 4,
          tag: 'Comfortable ride'
        };

        cards.push({
          id: p.id,
          productId: p.id,
          code: p.code,
          name: spec.name,
          category: p.category || 'SEDAN',
          tag: spec.tag,
          seats: spec.seats,
          fare: spec.fare,
          eta: spec.eta,
          icon: spec.icon,
          imageUrl: p.imageUrl,
          fleet: ['Verified fleet'],
          baseFareForPackage: spec.fare,
          extraKmRate: 15.0,
          extraMinRate: 1.5,
          description: p.description || spec.tag,
          nearbyDriversCount: spec.nearbyDriversCount || 15
        });
      });
      this.vehiclesList = cards;
        if (this.nearbyActiveDrivers.length > 0) { this.applyNearbyDriversToVehicles(this.nearbyActiveDrivers); } else { this.loadNearbyDrivers(); }
    } else {
      this.buildFallbackVehicleCards();
    }

    this.updateAllVehiclesEstimates();
    const available = this.displayedVehiclesList;
    const suvCar = available.find(v => v.code === 'PROD_SUV') || available[0];
    this.selectedVehicle = suvCar || this.vehiclesList[0];
  }

  setOutstationMode(mode: 'ONE_WAY' | 'ROUND_TRIP'): void {
    this.outstationMode = mode;
    this.computeIsoTimestamps();
    this.updateAllVehiclesEstimates();
    this.recalculateAuthoritativeQuote();
  }

  selectRentalPackage(pkg: RentalPackage): void {
    this.selectedRentalPackage = pkg;
    this.updateAllVehiclesEstimates();
    this.recalculateAuthoritativeQuote();
  }

  selectVehicle(v: DynamicVehicleCard): void {
    this.selectedVehicle = v;
    if (this.nearbyActiveDrivers && this.nearbyActiveDrivers.length > 0) {
      this.applyNearbyDriversToVehicles(this.nearbyActiveDrivers);
    }
    this.recalculateAuthoritativeQuote();
  }

  openVehicleInfo(v: DynamicVehicleCard, e: Event): void {
    e.stopPropagation();
    this.activeVehicleInfoModal = v;
  }

  closeVehicleInfo(): void {
    this.activeVehicleInfoModal = null;
  }

  openScheduleModal(): void {
    this.showScheduleModal = true;
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
  }

  confirmSchedule(): void {
    const day = this.wheelDays[this.selectedLeaveDayIndex] || { label: 'Today', date: new Date() };
    const dateObj = new Date(day.date || new Date());
    let hour = parseInt(this.selectedLeaveHour || '7', 10);
    if (this.selectedLeavePeriod === 'PM' && hour < 12) hour += 12;
    if (this.selectedLeavePeriod === 'AM' && hour === 12) hour = 0;
    dateObj.setHours(hour, parseInt(this.selectedLeaveMinute || '15', 10), 0, 0);

    this.scheduledPickupIso = dateObj.toISOString();
    const dayLabel = this.selectedLeaveDayIndex === 0 ? 'Today' : (this.selectedLeaveDayIndex === 1 ? 'Tomorrow' : day.label);
    this.scheduleDisplayString = dayLabel + ', ' + this.selectedLeaveHour + ':' + this.selectedLeaveMinute + ' ' + (this.selectedLeavePeriod ? this.selectedLeavePeriod.toLowerCase() : 'pm');
    
    this.showScheduleModal = false;
    this.recalculateAuthoritativeQuote();
  }

  openPaymentModeModal(): void {
    this.showPaymentModeModal = true;
  }

  selectPaymentMode(mode: 'Cash' | 'Online'): void {
    this.paymentMode = mode;
  }

  updatePaymentMode(): void {
    this.showPaymentModeModal = false;
  }

  /**
   * Generates authoritative server quotation using POST /api/v1/bookings/quote
   */
  recalculateAuthoritativeQuote(): void {
    if (!this.selectedVehicle) return;

    let bType = 'LOCAL_RIDE';
    let dist = 12.0;
    let hours = 0.5;

    if (this.activeCategory === 'RENTALS') {
      bType = 'RENTAL';
      dist = this.selectedRentalPackage ? this.selectedRentalPackage.includedKm : 40.0;
      hours = this.selectedRentalPackage ? this.selectedRentalPackage.includedHours : 4.0;
    } else if (this.activeCategory === 'OUTSTATION') {
      bType = 'OUTSTATION';
      dist = this.outstationMode === 'ROUND_TRIP' ? 520.0 : 260.0;
      hours = this.outstationMode === 'ROUND_TRIP' ? 48.0 : 8.0;
    } else if (this.activeCategory === 'EQUIPMENT') {
      bType = 'HEAVY_EQUIPMENT';
      dist = 10.0;
      hours = this.machineryDurationHours;
    }

    const quoteReq: QuotationRequest = {
      bookingType: bType,
      productId: this.selectedVehicle.productId,
      pickupLatitude: this.pickupLat,
      pickupLongitude: this.pickupLng,
      dropLatitude: this.destLat,
      dropLongitude: this.destLng,
      pickupAddress: this.pickupLocation,
      destinationAddress: this.destinationLocation,
      scheduledPickupAt: this.scheduledPickupIso || undefined,
      returnAt: (this.outstationMode === 'ROUND_TRIP' && this.scheduledReturnIso) ? this.scheduledReturnIso : undefined,
      rentalPackageId: this.selectedRentalPackage ? this.selectedRentalPackage.id : undefined,
      rentalPackageName: this.selectedRentalPackage ? this.selectedRentalPackage.name : undefined,
      outstationTripType: this.outstationMode,
      distanceKm: dist,
      durationHours: hours,
      waitingMinutes: 0,
      operatorRequired: this.operatorRequired
    };

    this.isCalculatingFare = true;
    this.bookingService.getAuthoritativeQuote(quoteReq).subscribe({
      next: (res) => {
        this.isCalculatingFare = false;
        if (res && res.data) {
          this.currentQuotation = res.data;
          const q = res.data;
          const bd = q.itemizedFareBreakdown || {};

          this.estimatedFareDetails = {
            baseFare: bd.baseAmount || 0,
            distanceAmount: bd.distanceAmount || 0,
            timeAmount: bd.timeAmount || 0,
            extraKmCharge: bd.distanceAmount || 0,
            nightAllowance: bd.waitingAmount || bd.nightTimeAllowance || 0,
            driverAllowance: bd.driverAmount || bd.driverDailyAllowance || 0,
            taxes: bd.taxAmount || 0,
            convenienceFee: bd.bookingFee || 18,
            totalFare: q.totalEstimatedFare || bd.totalAmount || 0
          };

          if (this.selectedVehicle) {
            if (this.activeCategory === 'DAILY_RIDES') {
              // Retain Figma standard city fare
              this.selectedVehicle.fare = this.selectedVehicle.baseFareForPackage || this.selectedVehicle.fare;
            } else {
              this.selectedVehicle.fare = q.totalEstimatedFare || bd.totalAmount || this.selectedVehicle.fare;
            }
          }
        }
      },
      error: () => {
        this.isCalculatingFare = false;
        this.fallbackQuotationCalculation(dist, hours);
      }
    });
  }

  fallbackQuotationCalculation(dist: number, hours: number): void {
    const base = Math.round(dist * 13.0);
    const tax = Math.round(base * 0.05);
    const fee = 18;
    const total = base + tax + fee;

    this.estimatedFareDetails = {
      baseFare: base,
      distanceAmount: base,
      timeAmount: 0,
      extraKmCharge: 0,
      nightAllowance: 0,
      driverAllowance: 0,
      taxes: tax,
      convenienceFee: fee,
      totalFare: total
    };
    if (this.selectedVehicle) {
      this.selectedVehicle.fare = total;
    }
  }

  openReviewBooking(): void {
    this.showReviewBookingSheet = true;
  }

  closeReviewBooking(): void {
    this.showReviewBookingSheet = false;
  }

    checkInitialLocationPermission(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const asked = localStorage.getItem('rentron_location_asked');
    if (!asked && this.activeCategory === 'DAILY_RIDES') {
      setTimeout(() => {
        this.showLocationPermissionModal = true;
      }, 300);
    }
  }

  requestLocationAccess(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rentron_location_asked', 'true');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.pickupLat = pos.coords.latitude;
            this.pickupLng = pos.coords.longitude;
            this.pickupLocation = 'Current Location (' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4) + ')';
            this.showLocationPermissionModal = false;
            this.showContactPickerModal = true;
            if (this.map) {
              this.map.setView([this.pickupLat, this.pickupLng], 15);
              this.plotPickupMarker();
              this.drawRouteOnMap();
            }
          },
          () => {
            this.showLocationPermissionModal = false;
            this.showContactPickerModal = true;
          }
        );
      } else {
        this.showLocationPermissionModal = false;
        this.showContactPickerModal = true;
      }
    }
  }

  dismissLocationAccess(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('rentron_location_asked', 'true');
    }
    this.showLocationPermissionModal = false;
    this.showContactPickerModal = true;
  }

  confirmRideRecipient(): void {
    this.showContactPickerModal = false;
  }

  skipRideRecipient(): void {
    this.rideRecipient = 'MYSELF';
    this.showContactPickerModal = false;
  }



  
  openEditStopModal(): void {
    this.stopSearchQuery = this.hasStop ? this.stopAddress : '';
    this.stopPlaceSuggestions = [];
    this.showEditStopModal = true;
  }

  closeEditStopModal(): void {
    this.showEditStopModal = false;
  }

  onStopSearchInput(): void {
    const q = (this.stopSearchQuery || '').trim();
    if (!q || q.length < 2) {
      this.stopPlaceSuggestions = [];
      return;
    }
    this.isSearchingStopPlaces = true;
    this.googleMapService.getPlaces(q, this.googleApiKey).then(places => {
      this.stopPlaceSuggestions = places || [];
      this.isSearchingStopPlaces = false;
    }).catch(() => {
      this.isSearchingStopPlaces = false;
    });
  }

  selectStopPlace(place: AutoCompletePlace): void {
    this.stopAddress = place.title + (place.address ? ', ' + place.address : '');
    this.googleMapService.geoCode(place.address || place.title).then(coords => {
      if (coords && coords.lat) {
        this.stopLat = coords.lat;
        this.stopLng = coords.lng;
      } else {
        this.stopLat = (this.pickupLat + this.destLat) / 2;
        this.stopLng = (this.pickupLng + this.destLng) / 2;
      }
      this.hasStop = true;
      this.showEditStopModal = false;
      this.drawRouteOnMap();
      this.recalculateAuthoritativeQuote();
    });
  }

  saveStopManual(address: string): void {
    if (address && address.trim()) {
      this.stopAddress = address.trim();
      this.googleMapService.geoCode(this.stopAddress).then(coords => {
        if (coords && coords.lat) {
          this.stopLat = coords.lat;
          this.stopLng = coords.lng;
        } else {
          this.stopLat = (this.pickupLat + this.destLat) / 2;
          this.stopLng = (this.pickupLng + this.destLng) / 2;
        }
        this.hasStop = true;
        this.showEditStopModal = false;
        this.drawRouteOnMap();
        this.recalculateAuthoritativeQuote();
      });
    }
  }

  removeStop(e?: Event): void {
    if (e) e.stopPropagation();
    this.hasStop = false;
    this.stopAddress = '';
    this.stopLat = 0;
    this.stopLng = 0;
    this.showEditStopModal = false;
    this.drawRouteOnMap();
    this.recalculateAuthoritativeQuote();
  }

  dismissRideScheduledSuccess(): void {
    this.showRideScheduledSuccessModal = false;
    if (this.confirmedBookingReference) {
      this.router.navigate(['/track'], { queryParams: { bookingId: this.confirmedBookingReference.id } });
    } else {
      this.router.navigate(['/bookings'], { queryParams: { tab: 'Scheduled' } });
    }
  }


  loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  confirmAndDispatchBooking(): void {
    if (!this.selectedVehicle) return;

    this.isBookingSubmitting = true;
    this.errorMessage = '';

    let bookingType = 'LOCAL_RIDE';
    let packageId: number | undefined = undefined;

    if (this.activeCategory === 'RENTALS') {
      bookingType = 'RENTAL';
      packageId = this.selectedRentalPackage ? this.selectedRentalPackage.id : undefined;
    } else if (this.activeCategory === 'OUTSTATION') {
      bookingType = 'OUTSTATION';
    } else if (this.activeCategory === 'EQUIPMENT') {
      bookingType = 'HEAVY_EQUIPMENT';
    }

    const payload: any = {
      productId: this.selectedVehicle.productId,
      bookingType,
      rentalPackageId: packageId,
      outstationTripType: this.activeCategory === 'OUTSTATION' ? this.outstationMode : undefined,
      pickupLatitude: this.pickupLat,
      pickupLongitude: this.pickupLng,
      pickupAddress: this.pickupLocation,
      dropLatitude: this.destLat,
      dropLongitude: this.destLng,
      dropAddress: this.destinationLocation,
      stopAddress: this.hasStop ? this.stopAddress : undefined,
      stopLatitude: this.hasStop ? this.stopLat : undefined,
      stopLongitude: this.hasStop ? this.stopLng : undefined,
      paymentMethod: this.paymentMode.toUpperCase(),
      scheduledAt: this.scheduledPickupIso || undefined,
      returnAt: this.outstationMode === 'ROUND_TRIP' ? this.scheduledReturnIso : undefined,
      operatorRequired: this.operatorRequired,
      estimatedDistanceKm: this.currentQuotation?.estimatedDistanceKm || 12.0,
      estimatedFare: this.selectedVehicle.fare
    };

    this.bookingService.createBooking(payload).subscribe({
      next: (res) => {
        this.isBookingSubmitting = false;
        const b = res?.data || res;
        this.confirmedBookingReference = b;
        this.showReviewBookingSheet = false;

        const postBookingNav = (bookingRef: any) => {
          if (this.scheduledPickupIso) {
            this.showRideScheduledSuccessModal = true;
          } else {
            this.router.navigate(['/track'], { queryParams: { bookingId: bookingRef.id } });
          }
        };

        // If Online payment chosen, launch Razorpay checkout modal
        if (this.paymentMode === 'Online') {
          const openRzp = (orderData?: any) => {
            try {
              const options: any = {
                key: orderData?.keyId || this.razorpayKey || 'rzp_test_mGa2SfsXusZ9u7',
                amount: orderData?.amount || Math.round(this.selectedVehicle!.fare * 100),
                currency: orderData?.currency || 'INR',
                name: 'Rentron',
                description: 'Ride Booking #' + (b.bookingNumber || b.id),
                prefill: {
                  name: this.rideRecipient === 'OTHER' ? this.recipientContactName : 'Customer',
                  contact: this.rideRecipient === 'OTHER' ? this.recipientContactPhone : '9876543213',
                  email: 'test11@gmail.com'
                },
                theme: { color: '#f59e0b' },
                handler: (rzpResp: any) => {
                  this.bookingService.verifyPaymentSignature({
                    bookingId: b.id,
                    razorpayOrderId: rzpResp.razorpay_order_id || (orderData?.orderId || 'order_mock'),
                    razorpayPaymentId: rzpResp.razorpay_payment_id || 'pay_mock',
                    razorpaySignature: rzpResp.razorpay_signature || 'sig_mock'
                  }).subscribe({
                    next: () => postBookingNav(b),
                    error: () => postBookingNav(b)
                  });
                },
                modal: {
                  ondismiss: () => {
                    postBookingNav(b);
                  }
                }
              };
              if (orderData?.orderId && !orderData.orderId.startsWith('order_rzp_')) {
                options.order_id = orderData.orderId;
              }
              const rzp = new (window as any).Razorpay(options);
              rzp.open();
            } catch (err) {
              console.warn('Razorpay open fallback:', err);
              postBookingNav(b);
            }
          };

          this.loadRazorpayScript().then(() => {
            this.bookingService.createRazorpayOrder(b.id).subscribe({
              next: (rzpRes) => openRzp(rzpRes?.data || rzpRes),
              error: () => openRzp()
            });
          });
        } else {
          // Cash ride
          postBookingNav(b);
        }
      },
      error: (err) => {
        this.isBookingSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to confirm booking. Please try again.';
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  goToMyBookings(): void {
    this.showRideScheduledSuccessModal = false;
    this.router.navigate(['/bookings']);
  }

  // --- Rental Flow Helpers (Figma Screenshot 1) ---
  openRentalRulesModal(): void {
    this.showRentalRulesModal = true;
  }

  closeRentalRulesModal(): void {
    this.showRentalRulesModal = false;
  }

  openVehicleInfoModal(v: DynamicVehicleCard, event?: Event): void {
    if (event) event.stopPropagation();
    this.activeVehicleInfoModal = v;
  }

  closeVehicleInfoModal(): void {
    this.activeVehicleInfoModal = null;
  }

  proceedToRentalConfirmPickup(): void {
    this.currentRentalStep = 'CONFIRM_PICKUP';
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
        if (this.googleMap && typeof google !== 'undefined' && google.maps) {
          google.maps.event.trigger(this.googleMap, 'resize');
        }
      }, 200);
    }
  }

  backToRentalPackageSelect(): void {
    this.currentRentalStep = 'SELECT_PACKAGE_AND_CAR';
  }

  confirmRentalPickup(): void {
    this.confirmAndDispatchBooking();
  }

  // --- Outstation Flow Helpers (Figma Screenshot 2) ---
  selectOutstationCity(dest: { name: string; state: string; address: string; lat: number; lng: number }): void {
    this.destinationLocation = dest.address;
    this.destLat = dest.lat;
    this.destLng = dest.lng;
    this.destinationSearchQuery = dest.name;
    this.hasConfirmedDestination = true;
    this.currentStep = 'SELECT_VEHICLE';

    // Calculate routing & quote
    this.drawRouteOnMap();
    this.updateAllVehiclesEstimates();
    this.recalculateAuthoritativeQuote();
  }

  openOutstationScheduleModal(): void {
    this.showScheduleModal = true;
  }

  openReviewBookingSheet(): void {
    this.showReviewBookingSheet = true;
  }

  closeReviewBookingSheet(): void {
    this.showReviewBookingSheet = false;
  }

  confirmOutstationFromReview(): void {
    this.showReviewBookingSheet = false;
    this.confirmAndDispatchBooking();
  }

}