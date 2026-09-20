import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BookingService, MachineryItem, BookingDetails } from '../../core/services/booking.service';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, BottomNavComponent],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.scss'
})
export class BookingFlowComponent implements OnInit {
  // Steps: 'machinery' | 'attachments' | 'schedule' | 'duration' | 'radar_search' | 'payment_advance' | 'confirmed'
  currentStep: 'machinery' | 'attachments' | 'schedule' | 'duration' | 'radar_search' | 'payment_advance' | 'confirmed' = 'machinery';

  selectedMachinery: MachineryItem | null = null;
  selectedAttachments: string[] = [];

  // Date / Time state
  selectedMonth: string = 'September 2026';
  days = [
    { dayNum: '02', dayName: 'Wed', active: false },
    { dayNum: '03', dayName: 'Thu', active: false },
    { dayNum: '04', dayName: 'Fri', active: false },
    { dayNum: '05', dayName: 'Sat', active: false },
    { dayNum: '06', dayName: 'Sun', active: true },
    { dayNum: '07', dayName: 'Mon', active: false }
  ];
  selectedTime: string = '08:00 AM';

  // Duration selection
  durations = [
    { id: '1h', label: '1 Hour', subtitle: 'Emergency / Short Job', price: 1000, badge: '' },
    { id: '4h', label: '4 Hours', subtitle: 'Half Day Work', price: 3600, badge: '10% OFF' },
    { id: '8h', label: '8 Hours', subtitle: 'Full Day Shift (Recommended)', price: 6400, badge: '20% OFF', active: true },
    { id: '1d', label: '1 Day (24 Hrs)', subtitle: '24 Hrs Site Hold', price: 10000, badge: '' },
    { id: 'custom', label: 'Custom Duration', subtitle: 'Specify hours for project', price: 15000, badge: '' }
  ];
  selectedDuration = this.durations[2];

  // Pricing calculation
  equipmentRate: number = 6400;
  gstRate: number = 1152; // 18%
  transportFee: number = 900;
  get totalAmount(): number {
    return this.equipmentRate + this.gstRate + this.transportFee;
  }
  get advanceAmount(): number {
    return Math.round(this.totalAmount * 0.30);
  }

  // Radar Operator search simulation
  operatorFound: boolean = false;
  foundOperatorData = {
    name: 'Arun Kumar',
    rating: 4.8,
    phone: '+91 98765 12345',
    machine: 'JCB 3DX Super Eco',
    eta: '15 mins'
  };

  paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallet' = 'upi';

  machineryList: MachineryItem[] = [];

  constructor(
    private bookingService: BookingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.machineryList = this.bookingService.getMachineryCatalog();
    this.bookingService.selectedMachinery$.subscribe(item => {
      if (item) {
        this.selectedMachinery = item;
      } else {
        this.selectedMachinery = this.machineryList[0];
      }
    });
  }

  selectMachinery(item: MachineryItem): void {
    this.selectedMachinery = item;
    this.equipmentRate = item.hourlyRate * 8;
    this.currentStep = 'attachments';
  }

  toggleAttachment(id: string): void {
    const idx = this.selectedAttachments.indexOf(id);
    if (idx > -1) {
      this.selectedAttachments.splice(idx, 1);
    } else {
      this.selectedAttachments.push(id);
    }
  }

  goToSchedule(): void {
    this.currentStep = 'schedule';
  }

  selectDay(dayNum: string): void {
    this.days.forEach(d => d.active = (d.dayNum === dayNum));
  }

  goToDuration(): void {
    this.currentStep = 'duration';
  }

  selectDurationOption(dur: any): void {
    this.durations.forEach(d => d.active = (d.id === dur.id));
    this.selectedDuration = dur;
    this.equipmentRate = dur.price;
    this.gstRate = Math.round(dur.price * 0.18);
  }

  startOperatorSearch(): void {
    this.currentStep = 'radar_search';
    this.operatorFound = false;

    // Simulate operator matching after 3 seconds
    setTimeout(() => {
      this.operatorFound = true;
    }, 3000);
  }

  goToPayment(): void {
    this.currentStep = 'payment_advance';
  }

  confirmAndPay(): void {
    this.currentStep = 'confirmed';
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
