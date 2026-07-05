import { randomUUID } from 'crypto';

import type { ApiKey, ApiKeyUsageRecord } from '../models/ApiKey';
import { AppointmentStatus, AppointmentType } from '../models/Appointment';
import { UserRole } from '../models/UserRole';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  pets: Array<{ id: string; name?: string }>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  passwordHash?: string;
  // 2FA fields
  twoFactorEnabled: boolean;
  twoFactorSecret?: string; // encrypted TOTP secret (never exposed in API)
  twoFactorBackupCodes?: string[]; // bcrypt-hashed backup codes
  twoFactorPendingSecret?: string; // secret during setup (before confirmation)
  recoveryToken?: string; // bcrypt-hashed recovery token
  recoveryTokenExpiresAt?: number; // epoch ms
  timezone?: string;
}

export interface StoredPet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface StoredMedicalRecord {
  id: string;
  petId: string;
  vetId: string;
  type: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;

  // Blockchain verification fields
  blockchainTxHash?: string; // Stellar transaction hash
  blockchainHash?: string; // Hash stored on-chain
  isBlockchainVerified?: boolean; // Verified flag (backend-computed)
  blockchainVerifiedAt?: string; // When verification was last performed

  // Federated vet signature fields
  vetSignature?: string; // Ed25519 signature over record hash
  vetFederatedAddress?: string; // e.g. dr.smith*cocohub.app
  vetPublicKey?: string; // Stellar public key of signing vet
  vetSignedAt?: string; // When the vet signed this record
}

export interface StoredAppointment {
  id: string;
  petId: string;
  vetId: string;
  date: string;
  time: string;
  durationMinutes?: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  isTelemedicine?: boolean;
  videoCallUrl?: string;
  videoProvider?: 'jitsi' | 'zoom';
  consultationId?: string;
  timeZone?: string;
  questionnaireDueAt?: string;
  questionnaireSentAt?: string;
  questionnaireRespondedAt?: string;
  questionnaireResponses?: Record<string, string>;
  noShowReportedAt?: string;
  rescheduledFrom?: string;
}

export interface StoredBackup {
  userId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface StoredPetQrIdentity {
  petId: string;
  token: string;
  issuedAt: string;
  revokedAt?: string;
}

export interface StoredEmergencySession {
  id: string;
  userId?: string;
  message: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  shareToken: string;
  createdAt: string;
  expiresAt: string;
  cancelledAt?: string;
  contacts: Array<{ name: string; phoneNumber: string; pushToken?: string }>;
  updates: Array<{ latitude: number; longitude: number; accuracy?: number; recordedAt: string }>;
}

export interface StoredHealthPredictionAlert {
  id: string;
  petId: string;
  ownerId: string;
  predictedIssue: string;
  riskScore: number;
  riskLevel: 'medium' | 'high';
  contributingFactors: string[];
  modelVersion: string;
  status: 'active' | 'dismissed';
  createdAt: string;
  dismissedAt?: string;
  feedback?: 'helpful' | 'not_helpful' | 'already_known' | 'false_alarm';
  feedbackNotes?: string;
}

/** Matches `backend/services/medicationService` client expectations. */
export interface StoredMedication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  active: boolean;
}

export interface StoredReferralCode {
  userId: string;
  code: string;
  createdAt: string;
}

export interface StoredReferral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  status: 'pending' | 'converted' | 'blocked';
  signupAt: string;
  convertedAt?: string;
  firstRecordId?: string;
  blockedAt?: string;
  blockReason?: string;
  deviceFingerprint?: string;
  ipHash?: string;
  userAgentHash?: string;
}

export interface StoredReferralCredit {
  id: string;
  userId: string;
  referralId: string;
  creditType: 'premium_days';
  amount: number;
  status: 'active' | 'redeemed';
  awardedAt: string;
}

export interface StoredPayment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface StoredFamilySharing {
  id: string;
  ownerId: string;
  sharedWithUserId: string;
  createdAt: string;
}

const now = () => new Date().toISOString();

function seed() {
  const userId = 'u-demo-1';
  const petId = 'p-demo-1';
  const vetId = 'v-demo-1';
  const t = now();

  const users = new Map<string, StoredUser>();
  users.set(userId, {
    id: userId,
    email: 'demo@cocohub.app',
    name: 'Demo User',
    phone: '+10000000000',
    role: UserRole.OWNER,
    pets: [{ id: petId, name: 'Buddy' }],
    createdAt: t,
    updatedAt: t,
    deletedAt: undefined,
    isEmailVerified: true,
    lastLoginAt: t,
    twoFactorEnabled: false,
  });

  const pets = new Map<string, StoredPet>();
  pets.set(petId, {
    id: petId,
    name: 'Buddy',
    species: 'dog',
    breed: 'Mixed',
    dateOfBirth: '2020-01-15',
    microchipId: 'CHIP-DEMO-1',
    ownerId: userId,
    createdAt: t,
    updatedAt: t,
    metadata: { stepGoal: 6000 },
  });

  const medicalRecords = new Map<string, StoredMedicalRecord>();
  const mrId = 'mr-demo-1';
  medicalRecords.set(mrId, {
    id: mrId,
    petId,
    vetId,
    type: 'vaccination',
    diagnosis: 'Annual wellness',
    treatment: 'Rabies vaccine',
    notes: 'No adverse reaction',
    visitDate: t.slice(0, 10),
    nextVisitDate: '2027-01-01',
    createdAt: t,
    updatedAt: t,
    // Blockchain fields not set for demo record initially
    blockchainTxHash: undefined,
    blockchainHash: undefined,
    isBlockchainVerified: false,
    blockchainVerifiedAt: undefined,
  });

  const appointments = new Map<string, StoredAppointment>();
  const apId = 'ap-demo-1';
  appointments.set(apId, {
    id: apId,
    petId,
    vetId,
    date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    time: '10:00',
    durationMinutes: 30,
    type: AppointmentType.ROUTINE_CHECKUP,
    status: AppointmentStatus.CONFIRMED,
    notes: 'Demo appointment',
    createdAt: t,
    updatedAt: t,
  });

  const medications = new Map<string, StoredMedication>();
  const medId = 'med-demo-1';
  medications.set(medId, {
    id: medId,
    petId,
    name: 'Demo Med',
    dosage: '5mg',
    frequency: 'once_daily',
    startDate: t.slice(0, 10),
    active: true,
  });

  return { users, pets, medicalRecords, appointments, medications };
}

const state = seed();

const backups = new Map<string, StoredBackup>();
const petQrIdentities = new Map<string, StoredPetQrIdentity>();
const emergencySessions = new Map<string, StoredEmergencySession>();
const healthPredictionAlerts = new Map<string, StoredHealthPredictionAlert>();

// ─── Travel Certificates ──────────────────────────────────────────────────────

export interface StoredTravelCertificate {
  id: string;
  petId: string;
  petName: string;
  destinationCountryCode: string;
  destinationCountryName: string;
  travelDate: string;
  generatedAt: string;
  status: 'draft' | 'ready' | 'incomplete' | 'anchored' | 'anchor_failed';
  requirementChecks: Array<{
    requirementType: 'vaccination' | 'health_check' | 'document';
    requirementName: string;
    met: boolean;
    details?: string;
    satisfiedAt?: string;
    actionRequired?: string;
  }>;
  complianceScore: number;
  pdfUrl?: string;
  blockchainTxHash?: string;
  blockchainHash?: string;
  isBlockchainAnchored: boolean;
  blockchainAnchoredAt?: string;
  createdAt: string;
  updatedAt: string;
}

const travelCertificates = new Map<string, StoredTravelCertificate>();

const apiKeys = new Map<string, ApiKey>();
const apiKeyUsage: ApiKeyUsageRecord[] = [];
const referralCodes = new Map<string, StoredReferralCode>();
const referrals = new Map<string, StoredReferral>();
const referralCredits = new Map<string, StoredReferralCredit>();
const payments = new Map<string, StoredPayment>();
const familySharing = new Map<string, StoredFamilySharing>();

export function newId(): string {
  return randomUUID();
}

export const store = {
  ...state,
  backups,
  petQrIdentities,
  emergencySessions,
  healthPredictionAlerts,
  travelCertificates,
  apiKeys,
  apiKeyUsage,
  referralCodes,
  referrals,
  referralCredits,
  payments,
  familySharing,
  newId,
};
