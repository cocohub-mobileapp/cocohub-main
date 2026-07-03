import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import type { StoredMedicalRecord, StoredMedication, StoredPet, StoredUser } from '../server/store';

export interface ReportVitalReading {
  id?: string;
  petId?: string;
  recordedAt?: string;
  recorded_at?: string;
  vitalType?: string;
  vital_type?: string;
  value?: number | string;
  unit?: string;
  notes?: string;
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
  healthMetrics?: ReportVitalReading[];
}

export interface ReportResult {
  buffer: Buffer;
  filename: string;
  recordCount: number;
}

export interface WeightReading {
  date: string;
  value: number;
  unit: string;
}

export interface ReportHealthScore {
  score: number;
  label: string;
  factors: string[];
}

function sanitize(value: unknown): string {
  if (value == null) return '';
  return (
    String(value)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .slice(0, 2000)
  );
}

function safeDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return sanitize(value);
  return date.toISOString().slice(0, 10);
}

function metricDate(metric: ReportVitalReading): string {
  return metric.recordedAt ?? metric.recorded_at ?? '';
}

function metricType(metric: ReportVitalReading): string {
  return sanitize(metric.vitalType ?? metric.vital_type).toLowerCase();
}

function metricNumber(metric: ReportVitalReading): number | null {
  const value = Number(metric.value);
  return Number.isFinite(value) ? value : null;
}

function activeMedications(medications: StoredMedication[]): StoredMedication[] {
  return medications.filter((med) => med.active);
}

function latestMetric(metrics: ReportVitalReading[], type: string): ReportVitalReading | undefined {
  return [...metrics]
    .filter((metric) => metricType(metric) === type && metricNumber(metric) !== null)
    .sort((a, b) => new Date(metricDate(b)).getTime() - new Date(metricDate(a)).getTime())[0];
}

function temperatureC(metric: ReportVitalReading | undefined): number | null {
  if (!metric) return null;
  const value = metricNumber(metric);
  if (value === null) return null;
  const unit = sanitize(metric.unit).toLowerCase();
  if (unit === 'f' || unit === 'fahrenheit') {
    return ((value - 32) * 5) / 9;
  }
  return value;
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Fair';
  return 'Needs Attention';
}

function scoreColor(score: number): string {
  if (score >= 80) return '#1f8a4c';
  if (score >= 60) return '#b7791f';
  return '#b91c1c';
}

export function calculateReportHealthScore(
  metrics: ReportVitalReading[] = [],
  medications: StoredMedication[] = [],
  pet?: StoredPet,
): ReportHealthScore {
  let score = 78;
  const factors: string[] = [];
  const temp = temperatureC(latestMetric(metrics, 'temperature'));
  const activity = latestMetric(metrics, 'activity_level');
  const latestWeight = latestMetric(metrics, 'weight');

  if (temp !== null) {
    if (temp >= 38.0 && temp <= 39.2) {
      score += 8;
      factors.push('Temperature is in the typical healthy range.');
    } else if (temp >= 37.5 && temp <= 40.0) {
      score -= 4;
      factors.push('Temperature is close to the expected range.');
    } else {
      score -= 14;
      factors.push('Temperature is outside the expected range.');
    }
  } else {
    factors.push('No recent temperature reading on file.');
  }

  const activityValue = sanitize(activity?.value).toLowerCase();
  if (activityValue === 'high' || activityValue === '3') {
    score += 6;
    factors.push('Recent activity is high.');
  } else if (activityValue === 'moderate' || activityValue === '2') {
    score += 2;
    factors.push('Recent activity is moderate.');
  } else if (activityValue === 'low' || activityValue === '1') {
    score -= 7;
    factors.push('Recent activity is low.');
  }

  const weight = latestWeight ? metricNumber(latestWeight) : null;
  if (weight !== null && pet?.weightKg) {
    const delta = Math.abs(weight - pet.weightKg) / pet.weightKg;
    if (delta <= 0.05) {
      score += 4;
      factors.push('Weight is stable against the pet profile.');
    } else if (delta <= 0.15) {
      score -= 4;
      factors.push('Weight has a moderate change from the pet profile.');
    } else {
      score -= 10;
      factors.push('Weight has changed materially from the pet profile.');
    }
  }

  const activeCount = activeMedications(medications).length;
  if (activeCount > 0) {
    score -= Math.min(activeCount * 3, 12);
    factors.push(`${activeCount} active medication${activeCount === 1 ? '' : 's'} on file.`);
  } else {
    factors.push('No active medications on file.');
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  return { score: bounded, label: scoreLabel(bounded), factors };
}

export function getWeightReadings(
  pet: StoredPet,
  metrics: ReportVitalReading[] = [],
): WeightReading[] {
  const readings = metrics
    .filter((metric) => metricType(metric) === 'weight' && metricNumber(metric) !== null)
    .map((metric) => ({
      date: safeDate(metricDate(metric)) || 'Unknown',
      value: metricNumber(metric) ?? 0,
      unit: sanitize(metric.unit) || 'kg',
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (readings.length === 0 && typeof pet.weightKg === 'number') {
    readings.push({
      date: safeDate(pet.updatedAt) || safeDate(pet.createdAt) || 'Current',
      value: pet.weightKg,
      unit: 'kg',
    });
  }

  return readings;
}

export function filterByDateRange(
  records: StoredMedicalRecord[],
  dateFrom?: string,
  dateTo?: string,
): StoredMedicalRecord[] {
  return records.filter((record) => {
    if (dateFrom && record.visitDate < dateFrom) return false;
    if (dateTo && record.visitDate > dateTo) return false;
    return true;
  });
}

export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(url, { width: 120, margin: 1, errorCorrectionLevel: 'M' });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^10\./.test(host) || /^127\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

async function loadPhotoBuffer(photoUrl?: string): Promise<Buffer | null> {
  if (!photoUrl) return null;

  try {
    if (photoUrl.startsWith('data:image/')) {
      const base64 = photoUrl.split(',')[1];
      return base64 ? Buffer.from(base64, 'base64') : null;
    }

    const parsed = new URL(photoUrl);
    if (!['https:', 'http:'].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) {
      return null;
    }

    const response = await fetch(parsed.toString());
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;

    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

let drawingWatermark = false;
function drawWatermark(doc: PDFKit.PDFDocument, generatedBy: string, timestamp: string): void {
  if (drawingWatermark) return;
  drawingWatermark = true;
  try {
    const { width, height } = doc.page;
    doc.save();
    doc
      .fontSize(8)
      .fillColor('#9ca3af')
      .opacity(0.5)
      .text(`Generated: ${timestamp} | User: ${generatedBy}`, 0, height - 20, {
        width,
        align: 'center',
        lineBreak: false,
      });
    doc.restore();
  } finally {
    drawingWatermark = false;
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) doc.addPage();
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 45);
  doc
    .moveDown(0.7)
    .fontSize(12)
    .fillColor('#1a56db')
    .text(title)
    .moveDown(0.2)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#1a56db')
    .lineWidth(0.5)
    .stroke()
    .moveDown(0.35)
    .fillColor('#111111')
    .fontSize(10);
}

function row(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text(`${label}: `, { continued: true })
    .fillColor('#111111')
    .text(value || '-');
}

function drawPetPhoto(doc: PDFKit.PDFDocument, photoBuffer: Buffer | null): void {
  const x = doc.page.width - doc.page.margins.right - 112;
  const y = 112;

  doc.save();
  doc.roundedRect(x, y, 112, 112, 8).strokeColor('#d1d5db').lineWidth(1).stroke();
  if (photoBuffer) {
    try {
      doc.image(photoBuffer, x + 6, y + 6, { fit: [100, 100], align: 'center', valign: 'center' });
    } catch {
      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Photo unavailable', x + 10, y + 48, { width: 92, align: 'center' });
    }
  } else {
    doc
      .fontSize(8)
      .fillColor('#6b7280')
      .text('No photo on file', x + 10, y + 48, {
        width: 92,
        align: 'center',
      });
  }
  doc.restore();
}

function drawHealthScore(doc: PDFKit.PDFDocument, healthScore: ReportHealthScore): void {
  sectionHeader(doc, 'Health Score');
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const scoreWidth = 110;

  doc.save();
  doc.roundedRect(x, y, width, 92, 8).fillAndStroke('#f9fafb', '#e5e7eb');
  doc.circle(x + 55, y + 45, 33).fill(scoreColor(healthScore.score));
  doc
    .fillColor('#ffffff')
    .fontSize(22)
    .text(String(healthScore.score), x + 20, y + 33, { width: 70, align: 'center' })
    .fontSize(8)
    .text('/100', x + 20, y + 56, { width: 70, align: 'center' });

  doc
    .fillColor(scoreColor(healthScore.score))
    .fontSize(14)
    .text(healthScore.label, x + scoreWidth + 18, y + 16, { width: width - scoreWidth - 28 });

  const factors = healthScore.factors.slice(0, 3);
  doc.fillColor('#374151').fontSize(8);
  factors.forEach((factor, index) => {
    doc.text(`- ${factor}`, x + scoreWidth + 18, y + 40 + index * 14, {
      width: width - scoreWidth - 28,
    });
  });
  doc.restore();
  doc.y = y + 102;
}

function drawWeightChart(doc: PDFKit.PDFDocument, readings: WeightReading[]): void {
  sectionHeader(doc, 'Weight Trend');

  if (readings.length === 0) {
    doc.fontSize(9).fillColor('#6b7280').text('No weight readings on file.');
    return;
  }

  ensureSpace(doc, 190);
  const x = doc.page.margins.left;
  const y = doc.y + 10;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 130;
  const values = readings.map((reading) => reading.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, 1);
  const chartMin = min - padding;
  const chartMax = max + padding;
  const scaleY = (value: number) =>
    y + height - ((value - chartMin) / (chartMax - chartMin)) * height;
  const scaleX = (index: number) =>
    readings.length === 1 ? x + width / 2 : x + (index / (readings.length - 1)) * width;

  doc.save();
  doc.roundedRect(x, y, width, height, 6).strokeColor('#d1d5db').lineWidth(1).stroke();
  doc
    .fontSize(7)
    .fillColor('#6b7280')
    .text(`${chartMax.toFixed(1)} ${readings[0].unit}`, x + 6, y + 6)
    .text(`${chartMin.toFixed(1)} ${readings[0].unit}`, x + 6, y + height - 14);

  doc.strokeColor('#1a56db').lineWidth(2);
  readings.forEach((reading, index) => {
    const pointX = scaleX(index);
    const pointY = scaleY(reading.value);
    if (index === 0) {
      doc.moveTo(pointX, pointY);
    } else {
      doc.lineTo(pointX, pointY);
    }
  });
  if (readings.length > 1) doc.stroke();

  readings.forEach((reading, index) => {
    const pointX = scaleX(index);
    const pointY = scaleY(reading.value);
    doc.circle(pointX, pointY, 3).fill('#1a56db');
    if (index === 0 || index === readings.length - 1 || readings.length <= 4) {
      doc
        .fontSize(7)
        .fillColor('#374151')
        .text(`${reading.value.toFixed(1)} ${reading.unit}`, pointX - 26, pointY - 18, {
          width: 52,
          align: 'center',
        })
        .fillColor('#6b7280')
        .text(reading.date, pointX - 34, y + height + 8, { width: 68, align: 'center' });
    }
  });
  doc.restore();
  doc.y = y + height + 34;
}

function drawVaccinationTable(doc: PDFKit.PDFDocument, records: StoredMedicalRecord[]): void {
  sectionHeader(doc, 'Vaccinations');

  const vaccinations = records.filter(
    (record) => sanitize(record.type).toLowerCase() === 'vaccination',
  );
  if (vaccinations.length === 0) {
    doc.fontSize(9).fillColor('#6b7280').text('No vaccinations on file for the selected period.');
    return;
  }

  const x = doc.page.margins.left;
  const widths = [72, 180, 92, 170];
  const headers = ['Date', 'Vaccine', 'Next Due', 'Verification'];

  ensureSpace(doc, 35 + vaccinations.length * 34);
  let y = doc.y;
  doc.fontSize(8).fillColor('#111827');
  headers.forEach((header, index) => {
    const colX = x + widths.slice(0, index).reduce((sum, value) => sum + value, 0);
    doc.text(header, colX, y, { width: widths[index] - 8 });
  });
  y += 16;
  doc
    .moveTo(x, y)
    .lineTo(x + widths.reduce((sum, value) => sum + value, 0), y)
    .strokeColor('#d1d5db')
    .stroke();
  y += 8;

  vaccinations.forEach((record) => {
    if (y > doc.page.height - doc.page.margins.bottom - 38) {
      doc.addPage();
      y = doc.y;
    }

    const values = [
      safeDate(record.visitDate),
      sanitize(record.treatment || record.diagnosis || record.notes || 'Vaccination'),
      safeDate(record.nextVisitDate) || '-',
      record.blockchainTxHash
        ? `Verified: ${sanitize(record.blockchainTxHash).slice(0, 18)}...`
        : 'Not blockchain verified',
    ];

    doc.fontSize(8).fillColor('#374151');
    values.forEach((value, index) => {
      const colX = x + widths.slice(0, index).reduce((sum, colWidth) => sum + colWidth, 0);
      doc.text(value, colX, y, { width: widths[index] - 8, height: 28 });
    });
    y += 34;
  });

  doc.y = y;
}

function drawMedicationTable(doc: PDFKit.PDFDocument, medications: StoredMedication[]): void {
  const activeMeds = activeMedications(medications);
  sectionHeader(doc, `Active Medications (${activeMeds.length})`);

  if (activeMeds.length === 0) {
    doc.fontSize(9).fillColor('#6b7280').text('No active medications.');
    return;
  }

  activeMeds.forEach((medication) => {
    ensureSpace(doc, 58);
    doc
      .fontSize(10)
      .fillColor('#111827')
      .text(sanitize(medication.name) || 'Medication')
      .moveDown(0.1);
    row(doc, 'Dosage', sanitize(medication.dosage));
    row(doc, 'Frequency', sanitize(medication.frequency));
    row(doc, 'Start Date', safeDate(medication.startDate));
    if (medication.endDate) row(doc, 'End Date', safeDate(medication.endDate));
    doc.moveDown(0.35);
  });
}

function drawMedicalHistory(doc: PDFKit.PDFDocument, records: StoredMedicalRecord[]): void {
  sectionHeader(
    doc,
    `Medical History (${records.length} record${records.length === 1 ? '' : 's'})`,
  );

  if (records.length === 0) {
    doc.fontSize(9).fillColor('#6b7280').text('No medical records found for the selected period.');
    return;
  }

  records.forEach((record, index) => {
    ensureSpace(doc, 122);
    doc
      .fontSize(10)
      .fillColor('#333333')
      .text(
        `${index + 1}. ${sanitize(record.type).toUpperCase()} - ${safeDate(record.visitDate)}`,
        {
          underline: true,
        },
      )
      .moveDown(0.1);

    row(doc, 'Diagnosis', sanitize(record.diagnosis));
    row(doc, 'Treatment', sanitize(record.treatment));
    row(doc, 'Notes', sanitize(record.notes));
    row(doc, 'Next Visit', safeDate(record.nextVisitDate));

    if (record.blockchainTxHash) {
      doc
        .fontSize(8)
        .fillColor('#1a56db')
        .text(`Blockchain verified: ${sanitize(record.blockchainTxHash).slice(0, 24)}...`);
    }
    doc.moveDown(0.45);
  });
}

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
    healthMetrics = [],
  } = opts;

  const filteredRecords = filterByDateRange(records, dateFrom, dateTo);
  const timestamp = new Date().toISOString();
  const filename = `health-report-${sanitize(pet.id)}-${Date.now()}.pdf`;
  const verifiedRecords = filteredRecords.filter((record) => record.blockchainTxHash);
  const qrUrl = `${blockchainBaseUrl}/${sanitize(pet.id)}`;
  const [qrBuffer, photoBuffer] = await Promise.all([
    generateQRCodeBuffer(qrUrl),
    loadPhotoBuffer(pet.photoUrl ?? pet.thumbnailUrl),
  ]);
  const healthScore = calculateReportHealthScore(healthMetrics, medications, pet);
  const weightReadings = getWeightReadings(pet, healthMetrics);

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
      .text('Cocohub Vet-Ready Health Report', { align: 'center' })
      .moveDown(0.3)
      .fontSize(10)
      .fillColor('#555555')
      .text(`Generated: ${new Date(timestamp).toLocaleString()}`, { align: 'center' })
      .moveDown(0.1)
      .text(`Report Period: ${dateFrom ?? 'All time'} to ${dateTo ?? 'Present'}`, {
        align: 'center',
      })
      .moveDown(0.8);

    const qrX = doc.page.width - doc.page.margins.right - 120;
    try {
      doc.image(qrBuffer, qrX, 50, { width: 100 });
    } catch {
      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Verification QR unavailable', qrX, 92, { width: 100, align: 'center' });
    }
    doc
      .fontSize(7)
      .fillColor('#6b7280')
      .text('Scan to verify on blockchain', qrX, 155, { width: 100, align: 'center' });

    sectionHeader(doc, 'Pet Profile');
    const profileEndY = doc.y;
    row(doc, 'Name', sanitize(pet.name));
    row(doc, 'Species', sanitize(pet.species));
    row(doc, 'Breed', sanitize(pet.breed));
    row(doc, 'Date of Birth', safeDate(pet.dateOfBirth));
    row(doc, 'Current Weight', typeof pet.weightKg === 'number' ? `${pet.weightKg} kg` : '');
    row(doc, 'Microchip ID', sanitize(pet.microchipId));
    drawPetPhoto(doc, photoBuffer);
    doc.y = Math.max(doc.y, profileEndY + 120);

    sectionHeader(doc, 'Owner Information');
    row(doc, 'Name', sanitize(owner.name));
    row(doc, 'Email', sanitize(owner.email));
    row(doc, 'Phone', sanitize(owner.phone));

    drawHealthScore(doc, healthScore);
    drawWeightChart(doc, weightReadings);
    drawVaccinationTable(doc, filteredRecords);
    drawMedicationTable(doc, medications);
    drawMedicalHistory(doc, filteredRecords);

    sectionHeader(doc, 'Blockchain Verification');
    row(doc, 'Verified Records', String(verifiedRecords.length));
    row(doc, 'Verification URL', qrUrl);
    doc
      .moveDown(0.3)
      .fontSize(8)
      .fillColor('#6b7280')
      .text('Scan the QR code on the first page to verify this report on the Stellar blockchain.');

    addWatermark();
    doc.end();
  });
}
