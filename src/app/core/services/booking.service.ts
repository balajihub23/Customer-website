import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface MachineryItem {
  id: string;
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

export interface BookingDetails {
  id?: string;
  machineryId: string;
  machineryName: string;
  startDate: string;
  startTime: string;
  durationHours: number;
  equipmentAmount: number;
  gstAmount: number;
  transportAmount: number;
  totalAmount: number;
  advanceAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private readonly baseUrl = environment.serverApi;

  machineryCatalog: MachineryItem[] = [
    {
      id: 'jcb-3dx',
      name: 'JCB 3DX Super Eco',
      category: 'Construction',
      type: 'Backhoe Loader',
      hourlyRate: 1000,
      dailyRate: 8000,
      advancePercentage: 30,
      image: '🚜',
      capacity: '1.1 cu.m Bucket',
      specs: '76 HP • 4.7m Dig Depth',
      description: 'Versatile heavy equipment for excavation, trenching, loading, and earthmoving.'
    },
    {
      id: 'mini-excavator',
      name: 'Mini Excavator (3-5 Ton)',
      category: 'Construction',
      type: 'Excavator',
      hourlyRate: 850,
      dailyRate: 6800,
      advancePercentage: 30,
      image: '🏗️',
      capacity: '0.2 cu.m Bucket',
      specs: '40 HP • Compact Digging',
      description: 'Ideal for urban sites, landscaping, narrow trenching, and utility works.'
    },
    {
      id: 'heavy-excavator',
      name: 'Heavy Excavator (20 Ton)',
      category: 'Construction',
      type: 'Excavator',
      hourlyRate: 1800,
      dailyRate: 14400,
      advancePercentage: 30,
      image: '🏗️',
      capacity: '1.2 cu.m Bucket',
      specs: '140 HP • High Output Digging',
      description: 'Heavy duty crawler excavator for mining, quarrying, and foundation excavation.'
    },
    {
      id: 'road-roller',
      name: 'Vibratory Soil Roller',
      category: 'Construction',
      type: 'Compactor',
      hourlyRate: 1200,
      dailyRate: 9600,
      advancePercentage: 30,
      image: '🚜',
      capacity: '10 Ton Compactor',
      specs: 'Single Drum • High Impact',
      description: 'Used for soil compaction, road base preparation, and asphalt rolling.'
    },
    {
      id: 'mobile-crane',
      name: 'Hydraulic Mobile Crane',
      category: 'Construction',
      type: 'Crane',
      hourlyRate: 2200,
      dailyRate: 17600,
      advancePercentage: 30,
      image: '🏗️',
      capacity: '25 Ton Lifting',
      specs: 'Telescopic Boom • 32m Reach',
      description: 'For heavy lifting, structural erection, and equipment placing.'
    },
    {
      id: 'cab-ride',
      name: 'AC Sedan Taxi',
      category: 'Ride',
      type: 'Taxi',
      hourlyRate: 350,
      dailyRate: 2800,
      advancePercentage: 20,
      image: '🚕',
      capacity: '4 Passengers',
      specs: 'Air Conditioned • Clean Sedan',
      description: 'Comfortable city and outstation rides with verified drivers.'
    },
    {
      id: 'bike-taxi',
      name: 'Express Bike Taxi',
      category: 'Ride',
      type: 'Bike',
      hourlyRate: 150,
      dailyRate: 1200,
      advancePercentage: 15,
      image: '🛵',
      capacity: '1 Passenger',
      specs: 'Quick Ride • Helmet Included',
      description: 'Fastest way to beat city traffic for solo commuters.'
    }
  ];

  private selectedMachinerySubject = new BehaviorSubject<MachineryItem | null>(this.machineryCatalog[0]);
  selectedMachinery$ = this.selectedMachinerySubject.asObservable();

  getMachineryCatalog(): MachineryItem[] {
    return this.machineryCatalog;
  }

  getMachineryById(id: string): MachineryItem | undefined {
    return this.machineryCatalog.find(m => m.id === id);
  }

  setSelectedMachinery(idOrItem: string | MachineryItem): void {
    if (typeof idOrItem === 'string') {
      const found = this.getMachineryById(idOrItem) || this.machineryCatalog.find(m => m.id.includes(idOrItem)) || this.machineryCatalog[0];
      this.selectedMachinerySubject.next(found);
    } else {
      this.selectedMachinerySubject.next(idOrItem);
    }
  }

  createBooking(bookingData: any): Observable<any> {
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ success: true, message: 'Mock booking confirmed', data: { id: Date.now(), ...bookingData } });
    }
    return this.http.post<any>(`${this.baseUrl}/api/v1/bookings`, bookingData);
  }

  getMyBookings(): Observable<any> {
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ success: true, data: [] });
    }
    return this.http.get<any>(`${this.baseUrl}/api/v1/bookings/my-bookings`);
  }
}
