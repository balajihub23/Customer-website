import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, catchError, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  productType: 'RIDE' | 'HEAVY_EQUIPMENT' | 'JCB' | 'BIKE' | 'AUTO' | 'CAR' | string;
  category: 'BIKE' | 'AUTO' | 'MINI' | 'SEDAN' | 'SUV' | 'EXCAVATOR' | 'CRANE' | 'ROLLER' | string;
  description?: string;
  imageUrl?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RentalPackage {
  id: number;
  name: string;
  vehicleCategory: string; // ALL, MINI, SEDAN, SUV
  includedHours: number;
  includedKm: number;
  basePackageFare: number;
  extraKmPrice: number;
  extraHourPrice: number;
  bookingFee: number;
  taxPercentage: number;
  active: boolean;
}

export interface QuotationRequest {
  bookingType: 'LOCAL' | 'LOCAL_RIDE' | 'SCHEDULED' | 'RENTAL' | 'OUTSTATION' | 'HEAVY_EQUIPMENT' | string;
  productId: number;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropLatitude?: number;
  dropLongitude?: number;
  pickupAddress?: string;
  destinationAddress?: string;
  scheduledPickupAt?: string; // ISO 8601 LocalDateTime e.g. 2026-10-18T19:30:00
  returnAt?: string;
  rentalPackageId?: number;
  rentalPackageName?: string;
  outstationTripType?: 'ONE_WAY' | 'ROUND_TRIP';
  distanceKm?: number;
  durationHours?: number;
  waitingMinutes?: number;
  operatorRequired?: boolean;
}

export interface QuotationResponse {
  quotationId: string;
  quotationExpiry: string;
  productId: number;
  productName: string;
  productType: string;
  vehicleCategory: string;
  bookingType: string;
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  estimatedDurationHours: number;
  totalEstimatedFare: number;
  currency: string;
  pricingVersion: string;
  itemizedFareBreakdown: {
    baseAmount?: number;
    distanceAmount?: number;
    timeAmount?: number;
    waitingAmount?: number;
    driverAmount?: number;
    operatorAmount?: number;
    bookingFee?: number;
    taxAmount?: number;
    subtotal?: number;
    totalAmount?: number;
    effectiveKm?: number;
    perKmRate?: number;
    driverDailyAllowance?: number;
    nightTimeAllowance?: number;
    [key: string]: any;
  };
}

export interface Booking {
  id: number;
  bookingNumber: string;
  customerId: number;
  driverId?: number;
  contractorId?: number;
  vehicleId?: number;
  productId: number;
  productName?: string;
  bookingType: 'LOCAL' | 'SCHEDULED' | 'RENTAL' | 'OUTSTATION' | 'HEAVY_EQUIPMENT' | string;
  rentalPackage?: string;
  outstationTripType?: 'ONE_WAY' | 'ROUND_TRIP';
  status: 
    | 'PENDING' 
    | 'CONFIRMED' 
    | 'SCHEDULED' 
    | 'SEARCHING_DRIVER' 
    | 'ASSIGNED' 
    | 'ACCEPTED' 
    | 'DRIVER_ON_THE_WAY' 
    | 'ARRIVED' 
    | 'STARTED' 
    | 'IN_PROGRESS' 
    | 'COMPLETED' 
    | 'CANCELLED' 
    | 'REJECTED' 
    | 'NO_DRIVER_AVAILABLE'
    | string;
  paymentMethod: 'Cash' | 'Online' | 'CASH' | 'ONLINE' | string;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | string;
  otpVerifiedAt?: string;
  bookingDate?: string;
  bookingTime?: string;
  scheduledPickupAt?: string;
  returnAt?: string;
  pickupAddressText?: string;
  stopAddressText?: string;
  stopAddress?: string;
  stopLatitude?: number;
  stopLongitude?: number;
  destinationAddressText?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropLatitude?: number;
  dropLongitude?: number;
  distanceKm?: number;
  durationHours?: number;
  baseAmount?: number;
  distanceAmount?: number;
  timeAmount?: number;
  waitingAmount?: number;
  driverAmount?: number;
  operatorAmount?: number;
  bookingFee?: number;
  taxAmount?: number;
  discountAmount?: number;
  driverTip?: number;
  totalAmount: number;
  finalFare?: number;
  estimatedFare?: number;
  otp?: string;
  cancellationReason?: string;
  fareBreakdownSnapshot?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LiveTrackingData {
  bookingId: number;
  bookingNumber: string;
  status: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropLatitude: number;
  dropLongitude: number;
  driverId?: number;
  driverName?: string;
  driverPhone?: string;
  driverLatitude?: number;
  driverLongitude?: number;
  driverRating?: number;
  vehicleType?: string;
  vehicleRegistration?: string;
  locationUpdatedAt?: string;
}

export interface AllocationProgressData {
  bookingId: number;
  status: string;
  totalOffersMade: number;
  activeOffers: number;
  driverAssigned: boolean;
  assignedDriverId?: number;
  recentAssignments?: any[];
}

export interface InvoiceData {
  bookingId: number;
  bookingNumber: string;
  invoiceNumber: string;
  date: string;
  customerId: number;
  bookingType: string;
  pickupAddress: string;
  destinationAddress: string;
  distanceKm: number;
  durationHours: number;
  baseAmount: number;
  distanceAmount: number;
  timeAmount: number;
  driverAmount: number;
  waitingAmount: number;
  bookingFee: number;
  discountAmount: number;
  taxAmount: number;
  driverTip: number;
  totalAmount: number;
  finalFare: number;
  paymentMethod: string;
  paymentStatus: string;
}

export interface MachineryItem {
  id: string;
  productId?: number;
  name: string;
  category: 'Construction' | 'Ride';
  type: string;
  hourlyRate: number;
  dailyRate: number;
  advancePercentage: number;
  image: string;
  capacity?: string;
  specs?: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private readonly baseUrl = environment.serverApi;

  // Selected Machinery Subject for quick binding
  private selectedMachinerySubject = new BehaviorSubject<MachineryItem | null>(null);
  selectedMachinery$ = this.selectedMachinerySubject.asObservable();

  /**
   * 1. Dynamic Catalog: Fetch active products from backend
   * GET /api/v1/products
   */
  getActiveProducts(): Observable<ApiResponse<Product[]>> {
    return this.http.get<ApiResponse<Product[]>>(`${this.baseUrl}/api/v1/products`);
  }

  getProducts(): Observable<ApiResponse<Product[]>> {
    return this.getActiveProducts();
  }

  getProductById(id: number | string): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.baseUrl}/api/v1/products/${id}`);
  }

  /**
   * 2. Rental Packages: Fetch active packages from backend
   * GET /api/v1/rental-packages/active
   */
  getActiveRentalPackages(vehicleCategory?: string): Observable<ApiResponse<RentalPackage[]>> {
    let url = `${this.baseUrl}/api/v1/rental-packages/active`;
    if (vehicleCategory) {
      url += `?vehicleCategory=${encodeURIComponent(vehicleCategory)}`;
    }
    return this.http.get<ApiResponse<RentalPackage[]>>(url);
  }

  /**
   * 3. Server-Authoritative Quotation API
   * POST /api/v1/bookings/quote
   */
  getAuthoritativeQuote(request: QuotationRequest): Observable<ApiResponse<QuotationResponse>> {
    return this.http.post<ApiResponse<QuotationResponse>>(`${this.baseUrl}/api/v1/bookings/quote`, request);
  }

  /**
   * Backward-compatible price calculation endpoint
   * POST /api/v1/pricings/calculate
   */
  calculatePrice(params: {
    productId: number | string;
    distanceKm?: number;
    durationHours?: number;
    waitingMinutes?: number;
    bookingType?: string;
    rentalPackage?: string;
    outstationTripType?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/v1/pricings/calculate`, params);
  }

  /**
   * 4. Booking Confirmation API
   * POST /api/v1/bookings/confirm
   */
  confirmBooking(bookingData: Partial<Booking> | any): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(`${this.baseUrl}/api/v1/bookings/confirm`, bookingData);
  }

  createBooking(bookingData: any): Observable<ApiResponse<Booking>> {
    return this.confirmBooking(bookingData);
  }

  /**
   * 5. Authenticated Bookings List
   * GET /api/v1/bookings
   */
  getMyBookings(): Observable<ApiResponse<Booking[]>> {
    return this.http.get<ApiResponse<Booking[]>>(`${this.baseUrl}/api/v1/bookings`);
  }

  /**
   * 6. Booking Detail by ID
   * GET /api/v1/bookings/{id}
   */
  getBookingById(id: number | string): Observable<ApiResponse<Booking>> {
    return this.http.get<ApiResponse<Booking>>(`${this.baseUrl}/api/v1/bookings/${id}`);
  }

  /**
   * 7. Live Tracking Information
   * GET /api/v1/bookings/{id}/track
   */
  getLiveTracking(id: number | string): Observable<ApiResponse<LiveTrackingData>> {
    return this.http.get<ApiResponse<LiveTrackingData>>(`${this.baseUrl}/api/v1/bookings/${id}/track`);
  }

  /**
   * 8. Allocation Progress (Searching Driver State)
   * GET /api/v1/bookings/{id}/allocation-progress
   */
  getAllocationProgress(id: number | string): Observable<ApiResponse<AllocationProgressData>> {
    return this.http.get<ApiResponse<AllocationProgressData>>(`${this.baseUrl}/api/v1/bookings/${id}/allocation-progress`);
  }

  /**
   * 9. Booking Invoice / Receipt
   * GET /api/v1/bookings/{id}/invoice
   */
  getInvoice(id: number | string): Observable<ApiResponse<InvoiceData>> {
    return this.http.get<ApiResponse<InvoiceData>>(`${this.baseUrl}/api/v1/bookings/${id}/invoice`);
  }

  /**
   * 10. Customer Booking Cancellation
   * POST /api/v1/bookings/{id}/cancel?reason=...
   */
  cancelBooking(id: number | string, reason?: string): Observable<ApiResponse<Booking>> {
    let url = `${this.baseUrl}/api/v1/bookings/${id}/cancel`;
    if (reason) {
      url += `?reason=${encodeURIComponent(reason)}`;
    }
    return this.http.post<ApiResponse<Booking>>(url, null);
  }

  /**
   * 11. Driver Tip
   * POST /api/v1/bookings/{id}/tip?amount=...
   */
  addTip(id: number | string, amount: number): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(`${this.baseUrl}/api/v1/bookings/${id}/tip?amount=${amount}`, null);
  }

  /**
   * 12. Razorpay Order Creation
   * POST /api/v1/payments/create-order
   */
  getBookingSettings(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/api/v1/settings/booking`);
  }

  createRazorpayOrder(bookingId: number | string): Observable<ApiResponse<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    bookingNumber: string;
  }>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/api/v1/payments/create-order`, { bookingId });
  }

  /**
   * 13. Razorpay Payment Signature Verification
   * POST /api/v1/payments/verify-signature
   */
  verifyPaymentSignature(payload: {
    bookingId: number | string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.baseUrl}/api/v1/payments/verify-signature`, payload);
  }

  /**
   * Search nearby active drivers around coordinates
   * GET /api/v1/drivers/search-nearby
   */
  rateDriver(bookingId: number, score: number, comment?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/api/v1/bookings/${bookingId}/rate`, { score, comment });
  }

  searchNearbyDrivers(latitude: number, longitude: number, radiusKm?: number, vehicleType?: string): Observable<ApiResponse<any[]>> {
    let url = `${this.baseUrl}/api/v1/drivers/search-nearby?latitude=${latitude}&longitude=${longitude}`;
    if (radiusKm !== undefined && radiusKm !== null && radiusKm > 0) {
      url += `&radiusKm=${radiusKm}`;
    }
    if (vehicleType) {
      url += `&vehicleType=${encodeURIComponent(vehicleType)}`;
    }
    return this.http.get<ApiResponse<any[]>>(url);
  }

  // Fallback Machinery Catalog helper
  setSelectedMachinery(item: MachineryItem | string): void {
    if (typeof item === 'string') {
      const found = this.cachedMachineryCatalog.find(
        m => m.id === item || String(m.id).toLowerCase() === item.toLowerCase()
      );
      if (found) {
        this.selectedMachinerySubject.next(found);
      } else {
        this.selectedMachinerySubject.next({
          id: item,
          name: item,
          category: 'Construction',
          type: 'Heavy Equipment',
          hourlyRate: 1000,
          dailyRate: 8000,
          advancePercentage: 30,
          image: '🚜',
          description: 'Heavy equipment machinery'
        });
      }
    } else {
      this.selectedMachinerySubject.next(item);
    }
  }

  private cachedMachineryCatalog: MachineryItem[] = [];

  getMachineryCatalog(): Observable<ApiResponse<MachineryItem[]>> {
    return this.http.get<ApiResponse<MachineryItem[]>>(`${this.baseUrl}/api/v1/products/machinery-catalog`).pipe(
      tap((res: ApiResponse<MachineryItem[]>) => {
        if (res && res.data && Array.isArray(res.data)) {
          this.cachedMachineryCatalog = res.data;
        }
      })
    );
  }

  getLoadedMachineryCatalog(): MachineryItem[] {
    return this.cachedMachineryCatalog;
  }
}
