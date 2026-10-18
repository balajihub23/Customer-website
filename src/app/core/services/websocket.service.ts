import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface BookingLifecycleEvent {
  eventId?: string;
  bookingId: number;
  eventType: 
    | 'SEARCHING_DRIVER' 
    | 'DRIVER_ASSIGNED' 
    | 'DRIVER_ON_THE_WAY' 
    | 'ARRIVED' 
    | 'STARTED' 
    | 'DRIVER_LOCATION_UPDATED' 
    | 'COMPLETED' 
    | 'CANCELLED' 
    | 'NO_DRIVER_AVAILABLE'
    | 'BOOKING_CREATED'
    | string;
  timestamp?: string;
  version?: string;
  payload?: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);

  private readonly baseUrl = environment.serverApi;
  private ws: WebSocket | null = null;
  private bookingEventSubject = new Subject<BookingLifecycleEvent>();
  private activeSubscriptions = new Map<string, string>();
  private subCounter = 0;
  private reconnectTimer: any = null;
  private watchedBookingId: number | null = null;

  bookingEvents$: Observable<BookingLifecycleEvent> = this.bookingEventSubject.asObservable();

  connect(userId?: number | string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsProtocol = this.baseUrl.startsWith('https') ? 'wss' : 'ws';
    const cleanBase = this.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Primary Spring STOMP endpoint: /ws-rentron/websocket, fallback: /ws-rentron
    const primaryWsUrl = `${wsProtocol}://${cleanBase}/ws-rentron/websocket`;
    const fallbackWsUrl = `${wsProtocol}://${cleanBase}/ws-rentron`;

    const tryConnect = (targetUrl: string, isFallback: boolean = false) => {
      try {
        this.ws = new WebSocket(targetUrl);

        this.ws.onopen = () => {
          console.log('[Rentron WS] Connected to:', targetUrl);

          const token = this.authService.getToken();
          const authHeader = token ? `Authorization:Bearer ${token}\n` : '';

          // Send STOMP CONNECT frame with JWT
          const connectFrame = `CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n${authHeader}\n\u0000`;
          this.ws?.send(connectFrame);

          // Re-subscribe to active topics
          if (this.watchedBookingId) {
            this.sendSubscribe(`/topic/booking/${this.watchedBookingId}`);
          }
          if (userId) {
            this.sendSubscribe(`/topic/user-events/${userId}`);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const raw = event.data as string;
            if (raw && raw.includes('{')) {
              const jsonStart = raw.indexOf('{');
              const jsonEnd = raw.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = raw.substring(jsonStart, jsonEnd + 1);
                const data = JSON.parse(jsonStr);

                if (data && (data.eventType || data.bookingId || data.type)) {
                  const mappedEvent: BookingLifecycleEvent = {
                    eventId: data.eventId,
                    bookingId: data.bookingId || (data.payload && data.payload.bookingId),
                    eventType: data.eventType || data.type || data.status,
                    timestamp: data.timestamp || new Date().toISOString(),
                    version: data.version || '1.0',
                    payload: data.payload || data
                  };
                  this.bookingEventSubject.next(mappedEvent);
                }
              }
            }
          } catch (err) {
            console.error('[Rentron WS] Message parse error:', err);
          }
        };

        this.ws.onerror = () => {
          if (!isFallback) {
            tryConnect(fallbackWsUrl, true);
          } else {
            console.warn('[Rentron WS] WebSocket connection failed. Using REST polling fallback.');
          }
        };

        this.ws.onclose = () => {
          this.ws = null;
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect(userId);
            }, 8000);
          }
        };
      } catch (e) {
        if (!isFallback) {
          tryConnect(fallbackWsUrl, true);
        }
      }
    };

    tryConnect(primaryWsUrl);
  }

  subscribeToBooking(bookingId: number): void {
    this.watchedBookingId = bookingId;
    const destination = `/topic/booking/${bookingId}`;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(destination);
    } else {
      this.connect();
    }
  }

  unsubscribeFromBooking(bookingId: number): void {
    if (this.watchedBookingId === bookingId) {
      this.watchedBookingId = null;
    }
    const destination = `/topic/booking/${bookingId}`;
    const subId = this.activeSubscriptions.get(destination);
    if (subId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unsubFrame = `UNSUBSCRIBE\nid:${subId}\n\n\u0000`;
      this.ws.send(unsubFrame);
      this.activeSubscriptions.delete(destination);
    }
  }

  private sendSubscribe(destination: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.activeSubscriptions.has(destination)) return;

    const subId = `sub-${this.subCounter++}`;
    this.activeSubscriptions.set(destination, subId);
    const subFrame = `SUBSCRIBE\nid:${subId}\ndestination:${destination}\n\n\u0000`;
    this.ws.send(subFrame);
    console.log('[Rentron WS] Subscribed to:', destination);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.activeSubscriptions.clear();
    this.watchedBookingId = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
