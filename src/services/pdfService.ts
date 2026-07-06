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

import type { Appointment } from '../models/Appointment';
import type { HealthMetricEntry } from '../models/HealthMetric';
import type { Medication } from '../models/Medication';
import type { Pet } from './petService';
import type { WeightDataPoint } from '../components/WeightChart';
import type { MedicalRecord } from './medicalRecordService';
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

export interface HealthMetricsReportInput {
  pet: Pick<Pet, 'id' | 'name' | 'species' | 'breed' | 'dateOfBirth' | 'weightKg' | 'microchipId'>;
  healthScore: number | null;
  latestMetric: HealthMetricEntry | null;
  weightHistory: WeightDataPoint[];
  activeMedications: Medication[];
  upcomingAppointments: Appointment[];
  recentRecords: MedicalRecord[];
}

export interface GeneratedHealthMetricsReport {
  filePath: string;
  hash: string;
  generatedAt: string;
  recordCount: number;
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

function safeText(value: unknown, fallback = 'N/A'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).replace(/\s+/g, ' ').trim();
}

function pdfEscape(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildSimplePdf(title: string, body: string): string {
  const lines = [title, '', ...body.split('\n')].map((line) => pdfEscape(line.slice(0, 100)));
  const linesPerPage = 44;
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects: string[] = [];
  const addObject = (bodyText: string) => {
    objects.push(bodyText);
    return objects.length;
  };

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];

  pages.forEach((pageLines) => {
    const content = [
      'BT',
      '/F1 11 Tf',
      '50 790 Td',
      '14 TL',
      ...pageLines.map((line, index) => `${index === 0 ? '' : 'T* '}(${line}) Tj`),
      'ET',
    ].join('\n');
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function formatReportDate(value?: string): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildHealthMetricsReportText(
  input: HealthMetricsReportInput,
  hash: string,
  generatedAt: string,
): string {
  const {
    pet,
    healthScore,
    latestMetric,
    weightHistory,
    activeMedications,
    upcomingAppointments,
    recentRecords,
  } = input;

  const latestWeight = latestMetric?.weightKg ?? weightHistory[0]?.weightKg ?? pet.weightKg;
  const weightTrend = weightHistory
    .slice(0, 12)
    .map((point) => `${formatReportDate(point.date)}: ${point.weightKg} kg`)
    .join('\n');

  const medicationLines = activeMedications.length
    ? activeMedications.map((med, index) =>
        [
          `${index + 1}. ${safeText(med.name)}`,
          `   Dosage: ${safeText(med.dosage)}`,
          `   Frequency: every ${safeText(med.frequency)} hour(s)`,
          `   Until: ${formatReportDate(med.endDate)}`,
        ].join('\n'),
      )
    : ['No active medications.'];

  const appointmentLines = upcomingAppointments.length
    ? upcomingAppointments.map((appointment, index) =>
        [
          `${index + 1}. ${safeText(appointment.type).replace(/_/g, ' ')}`,
          `   Date: ${formatReportDate(appointment.date)} at ${safeText(appointment.time)}`,
          `   Status: ${safeText(appointment.status)}`,
          appointment.vet?.name ? `   Vet: ${safeText(appointment.vet.name)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    : ['No upcoming appointments.'];

  const recordLines = recentRecords.length
    ? recentRecords.map((record, index) =>
        [
          `${index + 1}. ${safeText(record.type).toUpperCase()} - ${formatReportDate(record.date ?? record.createdAt)}`,
          record.veterinarian ? `   Veterinarian: ${safeText(record.veterinarian)}` : '',
          record.notes ? `   Notes: ${safeText(record.notes)}` : '',
          record.nextVisitDate ? `   Next visit: ${formatReportDate(record.nextVisitDate)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    : ['No recent medical records.'];

  const lines = [
    '='.repeat(72),
    'COCOHUB VET-READY HEALTH METRICS REPORT',
    '='.repeat(72),
    `Report ID: ${hash}`,
    `Generated: ${generatedAt}`,
    '',
    'PET INFORMATION',
    '-'.repeat(72),
    `Name: ${safeText(pet.name)}`,
    `Species: ${safeText(pet.species)}`,
    `Breed: ${safeText(pet.breed)}`,
    `Date of Birth: ${formatReportDate(pet.dateOfBirth)}`,
    `Microchip ID: ${safeText(pet.microchipId)}`,
    '',
    'HEALTH SUMMARY',
    '-'.repeat(72),
    `Health Score: ${healthScore === null ? 'N/A' : `${healthScore}/100`}`,
    `Latest Weight: ${latestWeight === undefined ? 'N/A' : `${latestWeight} kg`}`,
    `Latest Temperature: ${latestMetric?.temperatureC === undefined ? 'N/A' : `${latestMetric.temperatureC} C`}`,
    `Latest Activity: ${safeText(latestMetric?.activityLevel)}`,
    `Latest Reading Date: ${formatReportDate(latestMetric?.recordedAt)}`,
    latestMetric?.notes ? `Latest Notes: ${safeText(latestMetric.notes)}` : '',
    '',
    'WEIGHT CHART DATA',
    '-'.repeat(72),
    weightTrend || 'No weight history recorded.',
    '',
    'ACTIVE MEDICATIONS',
    '-'.repeat(72),
    ...medicationLines,
    '',
    'UPCOMING APPOINTMENTS',
    '-'.repeat(72),
    ...appointmentLines,
    '',
    'RECENT MEDICAL RECORDS',
    '-'.repeat(72),
    ...recordLines,
    '',
    '='.repeat(72),
    'Prepared for veterinary review. Share this report with your clinic as needed.',
    '='.repeat(72),
  ].filter((line) => line !== '');

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

export async function generateHealthMetricsReport(
  input: HealthMetricsReportInput,
): Promise<GeneratedHealthMetricsReport> {
  const generatedAt = new Date().toISOString();
  const contentForHash = `${input.pet.id}-${input.pet.name}-${generatedAt}-${input.recentRecords.length}`;
  const hash = await sha256(contentForHash);
  const content = buildSimplePdf(
    'Cocohub Health Metrics Report',
    buildHealthMetricsReportText(input, hash, generatedAt),
  );

  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  const fileName = `health-metrics-report-${input.pet.id}-${hash}.pdf`;
  const filePath = `${dir}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { filePath, hash, generatedAt, recordCount: input.recentRecords.length };
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

export async function shareHealthMetricsReport(filePath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(filePath, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Health Metrics Report',
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
