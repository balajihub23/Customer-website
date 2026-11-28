import { Routes } from '@angular/router';
import { SplashComponent } from './components/splash/splash.component';
import { AuthComponent } from './components/auth/auth.component';
import { HomeComponent } from './components/home/home.component';
import { BookingFlowComponent } from './components/booking-flow/booking-flow.component';
import { BookingsComponent } from './components/bookings/bookings.component';
import { TrackComponent } from './components/track/track.component';
import { CustomerProfileComponent } from './components/profile/profile.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { LegalPageComponent } from './components/legal-page/legal-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'splash', pathMatch: 'full' },
  { path: 'splash', component: SplashComponent },
  { path: 'auth', component: AuthComponent },
  { path: 'home', component: HomeComponent },
  { path: 'booking', component: BookingFlowComponent },
  { path: 'bookings', component: BookingsComponent },
  { path: 'track', component: TrackComponent },
  { path: 'profile', component: CustomerProfileComponent },
  { path: 'notifications', component: NotificationsComponent },
  { path: 'terms', component: LegalPageComponent },
  { path: 'privacy', component: LegalPageComponent },
  { path: '**', redirectTo: 'splash' }
];
