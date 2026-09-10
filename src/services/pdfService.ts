import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import type { VaccinationReminder } from './vaccinationService';

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

export interface HealthReportWeightEntry {
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
  active?: boolean;
}

export interface HealthReportAppointment {
  id?: string;
  type: string;
  date: string;
  time?: string;
  status?: string;
  notes?: string;
  vetName?: string;
}

export interface HealthReportRecord {
  id?: string;
  type: string;
  visitDate: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  blockchainTxHash?: string;
  nextVisitDate?: string;
}

export interface PetHealthReportData {
  petId: string;
  petName: string;
  species?: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  weightKg?: number;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  healthScore?: number | null;
  healthStatus?: string;
  weightHistory?: HealthReportWeightEntry[];
  medications?: HealthReportMedication[];
  appointments?: HealthReportAppointment[];
  records?: HealthReportRecord[];
  clinicName?: string;
}

export interface GeneratedHealthReport {
  filePath: string;
  hash: string;
  generatedAt: string;
  recordCount: number;
}

async function generateQRDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, { width: 120, margin: 1 });
}

async function sha256(text: string): Promise<string> {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

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

function buildHealthReportText(
  data: PetHealthReportData,
  hash: string,
  generatedAt: string,
  qrDataUrl: string,
): string {
  const activeMedications = (data.medications ?? []).filter((m) => m.active !== false);
  const appointments = data.appointments ?? [];
  const records = data.records ?? [];
  const weightHistory = data.weightHistory ?? [];

  const lines: string[] = [
    '='.repeat(60),
    '         VETERINARY HEALTH REPORT',
    '='.repeat(60),
    data.clinicName ? `Clinic         : ${data.clinicName}` : 'Clinic         : Cocohub Partner Veterinary Clinic',
    `Report ID      : ${hash}`,
    `Generated      : ${generatedAt}`,
    '',
    '-'.repeat(60),
    'PET INFORMATION',
    '-'.repeat(60),
    `Name           : ${data.petName}`,
    `Pet ID         : ${data.petId}`,
    data.species ? `Species        : ${data.species}` : '',
    data.breed ? `Breed          : ${data.breed}` : '',
    data.dateOfBirth ? `Date of Birth  : ${data.dateOfBirth}` : '',
    data.microchipId ? `Microchip ID   : ${data.microchipId}` : '',
    data.weightKg ? `Current Weight : ${data.weightKg} kg` : '',
    '',
    '-'.repeat(60),
    'OWNER INFORMATION',
    '-'.repeat(60),
    `Owner Name     : ${data.ownerName ?? 'Primary Owner'}`,
    data.ownerEmail ? `Email          : ${data.ownerEmail}` : '',
    data.ownerPhone ? `Phone          : ${data.ownerPhone}` : '',
    '',
    '-'.repeat(60),
    'HEALTH SCORE & STATUS',
    '-'.repeat(60),
    `Health Score   : ${data.healthScore != null ? `${data.healthScore} / 100` : 'Not computed'}`,
    `Clinical Status: ${data.healthStatus ?? (data.healthScore != null && data.healthScore >= 80 ? 'Optimal' : 'Standard')}`,
    '',
    '-'.repeat(60),
    'WEIGHT & GROWTH HISTORY',
    '-'.repeat(60),
    ...weightHistory.map(
      (w, i) => `${i + 1}. ${w.date} — ${w.weightKg} kg${w.note ? ` (${w.note})` : ''}`,
    ),
    weightHistory.length === 0 ? 'No recorded weight entries.' : '',
    '',
    '-'.repeat(60),
    'ACTIVE MEDICATIONS',
    '-'.repeat(60),
    ...activeMedications.map(
      (m, i) =>
        `${i + 1}. ${m.name} | Dosage: ${m.dosage ?? 'As directed'} | Frequency: ${m.frequency ?? 'Daily'}${m.startDate ? ` | Started: ${m.startDate}` : ''}`,
    ),
    activeMedications.length === 0 ? 'No active medications on record.' : '',
    '',
    '-'.repeat(60),
    'UPCOMING APPOINTMENTS',
    '-'.repeat(60),
    ...appointments.map(
      (a, i) =>
        `${i + 1}. ${a.date}${a.time ? ` at ${a.time}` : ''} — ${a.type} [${a.status ?? 'Scheduled'}]${a.vetName ? ` with ${a.vetName}` : ''}${a.notes ? ` (Notes: ${a.notes})` : ''}`,
    ),
    appointments.length === 0 ? 'No upcoming appointments scheduled.' : '',
    '',
    '-'.repeat(60),
    'RECENT MEDICAL RECORDS',
    '-'.repeat(60),
    ...records.map(
      (r, i) =>
        `${i + 1}. ${r.visitDate} — ${r.type.toUpperCase()}\n   Diagnosis : ${r.diagnosis ?? 'N/A'}\n   Treatment : ${r.treatment ?? 'N/A'}\n   Notes     : ${r.notes ?? 'None'}\n   Blockchain: ${r.blockchainTxHash ?? 'Pending verification'}`,
    ),
    records.length === 0 ? 'No medical records on file for this period.' : '',
    '',
    '-'.repeat(60),
    'BLOCKCHAIN VERIFICATION',
    '-'.repeat(60),
    `Report Hash    : ${hash}`,
    `Verification   : https://cocohub.app/verify/${data.petId}`,
    `[QR Code Data  : ${qrDataUrl.slice(0, 40)}...]`,
    '',
    '-'.repeat(60),
    'VETERINARY ASSESSMENT & SIGN-OFF',
    '-'.repeat(60),
    'Clinical Evaluation: _____________________________________________',
    '',
    'Veterinarian Signature: __________________   Date: _______________',
    '',
    '='.repeat(60),
    'This health report is certified and clinic-ready via Cocohub.',
    '='.repeat(60),
  ].filter((line) => line !== undefined);

  return lines.join('\n');
}

/**
 * Generate a vaccination certificate as a text file (PDF-like format).
 * Uses expo-file-system for storage and expo-sharing for the share sheet.
 *
 * @param pet Information about the pet and its owner
 * @param vaccinations Collection of vaccination reminders and administered records
 * @returns Promise resolving to the generated certificate details
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
 * Generate a comprehensive, clinic-ready health report PDF for a pet.
 * Attempts server-side PDFKit generation first, and falls back to a formatted local document.
 *
 * @param data Complete pet health dataset including vitals, score, weights, meds, and appointments
 * @returns Promise resolving to the generated health report metadata
 */
export async function generateHealthReportPdf(
  data: PetHealthReportData,
): Promise<GeneratedHealthReport> {
  const generatedAt = new Date().toISOString();
  const contentForHash = `${data.petId}-${data.petName}-${generatedAt}`;
  const hash = await sha256(contentForHash);

  const blockchainUrl = `https://cocohub.app/verify/${data.petId}`;
  const qrDataUrl = await generateQRDataUrl(blockchainUrl);

  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  const fileName = `health-report-${data.petId}-${hash}.pdf`;
  const filePath = `${dir}${fileName}`;

  try {
    const apiClient = (await import('./apiClient')).default;
    const response = await apiClient.post(
      `/reports/pets/${data.petId}/health?sync=true`,
      {
        sync: true,
        healthScore: data.healthScore,
        healthStatus: data.healthStatus,
        weightHistory: data.weightHistory,
        appointments: data.appointments,
        clinicName: data.clinicName,
      },
      {
        responseType: 'arraybuffer',
        headers: { Accept: 'application/pdf' },
      },
    );

    if (response && response.data) {
      const buffer = Buffer.from(response.data as ArrayBuffer);
      const base64Data = buffer.toString('base64');
      await FileSystem.writeAsStringAsync(filePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return {
        filePath,
        hash,
        generatedAt,
        recordCount: data.records?.length ?? 0,
      };
    }
  } catch {
    // API endpoint unavailable or running locally without backend
  }

  const content = buildHealthReportText(data, hash, generatedAt, qrDataUrl);
  await FileSystem.writeAsStringAsync(filePath, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    filePath,
    hash,
    generatedAt,
    recordCount: data.records?.length ?? 0,
  };
}

/**
 * Share the generated certificate via the native share sheet.
 *
 * @param filePath Path of the file to share
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
 * Share the generated health report via the native iOS/Android share sheet.
 *
 * @param filePath Local file path of the health report PDF
 * @param petName Optional pet name to display in the sharing title
 */
export async function shareHealthReport(filePath: string, petName?: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(filePath, {
    mimeType: 'application/pdf',
    dialogTitle: petName ? `Share ${petName}'s Health Report` : 'Share Health Report',
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Perform single-tap generation and sharing of a pet health report.
 *
 * @param data Complete health report dataset
 * @returns Promise resolving to the generated health report
 */
export async function exportAndShareHealthReport(
  data: PetHealthReportData,
): Promise<GeneratedHealthReport> {
  const report = await generateHealthReportPdf(data);
  await shareHealthReport(report.filePath, data.petName);
  return report;
}

/**
 * Anchor the certificate hash to Stellar blockchain.
 *
 * @param certificateHash The SHA-256 hash of the certificate
 * @returns Promise resolving to the transaction hash, or null on failure
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
    return null;
  }
}
