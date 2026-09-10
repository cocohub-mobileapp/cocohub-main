import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import type { StoredMedicalRecord, StoredMedication, StoredPet, StoredUser } from '../server/store';

export interface ReportWeightEntry {
  date: string;
  weightKg: number;
  note?: string;
}

export interface ReportAppointmentEntry {
  id?: string;
  type: string;
  date: string;
  time?: string;
  status?: string;
  notes?: string;
  vetName?: string;
}

export interface ReportOptions {
  pet: StoredPet;
  owner: StoredUser;
  records: StoredMedicalRecord[];
  medications: StoredMedication[];
  generatedBy: string;
  dateFrom?: string;
  dateTo?: string;
  blockchainBaseUrl?: string;
  healthScore?: number | null;
  healthStatus?: string;
  weightHistory?: ReportWeightEntry[];
  appointments?: ReportAppointmentEntry[];
  clinicName?: string;
}

export interface ReportResult {
  buffer: Buffer;
  filename: string;
  recordCount: number;
}

function sanitize(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 2000);
}

/**
 * Filter medical records by date range.
 *
 * @param records Collection of medical records to filter
 * @param dateFrom Optional lower bound date string
 * @param dateTo Optional upper bound date string
 * @returns Filtered records within the range
 */
export function filterByDateRange(
  records: StoredMedicalRecord[],
  dateFrom?: string,
  dateTo?: string,
): StoredMedicalRecord[] {
  return records.filter((r) => {
    if (dateFrom && r.visitDate < dateFrom) return false;
    if (dateTo && r.visitDate > dateTo) return false;
    return true;
  });
}

/**
 * Generate a PNG Buffer containing a QR code for a given verification URL.
 *
 * @param url The URL to encode in the QR code
 * @returns Promise resolving to a PNG image Buffer
 */
export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(url, { width: 120, margin: 1, errorCorrectionLevel: 'M' });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

let _drawingWatermark = false;

function drawWatermark(doc: PDFKit.PDFDocument, generatedBy: string, timestamp: string): void {
  if (_drawingWatermark) return;
  _drawingWatermark = true;
  try {
    const { width, height } = doc.page;
    doc.save();
    doc
      .fontSize(8)
      .fillColor('#999999')
      .opacity(0.6)
      .text(`Generated: ${timestamp} | Authenticated User: ${generatedBy}`, 0, height - 25, {
        width,
        align: 'center',
        lineBreak: false,
      });
    doc.restore();
  } finally {
    _drawingWatermark = false;
  }
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
    doc.addPage();
  }
  doc
    .moveDown(0.5)
    .fontSize(12)
    .fillColor('#1a56db')
    .text(title)
    .moveDown(0.2)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#1a56db')
    .lineWidth(0.75)
    .stroke()
    .moveDown(0.3)
    .fillColor('#111111')
    .fontSize(10);
}

function row(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text(`${label}: `, { continued: true })
    .fillColor('#111111')
    .text(value || '—');
}

/**
 * Generate a complete, clinic-ready pet health report in PDF format using pdfkit.
 *
 * @param opts Options including pet profile, owner details, records, medications, appointments, score, and weights
 * @returns Promise resolving to the generated PDF buffer, filename, and record count
 */
export async function generateHealthReport(opts: ReportOptions): Promise<ReportResult> {
  const {
    pet,
    owner,
    records,
    medications,
    generatedBy,
    dateFrom,
    dateTo,
    blockchainBaseUrl = 'https://cocohub.app/verify',
    healthScore,
    healthStatus,
    weightHistory = [],
    appointments = [],
    clinicName,
  } = opts;

  const filteredRecords = filterByDateRange(records, dateFrom, dateTo);
  const timestamp = new Date().toISOString();
  const filename = `health-report-${sanitize(pet.id)}-${Date.now()}.pdf`;

  const verifiedRecords = filteredRecords.filter((r) => r.blockchainTxHash);
  const qrUrl = `${blockchainBaseUrl}/${sanitize(pet.id)}`;
  const qrBuffer = await generateQRCodeBuffer(qrUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () =>
      resolve({ buffer: Buffer.concat(chunks), filename, recordCount: filteredRecords.length }),
    );

    const addWatermark = () => drawWatermark(doc, generatedBy, timestamp);
    doc.on('pageAdded', addWatermark);

    doc
      .fontSize(20)
      .fillColor('#1a56db')
      .text('Cocohub Veterinary Health Report', { align: 'center' })
      .moveDown(0.2)
      .fontSize(10)
      .fillColor('#555555')
      .text(clinicName ? `Clinic: ${clinicName}` : 'Professional Veterinary Health Assessment', {
        align: 'center',
      })
      .moveDown(0.1)
      .text(`Generated: ${new Date(timestamp).toLocaleString()}`, { align: 'center' })
      .moveDown(0.1)
      .text(`Report Period: ${dateFrom ?? 'All time'} → ${dateTo ?? 'Present'}`, {
        align: 'center',
      })
      .moveDown(0.5);

    const qrX = doc.page.width - doc.page.margins.right - 100;
    doc.image(qrBuffer, qrX, 45, { width: 85 });
    doc
      .fontSize(7)
      .fillColor('#888888')
      .text('Scan to verify on-chain', qrX, 135, { width: 85, align: 'center' });

    sectionHeader(doc, 'Pet Profile');
    row(doc, 'Name', sanitize(pet.name));
    row(doc, 'Species', sanitize(pet.species));
    row(doc, 'Breed', sanitize(pet.breed));
    row(doc, 'Date of Birth', sanitize(pet.dateOfBirth));
    row(doc, 'Microchip ID', sanitize(pet.microchipId));
    if (pet.weightKg != null) {
      row(doc, 'Registered Weight', `${pet.weightKg} kg`);
    }

    sectionHeader(doc, 'Owner Information');
    row(doc, 'Name', sanitize(owner.name));
    row(doc, 'Email', sanitize(owner.email));
    row(doc, 'Phone', sanitize(owner.phone));

    sectionHeader(doc, 'Health Score & Status');
    if (healthScore != null) {
      const displayStatus = healthStatus ?? (healthScore >= 80 ? 'Optimal' : healthScore >= 60 ? 'Good' : 'Needs Attention');
      row(doc, 'Overall Health Score', `${healthScore} / 100`);
      row(doc, 'Clinical Classification', displayStatus);
    } else {
      doc
        .fontSize(9)
        .fillColor('#888888')
        .text('Health score has not yet been computed for this pet.');
    }

    sectionHeader(doc, `Weight & Growth History (${weightHistory.length} recorded)`);
    if (weightHistory.length === 0) {
      doc.fontSize(9).fillColor('#888888').text('No historical weight entries recorded.');
    } else {
      const weights = weightHistory.map((w) => w.weightKg).filter((w) => typeof w === 'number');
      if (weights.length > 0) {
        const minWeight = Math.min(...weights);
        const maxWeight = Math.max(...weights);
        const latestWeight = weightHistory[0]?.weightKg;
        row(doc, 'Latest Weight', `${latestWeight} kg`);
        row(doc, 'Weight Range (Min / Max)', `${minWeight} kg / ${maxWeight} kg`);
        doc.moveDown(0.3);
      }

      weightHistory.slice(0, 10).forEach((entry, idx) => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
        doc
          .fontSize(9)
          .fillColor('#333333')
          .text(
            `${idx + 1}. ${sanitize(entry.date)}: ${entry.weightKg} kg${entry.note ? ` (${sanitize(entry.note)})` : ''}`,
          );
      });
    }

    sectionHeader(doc, `Upcoming Appointments (${appointments.length})`);
    if (appointments.length === 0) {
      doc.fontSize(9).fillColor('#888888').text('No upcoming appointments scheduled.');
    } else {
      appointments.forEach((appt) => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(`• ${sanitize(appt.type).toUpperCase()} — ${sanitize(appt.date)}${appt.time ? ` at ${sanitize(appt.time)}` : ''}`)
          .moveDown(0.1);
        if (appt.status) row(doc, 'Status', sanitize(appt.status));
        if (appt.vetName) row(doc, 'Veterinarian', sanitize(appt.vetName));
        if (appt.notes) row(doc, 'Notes', sanitize(appt.notes));
        doc.moveDown(0.2);
      });
    }

    const activeMeds = medications.filter((m) => m.active);
    sectionHeader(doc, `Active Medications (${activeMeds.length})`);
    if (activeMeds.length === 0) {
      doc.fontSize(9).fillColor('#888888').text('No active medications on record.');
    } else {
      activeMeds.forEach((med) => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(`• ${sanitize(med.name)}`)
          .moveDown(0.1);
        row(doc, 'Dosage', sanitize(med.dosage));
        row(doc, 'Frequency', sanitize(med.frequency));
        row(doc, 'Start Date', sanitize(med.startDate));
        doc.moveDown(0.2);
      });
    }

    sectionHeader(
      doc,
      `Recent Medical Records (${filteredRecords.length} record${filteredRecords.length !== 1 ? 's' : ''})`,
    );
    if (filteredRecords.length === 0) {
      doc
        .fontSize(9)
        .fillColor('#888888')
        .text('No medical records found for the selected period.');
    } else {
      filteredRecords.forEach((record, idx) => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
          doc.addPage();
        }

        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(
            `${idx + 1}. ${sanitize(record.type).toUpperCase()} — ${sanitize(record.visitDate)}`,
            { underline: true },
          )
          .moveDown(0.1);

        row(doc, 'Diagnosis', sanitize(record.diagnosis));
        row(doc, 'Treatment', sanitize(record.treatment));
        row(doc, 'Notes', sanitize(record.notes));
        row(doc, 'Next Visit', sanitize(record.nextVisitDate));

        if (record.blockchainTxHash) {
          doc
            .fontSize(8)
            .fillColor('#1a56db')
            .text(`✓ Blockchain verified: ${sanitize(record.blockchainTxHash).slice(0, 20)}…`);
        }
        doc.moveDown(0.3);
      });
    }

    sectionHeader(doc, 'Blockchain Verification & Authenticity');
    row(doc, 'Verified Records', String(verifiedRecords.length));
    row(doc, 'Verification URL', qrUrl);
    doc
      .moveDown(0.2)
      .fontSize(8)
      .fillColor('#888888')
      .text('Scan the QR code on the top of this page to verify this report on the Stellar blockchain.');

    if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
      doc.addPage();
    }
    sectionHeader(doc, 'Veterinary Assessment & Sign-Off');
    doc
      .fontSize(9)
      .fillColor('#555555')
      .text('Clinical Notes / Recommendations: ________________________________________________')
      .moveDown(0.4)
      .text('__________________________________________________________________________________')
      .moveDown(0.6)
      .text('Attending Veterinarian Signature: _______________________    Date: _______________');

    addWatermark();
    doc.end();
  });
}
