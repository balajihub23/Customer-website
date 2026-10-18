import { Component, OnInit, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
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
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

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
  description: string;
}

@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, BottomNavComponent],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.scss'
})
export class BookingFlowComponent implements OnInit, OnDestroy {
  private bookingService = inject(BookingService);
  private wsService = inject(WebSocketService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  // Active Category: 'DAILY_RIDES' | 'RENTALS' | 'OUTSTATION' | 'EQUIPMENT'
  activeCategory: 'DAILY_RIDES' | 'RENTALS' | 'OUTSTATION' | 'EQUIPMENT' = 'DAILY_RIDES';

  // Pickup & Destination
  pickupLocation: string = 'Camp Road Junction, Selaiyur, Chennai, Tamil Nadu';
  pickupLat: number = 12.9226;
  pickupLng: number = 80.1275;

  destinationLocation: string = 'Tirupati, Andhra Pradesh';
  destLat: number = 13.6288;
  destLng: number = 79.4192;

  showDestinationSearch: boolean = false;
  popularDestinations = [
    { name: 'Tirupati', lat: 13.6288, lng: 79.4192 },
    { name: 'Pondicherry', lat: 11.9416, lng: 79.8083 },
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { name: 'Mahabalipuram', lat: 12.6269, lng: 80.1927 },
    { name: 'Vellore', lat: 12.9165, lng: 79.1325 }
  ];

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

  selectedReturnDayIndex: number = 2;
  selectedReturnHour: string = '02';
  selectedReturnMinute: string = '15';
  selectedReturnPeriod: string = 'AM';

  scheduleDisplayString: string = 'Today, 07:15 PM';
  roundTripDisplayString: string = 'Today, 07:15 PM — Return in 2 days';
  scheduledPickupIso: string | null = null;
  scheduledReturnIso: string | null = null;

  // Payment Mode
  paymentMode: 'Cash' | 'Online' = 'Cash';
  showPaymentModeModal: boolean = false;

  // Review Booking Sheet & Quotation Details
  showReviewBookingModal: boolean = false;
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
      }
    });

    this.loadCatalogAndRentalPackages();
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

  buildVehicleCards(): void {
    const cards: DynamicVehicleCard[] = [];
    const rideProducts = this.allProducts.filter(p => 
      p.productType === 'RIDE' || p.productType === 'CAR' || p.productType === 'AUTO' || p.productType === 'BIKE'
    );

    if (rideProducts.length > 0) {
      rideProducts.forEach(p => {
        const cat = (p.category || 'SEDAN').toUpperCase();
        let icon = '🚗';
        let seats = 4;
        let tag = 'Comfortable ride';
        let fleet = ['Toyota Etios', 'Maruti Suzuki Dzire'];
        let defaultFare = 220;

        if (cat === 'BIKE') {
          icon = '🛵';
          seats = 1;
          tag = 'Quick & pocket-friendly';
          fleet = ['Honda Activa', 'Hero Splendor', 'TVS Jupiter'];
          defaultFare = 65;
        } else if (cat === 'AUTO') {
          icon = '🛺';
          seats = 3;
          tag = 'Doorstep pickup, no bargaining';
          fleet = ['Bajaj Compact', 'Piaggio Ape'];
          defaultFare = 95;
        } else if (cat === 'MINI') {
          icon = '🚗';
          seats = 4;
          tag = 'Comfy, economical cars';
          fleet = ['Maruti Suzuki WagonR', 'Tata Tiago', 'Hyundai Santro'];
          defaultFare = 180;
        } else if (cat === 'SEDAN') {
          icon = '🚕';
          seats = 4;
          tag = 'Top-rated drivers, extra legroom';
          fleet = ['Maruti Suzuki Dzire', 'Toyota Etios', 'Honda Amaze', 'Hyundai Aura'];
          defaultFare = 240;
        } else if (cat === 'SUV') {
          icon = '🚙';
          seats = 6;
          tag = 'Spacious SUVs for group travel';
          fleet = ['Toyota Innova', 'Maruti Suzuki Ertiga', 'Mahindra Marazzo'];
          defaultFare = 350;
        }

        cards.push({
          id: p.id,
          productId: p.id,
          code: p.code,
          name: p.name,
          category: cat,
          tag,
          seats,
          fare: defaultFare,
          eta: '3 min • Drop by 11:20 PM',
          icon,
          imageUrl: p.imageUrl,
          fleet,
          baseFareForPackage: defaultFare * 4,
          extraKmRate: 11.5,
          extraMinRate: 1.8,
          description: p.description || `Enjoy safe, comfortable travel with Rentron ${p.name}.`
        });
      });
    }

    if (cards.length === 0) {
      this.buildFallbackVehicleCards();
      return;
    }

    this.vehiclesList = cards;
    this.selectedVehicle = this.vehiclesList[0];
    this.recalculateAuthoritativeQuote();
  }

  buildFallbackVehicleCards(): void {
    this.vehiclesList = [
      {
        id: 1,
        productId: 1,
        code: 'PROD_BIKE',
        name: 'Bike Taxi',
        category: 'Bike',
        tag: 'Fastest way to beat traffic',
        seats: 1,
        fare: 65,
        eta: '2 min away',
        icon: '🛵',
        fleet: ['Honda Activa', 'Hero Splendor'],
        baseFareForPackage: 250,
        extraKmRate: 6.0,
        extraMinRate: 1.0,
        description: 'Quick solo ride through city traffic.'
      },
      {
        id: 2,
        productId: 2,
        code: 'PROD_AUTO',
        name: 'Auto Ride',
        category: 'Auto',
        tag: 'Doorstep pickup, meter fares',
        seats: 3,
        fare: 95,
        eta: '3 min away',
        icon: '🛺',
        fleet: ['Bajaj RE', 'Piaggio Ape'],
        baseFareForPackage: 350,
        extraKmRate: 9.0,
        extraMinRate: 1.2,
        description: 'Affordable everyday travel for short distances.'
      },
      {
        id: 3,
        productId: 3,
        code: 'PROD_MINI',
        name: 'Mini Hatchback',
        category: 'Mini',
        tag: 'Comfy, economical cars',
        seats: 4,
        fare: 185,
        eta: '4 min away',
        icon: '🚗',
        fleet: ['Maruti Suzuki WagonR', 'Tata Tiago', 'Hyundai Santro'],
        baseFareForPackage: 1112,
        extraKmRate: 10.2,
        extraMinRate: 1.5,
        description: 'A regular comfortable hatchback that becomes your everyday ride.'
      },
      {
        id: 4,
        productId: 4,
        code: 'PROD_SEDAN',
        name: 'Prime Sedan',
        category: 'Sedan',
        tag: 'Top rated drivers, extra boot space',
        seats: 4,
        fare: 245,
        eta: '3 min away',
        icon: '🚕',
        fleet: ['Maruti Suzuki Dzire', 'Toyota Etios', 'Honda Amaze'],
        baseFareForPackage: 1450,
        extraKmRate: 11.5,
        extraMinRate: 1.8,
        description: 'Top-rated drivers, comfortable sedans with extra legroom.'
      },
      {
        id: 5,
        productId: 5,
        code: 'PROD_SUV',
        name: 'Prime SUV',
        category: 'SUV',
        tag: 'Spacious 6-seater SUVs',
        seats: 6,
        fare: 350,
        eta: '5 min away',
        icon: '🚙',
        fleet: ['Toyota Innova', 'Maruti Suzuki Ertiga', 'Mahindra Marazzo'],
        baseFareForPackage: 1980,
        extraKmRate: 13.5,
        extraMinRate: 2.0,
        description: 'Spacious 6-seater SUVs for comfortable group travel.'
      }
    ];

    this.selectedVehicle = this.vehiclesList[3]; // Default Prime Sedan
  }

  setCategory(cat: 'DAILY_RIDES' | 'RENTALS' | 'OUTSTATION' | 'EQUIPMENT'): void {
    this.activeCategory = cat;
    this.recalculateAuthoritativeQuote();
  }

  setOutstationMode(mode: 'ONE_WAY' | 'ROUND_TRIP'): void {
    this.outstationMode = mode;
    this.computeIsoTimestamps();
    this.recalculateAuthoritativeQuote();
  }

  selectRentalPackage(pkg: RentalPackage): void {
    this.selectedRentalPackage = pkg;
    this.recalculateAuthoritativeQuote();
  }

  selectVehicle(v: DynamicVehicleCard): void {
    this.selectedVehicle = v;
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
    this.scheduleDisplayString = `${this.wheelDays[this.selectedLeaveDayIndex].label}, ${this.selectedLeaveHour}:${this.selectedLeaveMinute} ${this.selectedLeavePeriod}`;
    this.computeIsoTimestamps();
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

  openDestinationPicker(): void {
    this.showDestinationSearch = true;
  }

  selectDestination(dest: { name: string; lat: number; lng: number }): void {
    this.destinationLocation = `${dest.name}, India`;
    this.destLat = dest.lat;
    this.destLng = dest.lng;
    this.showDestinationSearch = false;
    this.recalculateAuthoritativeQuote();
  }

  /**
   * Generates authoritative server quotation using POST /api/v1/bookings/quote
   */
  recalculateAuthoritativeQuote(): void {
    if (!this.selectedVehicle) return;

    let bType = 'LOCAL_RIDE';
    let dist = 18.0;
    let hours = 0.8;

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
            this.selectedVehicle.fare = q.totalEstimatedFare || bd.totalAmount || this.selectedVehicle.fare;
          }
        }
      },
      error: () => {
        this.isCalculatingFare = false;
        // Keep resilient local calculations
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
      distanceAmount: 0,
      timeAmount: 0,
      extraKmCharge: 0,
      nightAllowance: this.activeCategory === 'OUTSTATION' ? 300 : 0,
      driverAllowance: this.activeCategory === 'OUTSTATION' ? 400 : 0,
      taxes: tax,
      convenienceFee: fee,
      totalFare: total
    };

    if (this.selectedVehicle) {
      this.selectedVehicle.fare = total;
    }
  }

  openReviewBooking(): void {
    this.recalculateAuthoritativeQuote();
    this.showReviewBookingModal = true;
  }

  closeReviewBooking(): void {
    this.showReviewBookingModal = false;
  }

  /**
   * Confirm booking with server-authoritative quotation and actual backend confirmation API
   */
  submitRealBooking(): void {
    if (!this.selectedVehicle) return;

    this.isBookingSubmitting = true;
    this.errorMessage = '';

    let bType = 'LOCAL';
    if (this.activeCategory === 'RENTALS') bType = 'RENTAL';
    else if (this.activeCategory === 'OUTSTATION') bType = 'OUTSTATION';
    else if (this.activeCategory === 'EQUIPMENT') bType = 'HEAVY_EQUIPMENT';

    const idempotencyKey = `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const bookingPayload = {
      productId: this.selectedVehicle.productId,
      bookingType: bType,
      rentalPackage: this.activeCategory === 'RENTALS' && this.selectedRentalPackage ? this.selectedRentalPackage.name : null,
      outstationTripType: this.activeCategory === 'OUTSTATION' ? this.outstationMode : null,
      bookingDate: this.scheduleDisplayString.split(',')[0].trim(),
      bookingTime: this.scheduleDisplayString.split(',')[1]?.trim() || '07:15 PM',
      scheduledPickupAt: this.scheduledPickupIso,
      returnAt: this.outstationMode === 'ROUND_TRIP' ? this.scheduledReturnIso : null,
      pickupAddressText: this.pickupLocation,
      destinationAddressText: this.destinationLocation,
      pickupLatitude: this.pickupLat,
      pickupLongitude: this.pickupLng,
      dropLatitude: this.destLat,
      dropLongitude: this.destLng,
      paymentMethod: this.paymentMode,
      distanceKm: this.currentQuotation?.estimatedDistanceKm || (this.activeCategory === 'OUTSTATION' ? 260 : 25),
      durationHours: this.currentQuotation?.estimatedDurationHours || (this.activeCategory === 'RENTALS' ? 4 : 1),
      idempotencyKey
    };

    this.bookingService.confirmBooking(bookingPayload).subscribe({
      next: (res) => {
        this.isBookingSubmitting = false;
        this.showReviewBookingModal = false;
        this.showConfirmPickupSheet = false;

        const booking = res?.data || (res as any);
        this.confirmedBookingReference = booking;

        if (this.paymentMode === 'Online' && booking && booking.id) {
          // Trigger Razorpay payment flow
          this.handleRazorpayPayment(booking);
        } else {
          // If scheduled ride, show Ride Scheduled confirmation dialog
          if (bType === 'SCHEDULED' || this.scheduledPickupIso) {
            this.showRideScheduledSuccessModal = true;
          } else {
            // Immediate booking: navigate straight to Bookings with live driver allocation tracking!
            this.router.navigate(['/bookings'], { queryParams: { tab: 'Ongoing', activeId: booking.id } });
          }
        }
      },
      error: (err) => {
        this.isBookingSubmitting = false;
        this.errorMessage = err?.error?.message || 'Booking submission failed. Please check your network and retry.';
        console.error('Booking failed:', err);
      }
    });
  }

  handleRazorpayPayment(booking: Booking): void {
    this.bookingService.createRazorpayOrder(booking.id).subscribe({
      next: (res) => {
        const orderData = res?.data;
        if (!orderData || !isPlatformBrowser(this.platformId)) {
          this.router.navigate(['/bookings'], { queryParams: { tab: 'Ongoing', activeId: booking.id } });
          return;
        }

        const Razorpay = (window as any).Razorpay;
        if (Razorpay) {
          const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency || 'INR',
            name: 'Rentron Mobility & Equipment',
            description: `Payment for Booking #${orderData.bookingNumber}`,
            order_id: orderData.orderId,
            handler: (response: any) => {
              // Authoritatively verify signature on backend
              this.bookingService.verifyPaymentSignature({
                bookingId: booking.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              }).subscribe({
                next: () => {
                  this.router.navigate(['/bookings'], { queryParams: { tab: 'Ongoing', activeId: booking.id } });
                },
                error: () => {
                  this.router.navigate(['/bookings'], { queryParams: { tab: 'Ongoing', activeId: booking.id } });
                }
              });
            },
            prefill: {
              name: 'Rentron Customer',
              contact: '+919876543210'
            },
            theme: {
              color: '#f59e0b'
            }
          };

          const rzpInstance = new Razorpay(options);
          rzpInstance.open();
        } else {
          // Mock verification in local environments without razorpay CDN
          this.bookingService.verifyPaymentSignature({
            bookingId: booking.id,
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: 'pay_test_' + Date.now(),
            razorpaySignature: 'mock_signature'
          }).subscribe({
            next: () => {
              this.router.navigate(['/bookings'], { queryParams: { tab: 'Ongoing', activeId: booking.id } });
            }
          });
        }
      },
      error: () => {
        this.router.navigate(['/bookings'], { queryParams: { tab: 'Ongoing', activeId: booking.id } });
      }
    });
  }

  closeRideScheduledDialog(): void {
    this.showRideScheduledSuccessModal = false;
    this.router.navigate(['/bookings'], { queryParams: { tab: 'Ongoing' } });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  ngOnDestroy(): void {
    // Clean up
  }
}
