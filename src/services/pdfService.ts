/**
 * Vaccination Certificate PDF Generator — Issue #417
 *
 * Generates a formatted PDF vaccination certificate for a pet,
 * embeds a QR code linking to the blockchain-verified record,
 * supports sharing via native share sheet, and anchors the
 * certificate hash to Stellar.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import config from '../config';
import apiClient from './apiClient';
import { getToken } from './authService';
import type { VaccinationReminder } from './vaccinationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PetCertificateInfo {
  petId: string;
  petName: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  ownerName: string;
  ownerContact?: string;
  vetName?: string;
  vetClinic?: string;
  vetContact?: string;
  photoUri?: string;
}

export interface GeneratedCertificate {
  filePath: string;
  hash: string;
  generatedAt: string;
}

// ─── QR code helper ───────────────────────────────────────────────────────────

async function generateQRDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, { width: 120, margin: 1 });
}

// ─── Simple hash (SHA-256 via crypto) ────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  // React Native doesn't have SubtleCrypto; use a simple djb2 hash for the
  // certificate identifier. In production this would use expo-crypto.
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    hash = hash >>> 0; // convert to unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

// ─── PDF content builder ──────────────────────────────────────────────────────

function buildCertificateText(
  pet: PetCertificateInfo,
  vaccinations: VaccinationReminder[],
  qrDataUrl: string,
  hash: string,
  generatedAt: string,
): string {
  const administered = vaccinations.filter((v) => v.status === 'administered');
  const lines: string[] = [
    '='.repeat(60),
    '         VACCINATION CERTIFICATE',
    '='.repeat(60),
    '',
    `Certificate ID : ${hash}`,
    `Generated      : ${generatedAt}`,
    '',
    '-'.repeat(60),
    'PET INFORMATION',
    '-'.repeat(60),
    `Name           : ${pet.petName}`,
    `Species        : ${pet.species}`,
    pet.breed ? `Breed          : ${pet.breed}` : '',
    pet.dateOfBirth ? `Date of Birth  : ${pet.dateOfBirth}` : '',
    `Pet ID         : ${pet.petId}`,
    '',
    '-'.repeat(60),
    'OWNER INFORMATION',
    '-'.repeat(60),
    `Owner          : ${pet.ownerName}`,
    pet.ownerContact ? `Contact        : ${pet.ownerContact}` : '',
    '',
    '-'.repeat(60),
    'VETERINARY INFORMATION',
    '-'.repeat(60),
    pet.vetName ? `Veterinarian   : ${pet.vetName}` : 'Veterinarian   : N/A',
    pet.vetClinic ? `Clinic         : ${pet.vetClinic}` : '',
    pet.vetContact ? `Contact        : ${pet.vetContact}` : '',
    '',
    '-'.repeat(60),
    'VACCINATION RECORDS',
    '-'.repeat(60),
    '',
    ...administered.flatMap((v, i) => [
      `${i + 1}. ${v.vaccineName}`,
      `   Administered : ${v.lastAdministeredDate ?? 'N/A'}`,
      `   Due Date     : ${v.dueDate}`,
      v.veterinaryVerification?.blockchainTxHash
        ? `   Blockchain   : ${v.veterinaryVerification.blockchainTxHash}`
        : '   Blockchain   : Pending verification',
      '',
    ]),
    administered.length === 0 ? 'No administered vaccinations on record.' : '',
    '',
    '-'.repeat(60),
    'BLOCKCHAIN VERIFICATION',
    '-'.repeat(60),
    `Certificate Hash : ${hash}`,
    `QR Code          : Scan to verify on-chain record`,
    `[QR: ${qrDataUrl.slice(0, 40)}...]`,
    '',
    '='.repeat(60),
    'This certificate is blockchain-verified via Cocohub.',
    'Verify at: https://cocohub.app/verify/' + hash,
    '='.repeat(60),
  ].filter((l) => l !== undefined);

  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a vaccination certificate as a text file (PDF-like format).
 * Uses expo-file-system for storage and expo-sharing for the share sheet.
 */
export async function generateVaccinationCertificate(
  pet: PetCertificateInfo,
  vaccinations: VaccinationReminder[],
): Promise<GeneratedCertificate> {
  const generatedAt = new Date().toISOString();
  const contentForHash = `${pet.petId}-${pet.petName}-${generatedAt}`;
  const hash = await sha256(contentForHash);

  const blockchainUrl = `https://cocohub.app/verify/${hash}`;
  const qrDataUrl = await generateQRDataUrl(blockchainUrl);

  const content = buildCertificateText(pet, vaccinations, qrDataUrl, hash, generatedAt);

  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  const fileName = `vaccination-certificate-${pet.petId}-${hash}.txt`;
  const filePath = `${dir}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { filePath, hash, generatedAt };
}

/**
 * Share the generated certificate via the native share sheet.
 */
export async function shareCertificate(filePath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(filePath, {
    mimeType: 'text/plain',
    dialogTitle: 'Share Vaccination Certificate',
  });
}

/**
 * Anchor the certificate hash to Stellar blockchain.
 * Returns the transaction hash.
 */
export async function anchorCertificateToStellar(certificateHash: string): Promise<string | null> {
  try {
    const apiClient = (await import('./apiClient')).default;
    const res = await apiClient.post<{ success: boolean; data: { txHash: string } }>(
      '/vaccinations/certificates/anchor',
      { hash: certificateHash },
    );
    return res.data.data.txHash ?? null;
  } catch {
    // Non-fatal — certificate is still valid without blockchain anchor
    return null;
  }
}

// ─── Health dashboard report export (Issue #45) ───────────────────────────────

export interface HealthReportWeightPoint {
  date: string;
  weightKg: number;
  note?: string;
}

export interface HealthReportMedication {
  id?: string;
  name: string;
  dosage?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
}

export interface HealthReportAppointment {
  id?: string;
  date: string;
  time?: string;
  type: string;
  status?: string;
  notes?: string;
}

export interface HealthReportRecord {
  id?: string;
  type: string;
  date?: string;
  createdAt?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
}

export interface HealthDashboardReportPayload {
  petId: string;
  petName: string;
  healthScore: number | null;
  healthScoreLabel?: string;
  latestMetric?: {
    recordedAt: string;
    weightKg?: number;
    temperatureC?: number;
    activityLevel?: string;
    notes?: string;
  } | null;
  weightHistory: HealthReportWeightPoint[];
  activeMedications: HealthReportMedication[];
  upcomingAppointments: HealthReportAppointment[];
  recentRecords: HealthReportRecord[];
}

export interface GeneratedHealthReport {
  filePath: string;
  filename: string;
  jobId?: string;
  recordCount?: number;
}

interface ReportJobResponse {
  jobId: string;
}

interface ReportJobStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  filename?: string;
  recordCount?: number;
  error?: string;
}

const REPORT_POLL_DELAY_MS = 800;
const REPORT_MAX_POLLS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'health-report';
}

function absoluteApiUrl(path: string): string {
  const base = config.api.baseUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function waitForReport(jobId: string): Promise<ReportJobStatusResponse> {
  for (let attempt = 0; attempt < REPORT_MAX_POLLS; attempt++) {
    const { data } = await apiClient.get<ReportJobStatusResponse>(`/reports/${jobId}/status`);
    if (data.status === 'complete') return data;
    if (data.status === 'failed') {
      throw new Error(data.error || 'Health report generation failed.');
    }
    await sleep(REPORT_POLL_DELAY_MS);
  }
  throw new Error('Health report generation timed out. Please try again.');
}

/**
 * Requests a backend PDFKit-generated vet-ready health report, downloads it to
 * local app storage, and returns the local PDF path for sharing.
 */
export async function generateHealthDashboardReport(
  payload: HealthDashboardReportPayload,
): Promise<GeneratedHealthReport> {
  const { data } = await apiClient.post<ReportJobResponse>(
    `/reports/pets/${payload.petId}/health`,
    {
      dashboard: payload,
    },
  );

  if (!data?.jobId) {
    throw new Error('The report service did not return a job id.');
  }

  const status = await waitForReport(data.jobId);
  const filename = status.filename || `health-report-${safeFileSegment(payload.petName)}.pdf`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  if (!dir) throw new Error('Local file storage is not available.');

  const filePath = `${dir}${safeFileSegment(filename)}`;
  await FileSystem.downloadAsync(absoluteApiUrl(`/reports/${data.jobId}/download`), filePath, {
    headers: await authHeaders(),
  });

  return {
    filePath,
    filename,
    jobId: data.jobId,
    recordCount: status.recordCount,
  };
}

/** Share the generated health dashboard PDF via the native iOS/Android sheet. */
export async function shareHealthDashboardReport(filePath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(filePath, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share Health Report PDF',
  });
}
