import { Component, OnInit, inject, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

export interface BookingRecord {
  id: string;
  bookingNumber: string;
  machineName: string;
  machineType: string;
  machineImage: string;
  siteName: string;
  siteAddress: string;
  startDate: string;
  timeSlot: string;
  eta: string;
  totalAmount: number;
  advancePaid: number;
  balanceAmount: number;
  status: 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  operatorName: string;
  operatorPhone: string;
  vehicleNumber: string;
  operatorRating: number;
  description: string;
  latitude: number;
  longitude: number;
  cancelReason?: string;
  refundAmount?: number;
}

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, BottomNavComponent],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss'
})
export class BookingsComponent implements OnInit, AfterViewInit {
  private platformId = inject(PLATFORM_ID);
  private bookingService = inject(BookingService);
  private router = inject(Router);

  activeTab: 'ONGOING' | 'COMPLETED' | 'CANCELLED' = 'ONGOING';

  bookingsList: BookingRecord[] = [
    {
      id: 'b-860201',
      bookingNumber: '#860201',
      machineName: 'JCB 3DX Super Eco',
      machineType: 'Backhoe Loader',
      machineImage: '🚜',
      siteName: 'Metro Construction Site',
      siteAddress: 'Sector 18, Noida, Uttar Pradesh',
      startDate: 'May 15, 2026',
      timeSlot: '08:00 AM - 05:00 PM',
      eta: '08:45 AM',
      totalAmount: 2400,
      advancePaid: 710,
      balanceAmount: 1690,
      status: 'ONGOING',
      operatorName: 'Arun Kumar',
      operatorPhone: '+91 98765 12345',
      vehicleNumber: 'TN 09 AB 1234',
      operatorRating: 4.9,
      description: '3DX-3D0 with extended dipper arm, rock breaker line installed, heavy duty teeth',
      latitude: 28.5700,
      longitude: 77.3200
    },
    {
      id: 'b-860199',
      bookingNumber: '#860199',
      machineName: 'JCB 3DX Heavy Excavator',
      machineType: 'Backhoe Loader',
      machineImage: '🚜',
      siteName: 'Metro Construction Site Gate 2',
      siteAddress: 'Sector 21, Industrial Zone, Noida',
      startDate: 'May 02, 2026',
      timeSlot: '09:00 AM - 06:00 PM',
      eta: '09:00 AM',
      totalAmount: 6800,
      advancePaid: 2040,
      balanceAmount: 4760,
      status: 'COMPLETED',
      operatorName: 'Suresh Kumar',
      operatorPhone: '+91 98765 67890',
      vehicleNumber: 'UP 16 CD 5678',
      operatorRating: 5.0,
      description: 'Heavy digging & trench excavation with 1.1 cu.m reinforced bucket.',
      latitude: 28.5800,
      longitude: 77.3300
    },
    {
      id: 'b-860198',
      bookingNumber: '#860198',
      machineName: 'Mini Excavator (3-5 Ton)',
      machineType: 'Compact Excavator',
      machineImage: '🏗️',
      siteName: 'Commercial Complex Yard',
      siteAddress: 'Okhla Phase 3, New Delhi',
      startDate: 'Apr 28, 2026',
      timeSlot: '10:00 AM - 02:00 PM',
      eta: '10:00 AM',
      totalAmount: 3600,
      advancePaid: 1110,
      balanceAmount: 2490,
      status: 'CANCELLED',
      operatorName: 'Ramesh Singh',
      operatorPhone: '+91 98765 43210',
      vehicleNumber: 'DL 01 EF 9012',
      operatorRating: 4.7,
      description: 'Compact excavator for utility pipeline installation.',
      latitude: 28.5400,
      longitude: 77.2700,
      cancelReason: 'Site clearance postponed',
      refundAmount: 1110
    }
  ];

  selectedBooking: BookingRecord | null = null;
  showJobDetailsModal: boolean = false;

  // Work Timer state for ongoing job
  isWorkStarted: boolean = false;
  workTimerSeconds: number = 252; // 00:04:12
  workTimerInterval: any = null;

  // Cancellation Flow state
  showCancelModal: boolean = false;
  cancelReason: string = 'Site clearance postponed';
  cancelOtherNotes: string = '';
  showCancelledConfirmationModal: boolean = false;
  cancelledRefundSummary: any = null;

  // Completion & Feedback flow state
  showWorkCompletedModal: boolean = false;
  showPaymentReceiptModal: boolean = false;
  showFeedbackModal: boolean = false;
  selectedStarRating: number = 5;
  feedbackTags = [
    { label: 'Punctual', selected: true },
    { label: 'Skilled Work', selected: true },
    { label: 'Clean Equipment', selected: false },
    { label: 'Polite Behavior', selected: true },
    { label: 'Safe Execution', selected: false }
  ];
  feedbackNotes: string = '';
  showFeedbackSubmittedSuccess: boolean = false;

  ngOnInit(): void {
    this.bookingService.getMyBookings().subscribe({
      next: (res: any) => {
        const list = res?.data || res;
        if (Array.isArray(list) && list.length > 0) {
          // Merge with backend response if valid
        }
      }
    });

    this.startWorkTimer();
  }

  ngAfterViewInit(): void {}

  startWorkTimer(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.workTimerInterval = setInterval(() => {
        this.workTimerSeconds++;
      }, 1000);
    }
  }

  get formattedWorkTimer(): string {
    const hrs = Math.floor(this.workTimerSeconds / 3600);
    const mins = Math.floor((this.workTimerSeconds % 3600) / 60);
    const secs = this.workTimerSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }

  get filteredBookings(): BookingRecord[] {
    return this.bookingsList.filter(b => b.status === this.activeTab);
  }

  setTab(tab: 'ONGOING' | 'COMPLETED' | 'CANCELLED'): void {
    this.activeTab = tab;
  }

  openJobDetails(booking: BookingRecord): void {
    this.selectedBooking = booking;
    this.showJobDetailsModal = true;
    setTimeout(() => {
      this.renderMiniMap();
    }, 150);
  }

  closeJobDetails(): void {
    this.showJobDetailsModal = false;
  }

  renderMiniMap(): void {
    if (!isPlatformBrowser(this.platformId) || !this.selectedBooking) return;
    const L = (window as any).L;
    if (!L) return;

    const mapContainer = document.getElementById('jobDetailsMiniMap');
    if (!mapContainer) return;

    mapContainer.innerHTML = '';
    const map = L.map(mapContainer, {
      zoomControl: false,
      attributionControl: false
    }).setView([this.selectedBooking.latitude, this.selectedBooking.longitude], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const greenIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    L.marker([this.selectedBooking.latitude, this.selectedBooking.longitude], { icon: greenIcon }).addTo(map);
  }

  goToTrack(booking?: BookingRecord): void {
    this.closeJobDetails();
    this.router.navigate(['/track'], { queryParams: { bookingId: (booking || this.selectedBooking)?.id } });
  }

  // Cancellation Flow
  openCancelFlow(): void {
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
  }

  confirmCancellation(): void {
    if (!this.selectedBooking) return;

    this.showCancelModal = false;
    this.selectedBooking.status = 'CANCELLED';
    this.selectedBooking.cancelReason = this.cancelReason === 'Other' ? this.cancelOtherNotes : this.cancelReason;
    this.selectedBooking.refundAmount = this.selectedBooking.advancePaid;

    this.cancelledRefundSummary = {
      bookingNumber: this.selectedBooking.bookingNumber,
      machineName: this.selectedBooking.machineName,
      refundAmount: this.selectedBooking.advancePaid,
      refundPercent: '20% Advance Paid',
      refundAccount: 'Original UPI / Wallet Account'
    };

    this.showCancelledConfirmationModal = true;
  }

  closeCancelledConfirmation(): void {
    this.showCancelledConfirmationModal = false;
    this.closeJobDetails();
    this.activeTab = 'CANCELLED';
  }

  // Work Completion & Feedback Flow
  openWorkCompletedFlow(): void {
    this.showWorkCompletedModal = true;
  }

  closeWorkCompletedModal(): void {
    this.showWorkCompletedModal = false;
  }

  payCompletedBalance(): void {
    this.showWorkCompletedModal = false;
    this.showPaymentReceiptModal = true;
  }

  openFeedbackModal(): void {
    this.showPaymentReceiptModal = false;
    this.showFeedbackModal = true;
  }

  setStarRating(stars: number): void {
    this.selectedStarRating = stars;
  }

  toggleTag(tag: any): void {
    tag.selected = !tag.selected;
  }

  submitFeedback(): void {
    this.showFeedbackModal = false;
    this.showFeedbackSubmittedSuccess = true;
    setTimeout(() => {
      this.showFeedbackSubmittedSuccess = false;
      if (this.selectedBooking) {
        this.selectedBooking.status = 'COMPLETED';
      }
      this.closeJobDetails();
      this.activeTab = 'COMPLETED';
    }, 2000);
  }
}
