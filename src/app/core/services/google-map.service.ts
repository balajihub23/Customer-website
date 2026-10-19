import { Injectable, NgZone, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare var google: any;

export interface AutoCompletePlace {
  title: string;
  address: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleMapService {
  private zone = inject(NgZone);

  googleMaps: any = null;
  private _places = new BehaviorSubject<AutoCompletePlace[]>([]);
  private isScriptLoading = false;

  get places() {
    return this._places.asObservable();
  }

  loadGoogleMaps(apikey: string): Promise<any> {
    const win = (typeof window !== 'undefined' ? window : {}) as any;
    if (win.google && win.google.maps) {
      this.googleMaps = win.google.maps;
      return Promise.resolve(win.google.maps);
    }

    if (this.isScriptLoading) {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (win.google && win.google.maps) {
            clearInterval(interval);
            this.googleMaps = win.google.maps;
            resolve(win.google.maps);
          }
        }, 150);
      });
    }

    this.isScriptLoading = true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + apikey + '&libraries=places';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.isScriptLoading = false;
        if (win.google && win.google.maps) {
          this.googleMaps = win.google.maps;
          resolve(win.google.maps);
        } else {
          reject('Google Map SDK is not Available');
        }
      };
      script.onerror = (e) => {
        this.isScriptLoading = false;
        reject(e);
      };
      document.body.appendChild(script);
    });
  }

  async getPlaces(query: string, apikey?: string): Promise<AutoCompletePlace[]> {
    if (!query || !query.trim() || query.length < 1) {
      this._places.next([]);
      return [];
    }

    let results: AutoCompletePlace[] = [];

    // 1. Try Google Places Autocomplete if available
    try {
      if (!this.googleMaps && apikey) {
        try { this.googleMaps = await this.loadGoogleMaps(apikey); } catch (_) {}
      }

      if (this.googleMaps && this.googleMaps.places) {
        const service = new this.googleMaps.places.AutocompleteService();
        results = await new Promise<AutoCompletePlace[]>((resolve) => {
          service.getPlacePredictions(
            { input: query, componentRestrictions: { country: 'in' } },
            (predictions: any[], status: string) => {
              if (status === 'OK' && predictions && predictions.length > 0) {
                const items: AutoCompletePlace[] = predictions.map(p => ({
                  title: p.structured_formatting?.main_text || p.description.split(',')[0],
                  address: p.description,
                  placeId: p.place_id
                }));
                resolve(items);
              } else {
                resolve([]);
              }
            }
          );
        });
      }
    } catch (e) {
      console.warn('Google places search error:', e);
    }

    // 2. High-accuracy fallback: OpenStreetMap Nominatim search for Indian places
    if (results.length === 0) {
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=8&q=${encodeURIComponent(query)}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (resp.ok) {
          const list = await resp.json();
          if (Array.isArray(list) && list.length > 0) {
            results = list.map((item: any) => ({
              title: item.name || item.display_name.split(',')[0].trim(),
              address: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            }));
          }
        }
      } catch (err) {
        console.warn('Nominatim search fallback error:', err);
      }
    }

    this.zone.run(() => {
      this._places.next(results);
    });
    return results;
  }

  async geoCode(address: string, googleMaps?: any): Promise<{ lat: number; lng: number }> {
    try {
      const maps = googleMaps || this.googleMaps || (typeof google !== 'undefined' ? google.maps : null);
      if (maps && maps.Geocoder) {
        const result = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          const geocoder = new maps.Geocoder();
          geocoder.geocode({ address }, (results: any[], status: string) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve({
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              });
            } else {
              resolve(null);
            }
          });
        });
        if (result) return result;
      }
    } catch (_) {}

    // Fallback to Nominatim geocode
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=1&q=${encodeURIComponent(address)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (resp.ok) {
        const list = await resp.json();
        if (list && list.length > 0) {
          return {
            lat: parseFloat(list[0].lat),
            lng: parseFloat(list[0].lon)
          };
        }
      }
    } catch (_) {}

    return { lat: 12.9226, lng: 80.1275 };
  }

  async getPlaceDetails(lat: number, lng: number, apikey?: string): Promise<{ title: string; address: string; lat: number; lng: number }> {
    // 1. Try Google Maps Geocoder if loaded or if API key provided
    try {
      let maps = this.googleMaps || (typeof google !== 'undefined' ? google.maps : null);
      if (!maps && apikey) {
        try { maps = await this.loadGoogleMaps(apikey); } catch (_) {}
      }
      if (maps && maps.Geocoder) {
        const result = await new Promise<{ title: string; address: string } | null>((resolve) => {
          const geocoder = new maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
            if (status === 'OK' && results && results.length > 0) {
              const fullAddr = results[0].formatted_address;
              let title = fullAddr.split(',')[0].trim();
              for (const comp of results[0].address_components || []) {
                const types = comp.types || [];
                if (types.includes('sublocality_level_1') || types.includes('neighborhood') || types.includes('locality')) {
                  title = comp.long_name;
                  break;
                }
              }
              resolve({ title, address: fullAddr });
            } else {
              resolve(null);
            }
          });
        });

        if (result && result.address) {
          return { title: result.title, address: result.address, lat, lng };
        }
      }
    } catch (e) {
      console.warn('Google reverse geocode error:', e);
    }

    // 2. High-Accuracy Fallback: OpenStreetMap Nominatim Reverse Geocoding
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept': 'application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.display_name) {
          const a = data.address || {};
          const title = a.suburb || a.neighbourhood || a.road || a.commercial || a.building || a.city_district || a.city || a.town || a.village || data.display_name.split(',')[0].trim();
          return {
            title,
            address: data.display_name,
            lat,
            lng
          };
        }
      }
    } catch (err) {
      console.warn('Nominatim reverse geocode error:', err);
    }

    // 3. Coordinate fallback
    return {
      title: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      address: `Latitude: ${lat.toFixed(5)}, Longitude: ${lng.toFixed(5)}`,
      lat,
      lng
    };
  }

  getAddress(lat: number, lng: number, apikey?: string): Promise<string> {
    return this.getPlaceDetails(lat, lng, apikey).then(p => p.address);
  }
}
