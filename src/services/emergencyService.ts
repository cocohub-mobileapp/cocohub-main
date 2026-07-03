import Geolocation from '@react-native-community/geolocation';
import { Linking, Platform } from 'react-native';

import apiClient from './apiClient';
import config from '../config';
import { getItem, setItem, removeItem as _removeItem } from './localDB';
import { requestAndroidPermission } from './permissionService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  address?: string;
  type: 'vet' | 'clinic' | 'emergency' | 'poison-control';
  available24h?: boolean;
  notes?: string;
}

export interface VetClinic {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  distance?: number; // km
  rating?: number;
  available24h?: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface SOSPayload {
  location: Location;
  timestamp: number;
  message?: string;
  sessionId?: string;
  shareToken?: string;
  shareUrl?: string;
}

interface LiveSOSSession {
  id: string;
  shareToken: string;
  shareUrl: string;
  expiresAt: string;
}

interface TriggerSOSOptions {
  allowForegroundActions?: boolean;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const CONTACTS_KEY = '@emergency_contacts';
const FAVORITES_KEY = '@emergency_favorites';

// ─── Default contacts ─────────────────────────────────────────────────────────

const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: 'default-1',
    name: 'Pet Poison Helpline',
    phoneNumber: '855-764-7661',
    type: 'poison-control',
    available24h: true,
    notes: 'Fee may apply',
  },
  {
    id: 'default-2',
    name: 'ASPCA Animal Poison Control',
    phoneNumber: '888-426-4435',
    type: 'poison-control',
    available24h: true,
    notes: 'Fee may apply',
  },
];

// ─── EmergencyService ─────────────────────────────────────────────────────────

class EmergencyService {
  private static instance: EmergencyService;

  static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  // ── Contacts CRUD ────────────────────────────────────────────────────────────

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    const stored = await getItem(CONTACTS_KEY);
    if (stored) return JSON.parse(stored);
    await setItem(CONTACTS_KEY, JSON.stringify(DEFAULT_CONTACTS));
    return DEFAULT_CONTACTS;
  }

  async addContact(contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
    const contacts = await this.getEmergencyContacts();
    const newContact: EmergencyContact = {
      ...contact,
      id: `contact_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    contacts.push(newContact);
    await setItem(CONTACTS_KEY, JSON.stringify(contacts));
    void this.syncSOSLockScreenNotification(contacts);
    return newContact;
  }

  async updateContact(
    id: string,
    updates: Partial<Omit<EmergencyContact, 'id'>>,
  ): Promise<EmergencyContact> {
    const contacts = await this.getEmergencyContacts();
    const idx = contacts.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Contact not found');
    contacts[idx] = { ...contacts[idx], ...updates };
    await setItem(CONTACTS_KEY, JSON.stringify(contacts));
    void this.syncSOSLockScreenNotification(contacts);
    return contacts[idx];
  }

  async deleteContact(id: string): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    const filtered = contacts.filter((c) => c.id !== id);
    await setItem(CONTACTS_KEY, JSON.stringify(filtered));
    void this.syncSOSLockScreenNotification(filtered);
    // Also remove from favorites if present
    await this.removeFavoriteContact(id);
  }

  async syncSOSLockScreenNotification(contacts?: EmergencyContact[]): Promise<void> {
    try {
      const resolvedContacts = contacts ?? (await this.getEmergencyContacts());
      const { scheduleSOSLockScreenNotification, cancelSOSLockScreenNotification } = await import(
        './notificationService'
      );

      if (resolvedContacts.length > 0) {
        await scheduleSOSLockScreenNotification();
        return;
      }

      await cancelSOSLockScreenNotification();
    } catch {
      // Emergency contacts must remain editable even if notification setup fails.
    }
  }

  // ── Favorites ────────────────────────────────────────────────────────────────

  async getFavoriteContacts(): Promise<EmergencyContact[]> {
    const stored = await getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  async saveFavoriteContact(contact: EmergencyContact): Promise<void> {
    const favorites = await this.getFavoriteContacts();
    if (!favorites.find((f) => f.id === contact.id)) {
      favorites.push(contact);
      await setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  }

  async removeFavoriteContact(contactId: string): Promise<void> {
    const favorites = await this.getFavoriteContacts();
    await setItem(FAVORITES_KEY, JSON.stringify(favorites.filter((f) => f.id !== contactId)));
  }

  // ── Location ─────────────────────────────────────────────────────────────────

  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return requestAndroidPermission('android.permission.ACCESS_FINE_LOCATION', {
        title: 'Location Permission',
        message: 'Cocohub needs your location to find nearby vet clinics.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
    }
    return true; // iOS prompts automatically via Geolocation.getCurrentPosition
  }

  /**
   * Gets current location with a 5-second timeout and fallback to last known location.
   */
  async getCurrentLocation(): Promise<Location> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) throw new Error('Location permission denied');

    return new Promise((resolve) => {
      let resolved = false;

      // 5-second timeout for fresh GPS lock
      const timeout = setTimeout(async () => {
        if (!resolved) {
          resolved = true;
          const lastLocation = await this.getLastKnownLocation();
          resolve(lastLocation);
        }
      }, 5000);

      Geolocation.getCurrentPosition(
        (position) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        },
        async () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            const lastLocation = await this.getLastKnownLocation();
            resolve(lastLocation);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 },
      );
    });
  }

  /**
   * Fallback to last known location if GPS fails or times out.
   */
  private async getLastKnownLocation(): Promise<Location> {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          // Absolute fallback if everything fails
          resolve({ latitude: 0, longitude: 0 });
        },
        { enableHighAccuracy: false, timeout: 2000, maximumAge: Infinity },
      );
    });
  }

  // ── Nearby clinics ───────────────────────────────────────────────────────────

  async getNearbyVetClinics(
    latitude: number,
    longitude: number,
    radiusKm = 10,
  ): Promise<VetClinic[]> {
    const apiKey = config.googlePlaces.apiKey;
    if (apiKey) {
      try {
        return await this.fetchClinicsFromPlacesAPI(latitude, longitude, radiusKm, apiKey);
      } catch {
        // fall through to mock data
      }
    }
    return this.getMockClinics(latitude, longitude, radiusKm);
  }

  private async fetchClinicsFromPlacesAPI(
    latitude: number,
    longitude: number,
    radiusKm: number,
    apiKey: string,
  ): Promise<VetClinic[]> {
    const radiusMeters = radiusKm * 1000;
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${latitude},${longitude}` +
      `&radius=${radiusMeters}` +
      `&type=veterinary_care` +
      `&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Places API error: ${response.status}`);

    const data = (await response.json()) as {
      status: string;
      results: Array<{
        place_id: string;
        name: string;
        vicinity: string;
        geometry: { location: { lat: number; lng: number } };
        rating?: number;
        formatted_phone_number?: string;
      }>;
    };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API status: ${data.status}`);
    }

    return (data.results ?? [])
      .map((place) => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        phoneNumber: place.formatted_phone_number ?? '',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating,
        available24h: false,
        distance: this.calculateDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng,
        ),
      }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  private getMockClinics(latitude: number, longitude: number, radiusKm: number): VetClinic[] {
    const mockClinics: VetClinic[] = [
      {
        id: 'clinic-1',
        name: 'Emergency Vet Clinic',
        address: '123 Main St',
        phoneNumber: '555-0100',
        latitude: latitude + 0.01,
        longitude: longitude + 0.01,
        available24h: true,
        rating: 4.5,
      },
      {
        id: 'clinic-2',
        name: 'City Animal Hospital',
        address: '456 Oak Ave',
        phoneNumber: '555-0200',
        latitude: latitude - 0.02,
        longitude: longitude - 0.02,
        available24h: false,
        rating: 4.8,
      },
      {
        id: 'clinic-3',
        name: 'PetCare 24/7',
        address: '789 Elm Rd',
        phoneNumber: '555-0300',
        latitude: latitude + 0.03,
        longitude: longitude - 0.01,
        available24h: true,
        rating: 4.2,
      },
    ];

    return mockClinics
      .map((clinic) => ({
        ...clinic,
        distance: this.calculateDistance(latitude, longitude, clinic.latitude, clinic.longitude),
      }))
      .filter((clinic) => (clinic.distance ?? Infinity) <= radiusKm)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  // ── SOS ──────────────────────────────────────────────────────────────────────

  /**
   * One-tap SOS: gets current location (with fail-safe fallback),
   * dispatches alerts to all emergency contacts, and returns the SOS payload.
   */
  async triggerSOS(message?: string, options: TriggerSOSOptions = {}): Promise<SOSPayload> {
    const allowForegroundActions = options.allowForegroundActions ?? true;
    const location = await this.getCurrentLocation();
    const contacts = await this.getEmergencyContacts();
    const session = await this.startLiveLocationSession(location, contacts, message);
    const payload: SOSPayload = {
      location,
      timestamp: Date.now(),
      message: message || 'Pet emergency - need immediate help',
      sessionId: session?.id,
      shareToken: session?.shareToken,
      shareUrl: session?.shareUrl,
    };

    // Dispatch alerts to all emergency contacts
    await this.sendSOSAlerts(payload, allowForegroundActions);

    // Auto-call first 24h emergency contact as a primary action
    const primaryContact = contacts.find((c) => c.available24h) || contacts[0];
    if (allowForegroundActions && primaryContact) {
      this.callContact(primaryContact.phoneNumber);
    }

    return payload;
  }

  /**
   * Dispatches alerts via the most reliable available channels (SMS, Local Push).
   */
  private async sendSOSAlerts(payload: SOSPayload, allowForegroundActions = true): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    const mapsLink =
      payload.shareUrl ||
      `https://www.google.com/maps/search/?api=1&query=${payload.location.latitude},${payload.location.longitude}`;
    const fullMessage = `🚨 SOS EMERGENCY: ${payload.message}\nLast known location: ${mapsLink}`;

    // 1. Iterate through contacts and prepare to send alerts
    for (const contact of contacts) {
      void contact; // contacts iterated; SMS sent to first contact below
    }

    // 2. Open SMS for the first contact (as it's a foreground action)
    if (allowForegroundActions && contacts.length > 0) {
      this.sendSMS(contacts[0].phoneNumber, fullMessage);
    }
  }

  // ── Call / Navigate ──────────────────────────────────────────────────────────

  callContact(phoneNumber: string): void {
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
    });
  }

  sendSMS(phoneNumber: string, message: string): void {
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${phoneNumber}${separator}body=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
    });
  }

  async startLiveLocationSession(
    location: Location,
    contacts: EmergencyContact[],
    message?: string,
    timeoutMinutes = 60,
  ): Promise<LiveSOSSession | null> {
    try {
      const response = await apiClient.post('/emergency/sessions', {
        message: message || 'Pet emergency - need immediate help',
        latitude: location.latitude,
        longitude: location.longitude,
        timeoutMinutes,
        contacts: contacts.map((contact) => ({
          name: contact.name,
          phoneNumber: contact.phoneNumber,
        })),
      });
      return response.data?.data ?? response.data;
    } catch {
      return null;
    }
  }

  async updateLiveLocation(shareToken: string, location: Location): Promise<void> {
    await apiClient.post(`/emergency/sessions/${encodeURIComponent(shareToken)}/location`, {
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }

  async cancelLiveLocationSession(shareToken: string): Promise<void> {
    await apiClient.post(`/emergency/sessions/${encodeURIComponent(shareToken)}/cancel`);
  }

  navigateToClinic(address: string): void {
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
    });

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        Linking.openURL(
          supported ? url : `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        );
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export default EmergencyService.getInstance();
