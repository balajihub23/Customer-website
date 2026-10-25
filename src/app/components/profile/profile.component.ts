import { Component, OnInit, inject, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { CustomerService, CustomerProfile } from '../../core/services/customer.service';
import { AuthService } from '../../core/services/auth.service';
import { SupportService, SupportTicket, SupportMessage } from '../../core/services/support.service';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { LogoutModalComponent } from '../../shared/components/logout-modal/logout-modal.component';

export type ProfileSubView = 
  | 'MAIN' 
  | 'PERSONAL_INFO' 
  | 'EDIT_PERSONAL_INFO' 
  | 'SAVED_ADDRESS' 
  | 'LANGUAGE' 
  | 'TERMS' 
  | 'PRIVACY' 
  | 'SUPPORT';

export interface SavedSiteAddress {
  id: number;
  nickname: string;
  fullAddress: string;
  landmark?: string;
  contactName?: string;
  contactPhone?: string;
  isDefault: boolean;
  tag?: string;
  latitude?: number;
  longitude?: number;
}

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BottomNavComponent,
    LogoutModalComponent
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class CustomerProfileComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  public themeService = inject(ThemeService);
  private customerService = inject(CustomerService);
  private authService = inject(AuthService);
  private supportService = inject(SupportService);
  private router = inject(Router);

  currentView: ProfileSubView = 'MAIN';

  customerProfile: CustomerProfile = {
    fullName: '',
    phone: '',
    email: '',
    city: '',
    language: 'English',
    dob: '',
    gender: 'Male',
    address: '',
    profilePhotoUrl: ''
  };

  editForm = {
    fullName: '',
    phone: '',
    email: '',
    dob: '',
    gender: 'Male',
    address: '',
    city: '',
    profilePhotoUrl: ''
  };

  // Saved Addresses State (Fully dynamic via API based on userId)
  savedSites: SavedSiteAddress[] = [];

  activeAddressMenuId: number | null = null;
  showRemoveConfirmModal: boolean = false;
  siteToRemove: SavedSiteAddress | null = null;

  showAddAddressForm: boolean = false;
  editingSiteId: number | null = null;
  siteForm = {
    nickname: '',
    fullAddress: '',
    landmark: '',
    contactName: '',
    contactPhone: '',
    isDefault: false
  };

  // Support State
  supportSubTab: 'TICKETS' | 'FAQ' = 'TICKETS';
  supportViewMode: 'LIST' | 'RAISE_TICKET' | 'CONFIRMATION' | 'CHAT_THREAD' = 'LIST';
  
  ticketsList: SupportTicket[] = [];
  selectedTicket: SupportTicket | null = null;
  chatMessages: SupportMessage[] = [];
  newMessageText: string = '';
  chatAttachmentName: string = '';

  newTicketForm = {
    category: 'Booking Issue',
    priority: 'MEDIUM',
    subject: '',
    description: '',
    attachmentName: ''
  };

  categoryOptions = [
    'Booking Issue',
    'Payment / Refund Issue',
    'App Technical Issue',
    'Operator / Service Quality',
    'Other Query'
  ];

  faqList = [
    { id: 1, question: 'How do I cancel a booking?', answer: 'Go to Bookings -> Select your ongoing job -> Tap Cancel Booking button at top right. Select a cancellation reason to confirm.', expanded: true },
    { id: 2, question: 'What is the advance payment policy?', answer: 'We require a 20%-30% advance payment depending on equipment type to lock your operator and vehicle dispatch.', expanded: false },
    { id: 3, question: 'How is cancellation refund calculated?', answer: 'If cancelled before operator dispatch, 100% of advance amount is refunded back to your source account within 24-48 hours.', expanded: false },
    { id: 4, question: 'How can I contact my machine operator?', answer: 'Inside the Bookings or Live Track view, tap the Call Operator or Message button to communicate directly with your operator.', expanded: false },
    { id: 5, question: 'How do I update site coordinates for live tracking?', answer: 'Go to Profile -> Saved Sites -> Edit site or add a new site address with GPS location.', expanded: false }
  ];
  faqSearchQuery: string = '';

  notificationsEnabled: boolean = true;
  showLogoutModal: boolean = false;
  selectedLanguage: string = 'English';

  languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिंदी' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' }
  ];

  @ViewChild('chatContainer') chatContainer?: ElementRef;

  ngOnInit(): void {
    this.loadProfile();
    this.loadSavedAddresses();
    this.loadTickets();
  }

  loadProfile(): void {
    if (!this.authService.isLoggedIn()) {
      this.customerProfile = {
        fullName: '',
        phone: '',
        email: '',
        city: '',
        language: 'English',
        dob: '',
        gender: 'Male',
        address: '',
        profilePhotoUrl: ''
      };
      this.syncEditForm();
      return;
    }

    const user = this.authService.getUser();
    if (user) {
      this.customerProfile = {
        fullName: user.fullName || user.name || '',
        phone: user.phone || user.phoneNumber || '',
        email: user.email || '',
        city: user.city || '',
        language: user.language || 'English',
        dob: user.dob || '',
        gender: user.gender || 'Male',
        address: user.address || '',
        profilePhotoUrl: user.profilePhotoUrl || ''
      };
      this.syncEditForm();
    }

    this.customerService.getProfile().subscribe({
      next: (res: any) => {
        const data = res?.data || res;
        if (data && (data.fullName || data.phone)) {
          this.customerProfile = { ...this.customerProfile, ...data };
          this.syncEditForm();
        }
      },
      error: (err) => {
        if (err.status === 401) {
          this.authService.clearSession();
          this.customerProfile = {
            fullName: '',
            phone: '',
            email: '',
            city: '',
            language: 'English',
            dob: '',
            gender: 'Male',
            address: '',
            profilePhotoUrl: ''
          };
          this.syncEditForm();
        }
      }
    });
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  goToLogin(): void {
    this.router.navigate(['/auth']);
  }

  getInitials(): string {
    const name = (this.customerProfile.fullName || '').trim();
    if (!name) {
      return this.customerProfile.phone ? this.customerProfile.phone.substring(0, 2) : 'CU';
    }
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  
  syncEditForm(): void {
    this.editForm = {
      fullName: this.customerProfile.fullName || '',
      phone: this.customerProfile.phone || '',
      email: this.customerProfile.email || '',
      dob: this.customerProfile.dob || '',
      gender: this.customerProfile.gender || 'Male',
      address: this.customerProfile.address || '',
      city: this.customerProfile.city || '',
      profilePhotoUrl: this.customerProfile.profilePhotoUrl || ''
    };
  }

  loadSavedAddresses(): void {
    this.customerService.getSavedAddresses().subscribe({
      next: (res: any) => {
        const list = res?.data || res;
        if (Array.isArray(list)) {
          this.savedSites = list.map((item: any, idx: number) => ({
            id: item.id || idx + 1,
            nickname: item.label || item.nickname || item.tag || 'Saved Site',
            fullAddress: item.addressLine1 || item.fullAddress || item.address || item.street || '',
            landmark: item.landmark || item.addressLine2 || '',
            contactName: item.contactName || item.contact_name || '',
            contactPhone: item.phone || item.contactPhone || '',
            isDefault: item.isDefault || idx === 0,
            tag: item.addressType || item.tag || 'Site'
          }));
        } else {
          this.savedSites = [];
        }
      },
      error: () => {
        this.savedSites = [];
      }
    });
  }

  loadTickets(): void {
    this.supportService.getTickets().subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.ticketsList = res.data;
        }
      }
    });
  }

  navigateTo(view: ProfileSubView): void {
    if (!this.isLoggedIn() && (view === 'PERSONAL_INFO' || view === 'SAVED_ADDRESS' || view === 'EDIT_PERSONAL_INFO')) {
      this.router.navigate(['/auth']);
      return;
    }
    this.currentView = view;
    if (view === 'EDIT_PERSONAL_INFO') {
      this.syncEditForm();
    } else if (view === 'SAVED_ADDRESS') {
      this.showAddAddressForm = false;
    } else if (view === 'SUPPORT') {
      this.supportViewMode = 'LIST';
      this.loadTickets();
    }
  }

  // Saved Address Methods
  toggleAddressMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeAddressMenuId = this.activeAddressMenuId === id ? null : id;
  }

  setSiteAsDefault(site: SavedSiteAddress): void {
    this.savedSites.forEach(s => s.isDefault = (s.id === site.id));
    this.activeAddressMenuId = null;
    this.customerService.saveAddress(site).subscribe();
  }

  promptRemoveSite(site: SavedSiteAddress): void {
    this.siteToRemove = site;
    this.showRemoveConfirmModal = true;
    this.activeAddressMenuId = null;
  }

  confirmRemoveSite(): void {
    if (this.siteToRemove) {
      this.savedSites = this.savedSites.filter(s => s.id !== this.siteToRemove!.id);
      this.siteToRemove = null;
    }
    this.showRemoveConfirmModal = false;
  }

  openAddSiteForm(site?: SavedSiteAddress): void {
    if (site) {
      this.editingSiteId = site.id;
      this.siteForm = {
        nickname: site.nickname,
        fullAddress: site.fullAddress,
        landmark: site.landmark || '',
        contactName: site.contactName || '',
        contactPhone: site.contactPhone || '',
        isDefault: site.isDefault
      };
    } else {
      this.editingSiteId = null;
      this.siteForm = {
        nickname: '',
        fullAddress: '',
        landmark: '',
        contactName: '',
        contactPhone: '',
        isDefault: this.savedSites.length === 0
      };
    }
    this.showAddAddressForm = true;
  }

  saveSiteAddress(): void {
    if (!this.siteForm.nickname.trim() || !this.siteForm.fullAddress.trim()) return;

    const payload = {
      label: this.siteForm.nickname,
      addressType: (this.siteForm.nickname || 'SITE').toUpperCase(),
      addressLine1: this.siteForm.fullAddress,
      landmark: this.siteForm.landmark,
      contactName: this.siteForm.contactName,
      phone: this.siteForm.contactPhone,
      isDefault: this.siteForm.isDefault
    };

    this.customerService.saveAddress(payload).subscribe({
      next: () => {
        this.loadSavedAddresses();
        this.showAddAddressForm = false;
      },
      error: () => {
        this.loadSavedAddresses();
        this.showAddAddressForm = false;
      }
    });
  }

  // Support Methods
  openRaiseTicketForm(): void {
    this.newTicketForm = {
      category: 'Booking Issue',
      priority: 'MEDIUM',
      subject: '',
      description: '',
      attachmentName: ''
    };
    this.supportViewMode = 'RAISE_TICKET';
  }

  onTicketFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.newTicketForm.attachmentName = file.name;
    }
  }

  submitTicket(): void {
    if (!this.newTicketForm.subject.trim() || !this.newTicketForm.description.trim()) return;

    this.supportService.createTicket(
      this.newTicketForm.category,
      this.newTicketForm.subject,
      this.newTicketForm.description,
      this.newTicketForm.priority,
      '',
      this.newTicketForm.attachmentName
    ).subscribe({
      next: (res: any) => {
        this.supportViewMode = 'CONFIRMATION';
        this.loadTickets();
      }
    });
  }

  openTicketThread(ticket: SupportTicket): void {
    this.selectedTicket = ticket;
    this.supportService.getTicketDetails(ticket.id).subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.chatMessages = res.data.messages || [];
        }
        this.supportViewMode = 'CHAT_THREAD';
        this.scrollToBottom();
      }
    });
  }

  sendChatMessage(): void {
    if (!this.newMessageText.trim() || !this.selectedTicket) return;
    const txt = this.newMessageText.trim();
    this.newMessageText = '';

    this.supportService.sendMessage(this.selectedTicket.id, txt, '', this.chatAttachmentName).subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.chatMessages.push(res.data);
          this.scrollToBottom();
        }
      }
    });
  }

  reopenSelectedTicket(): void {
    if (!this.selectedTicket) return;
    this.supportService.reopenTicket(this.selectedTicket.id).subscribe({
      next: () => {
        if (this.selectedTicket) this.selectedTicket.status = 'REOPENED';
      }
    });
  }

  toggleFaq(id: number): void {
    const item = this.faqList.find(f => f.id === id);
    if (item) item.expanded = !item.expanded;
  }

  get filteredFaqs() {
    if (!this.faqSearchQuery.trim()) return this.faqList;
    const q = this.faqSearchQuery.toLowerCase();
    return this.faqList.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatContainer?.nativeElement) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  onToggleNotifications(): void {
    this.notificationsEnabled = !this.notificationsEnabled;
  }

  onApplyLanguage(): void {
    this.customerProfile.language = this.selectedLanguage;
    this.customerService.updateProfile({ language: this.selectedLanguage }).subscribe();
    this.currentView = 'MAIN';
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  onToggleDarkMode(): void {
    this.themeService.toggleTheme();
  }

  onSaveProfile(): void {
    this.customerProfile = { ...this.customerProfile, ...this.editForm };
    this.customerService.updateProfile(this.customerProfile).subscribe();
    this.currentView = 'PERSONAL_INFO';
  }

  onLogout(): void {
    this.showLogoutModal = true;
  }

  cancelLogout(): void {
    this.showLogoutModal = false;
  }

  confirmLogout(): void {
    this.showLogoutModal = false;
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth']),
      error: () => {
        this.authService.clearSession();
        this.router.navigate(['/auth']);
      }
    });
  }
}
