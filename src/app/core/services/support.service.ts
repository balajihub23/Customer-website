import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface SupportTicket {
  id: number;
  ticketNumber: string;
  category: string;
  subject: string;
  description?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  createdAt: string;
  updatedAt?: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface SupportMessage {
  id: number | string;
  ticketId: number;
  senderRole: 'CUSTOMER' | 'ADMIN' | 'SUPPORT';
  senderName?: string;
  message: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupportService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private readonly baseUrl = environment.serverApi;

  // Mock initial tickets for fallback/offline presentation
  private mockTickets: SupportTicket[] = [
    {
      id: 101,
      ticketNumber: 'INC-1024',
      category: 'Booking Issue',
      subject: 'Delay in operator arrival at Noida site',
      description: 'The operator was scheduled for 8:00 AM but has not arrived yet.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      createdAt: 'Today, 08:30 AM'
    },
    {
      id: 102,
      ticketNumber: 'INC-982',
      category: 'Payment / Refund Issue',
      subject: 'Advance refund status for cancelled JCB booking',
      description: 'Cancelled booking #860201. Please confirm refund credit timeline.',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      createdAt: '14 May 2026'
    }
  ];

  private mockMessages: { [key: number]: SupportMessage[] } = {
    101: [
      {
        id: 1,
        ticketId: 101,
        senderRole: 'CUSTOMER',
        senderName: 'Customer',
        message: 'The operator was scheduled for 8:00 AM but has not arrived yet.',
        createdAt: '08:30 AM'
      },
      {
        id: 2,
        ticketId: 101,
        senderRole: 'SUPPORT',
        senderName: 'Rentron Support Team',
        message: 'Hello! We have contacted operator Arun Kumar. He is currently 10 mins away due to traffic on Sector 18 road.',
        createdAt: '08:35 AM'
      }
    ],
    102: [
      {
        id: 101,
        ticketId: 102,
        senderRole: 'CUSTOMER',
        message: 'Cancelled booking #860201. Please confirm refund credit timeline.',
        createdAt: '14 May, 10:00 AM'
      },
      {
        id: 102,
        ticketId: 102,
        senderRole: 'SUPPORT',
        senderName: 'Finance Help Desk',
        message: 'Your refund of ₹1,110 (20% Advance) has been processed back to your original UPI account.',
        createdAt: '14 May, 11:15 AM'
      }
    ]
  };

  getTickets(): Observable<any> {
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ success: true, data: this.mockTickets });
    }
    return this.http.get<any>(`${this.baseUrl}/api/v1/support/tickets`).pipe(
      catchError(() => of({ success: true, data: this.mockTickets }))
    );
  }

  getTicketDetails(id: number): Observable<any> {
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      const ticket = this.mockTickets.find(t => t.id === id) || this.mockTickets[0];
      const msgs = this.mockMessages[id] || [];
      return of({ success: true, data: { ticket, messages: msgs } });
    }
    return this.http.get<any>(`${this.baseUrl}/api/v1/support/tickets/${id}`).pipe(
      catchError(() => {
        const ticket = this.mockTickets.find(t => t.id === id) || this.mockTickets[0];
        const msgs = this.mockMessages[id] || [];
        return of({ success: true, data: { ticket, messages: msgs } });
      })
    );
  }

  createTicket(
    category: string,
    subject: string,
    description: string,
    priority: string = 'MEDIUM',
    attachmentUrl?: string,
    attachmentName?: string
  ): Observable<any> {
    const newId = Date.now();
    const newTicket: SupportTicket = {
      id: newId,
      ticketNumber: 'INC-' + Math.floor(1000 + Math.random() * 9000),
      category,
      subject,
      description,
      priority: priority as any,
      status: 'OPEN',
      createdAt: 'Just now',
      attachmentUrl,
      attachmentName
    };
    this.mockTickets.unshift(newTicket);
    this.mockMessages[newId] = [
      {
        id: 'msg-' + newId,
        ticketId: newId,
        senderRole: 'CUSTOMER',
        message: description,
        attachmentUrl,
        attachmentName,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];

    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ success: true, data: newTicket });
    }

    return this.http.post<any>(`${this.baseUrl}/api/v1/support/tickets`, {
      category,
      subject,
      description,
      priority,
      attachmentUrl,
      attachmentName
    }).pipe(
      catchError(() => of({ success: true, data: newTicket }))
    );
  }

  sendMessage(ticketId: number, message: string, attachmentUrl?: string, attachmentName?: string): Observable<any> {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: SupportMessage = {
      id: Date.now(),
      ticketId,
      senderRole: 'CUSTOMER',
      message,
      attachmentUrl,
      attachmentName,
      createdAt: timeNow
    };

    if (!this.mockMessages[ticketId]) {
      this.mockMessages[ticketId] = [];
    }
    this.mockMessages[ticketId].push(newMsg);

    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ success: true, data: newMsg });
    }

    return this.http.post<any>(`${this.baseUrl}/api/v1/support/tickets/${ticketId}/messages`, {
      message,
      attachmentUrl,
      attachmentName
    }).pipe(
      catchError(() => of({ success: true, data: newMsg }))
    );
  }

  reopenTicket(ticketId: number): Observable<any> {
    const found = this.mockTickets.find(t => t.id === ticketId);
    if (found) {
      found.status = 'REOPENED';
    }
    if (!isPlatformBrowser(this.platformId) || !this.authService.getAccessToken()) {
      return of({ success: true, data: found });
    }
    return this.http.post<any>(`${this.baseUrl}/api/v1/support/tickets/${ticketId}/reopen`, null).pipe(
      catchError(() => of({ success: true, data: found }))
    );
  }
}
