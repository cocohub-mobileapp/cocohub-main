import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Pet } from '../models/Pet';

// ─── Root Stack ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Forum: undefined;
  LostFound: undefined;
  // Modals
  QRScanner: { onScanSuccess?: (data: string, petId?: string) => void };
  ManualEntry: undefined;
  // Future: Payment / Subscription
  Payment: { planId?: string };
  FiatOnRamp: undefined;
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export type MainTabParamList = {
  PetList: NavigatorScreenParams<PetStackParamList> | undefined; // 🐾 Pets
  Care: undefined; // 💊 Care (Meds + Vaccines + Alerts)
  Schedule: undefined; // 📅 Schedule (Appointments)
  Search: undefined; // 🔍 Search
  More: undefined; // ☰  More (Profile, Community, etc.)
};

// ─── Pet Stack (nested inside PetList tab) ────────────────────────────────────
export type PetStackParamList = {
  PetListScreen: undefined;
  Adoption: undefined;
  PetDetail: { petId: string };
  AuditHistory: {
    entityType: 'pet' | 'medication' | 'appointment';
    entityId: string;
    title?: string;
  };
  PetProfile: { petId: string };
  PetHealthDashboard: { petId: string; petName?: string };
  PetHealthMetrics: { petId: string; petName?: string };
  PetForm: { pet?: Pet; ownerId?: string };
  MedicalRecordSearch: { petId: string };
  MedicalRecordViewer: { petId: string; petName?: string };
  PetShare: { petId: string; petName: string };
  TravelCertificate: { petId: string; petName?: string };
  DosageCalculator: { petId?: string; species?: string; weightKg?: number };
  ReconciliationReport: { reportId?: string };
  TrustlineManager: undefined;
  NearbyVet: undefined;
  VetMap: undefined;
  VetDirectory: undefined;
  PrivacyDashboard: undefined;
  Insurance: undefined;
  Search: undefined;
  NotificationPreferences: undefined;
  DeleteAccount: undefined;
  ClinicalNotes: { petId: string; vetId?: string };
};

// ─── Screen prop helpers ──────────────────────────────────────────────────────
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type PetStackScreenProps<T extends keyof PetStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<PetStackParamList, T>,
  MainTabScreenProps<'PetList'>
>;

// ─── Deep link config ─────────────────────────────────────────────────────────
export const DEEP_LINK_PREFIX = ['cocohub://', 'https://cocohub.app'];
