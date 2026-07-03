import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import type {
  StoredAppointment,
  StoredMedicalRecord,
  StoredMedication,
  StoredPet,
  StoredUser,
} from '../server/store';

export interface ReportMetricSnapshot {
  recordedAt: string;
  weightKg?: number;
  temperatureC?: number;
  activityLevel?: string;
  notes?: string;
}

export interface ReportWeightPoint {
  date: string;
  weightKg: number;
  note?: string;
}

export interface DashboardReportSnapshot {
  healthScore?: number | null;
  latestMetric?: ReportMetricSnapshot | null;
  weightHistory?: ReportWeightPoint[];
  upcomingAppointments?: StoredAppointment[];
  recentRecords?: StoredMedicalRecord[];
}

export interface ReportOptions {
  pet: StoredPet;
  owner: StoredUser;
  records: StoredMedicalRecord[];
  medications: StoredMedication[];
  appointments?: StoredAppointment[];
  dashboardSnapshot?: DashboardReportSnapshot;
  generatedBy: string; // authenticated user id
  dateFrom?: string; // ISO date string, inclusive
  dateTo?: string; // ISO date string, inclusive
  blockchainBaseUrl?: string;
}

export interface ReportResult {
  buffer: Buffer;
  filename: string;
  recordCount: number;
}

// ── Sanitize user content to prevent injection ─────────────────────────────
function sanitize(value: unknown): string {
  if (value == null) return '';
  return (
    String(value)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
      .slice(0, 2000)
  ); // cap length
}

// ── Filter records by optional date range ──────────────────────────────────
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

// ── Generate QR code as PNG Buffer ─────────────────────────────────────────
export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(url, { width: 120, margin: 1, errorCorrectionLevel: 'M' });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

// ── Draw watermark on current page ─────────────────────────────────────────
let _drawingWatermark = false;
function drawWatermark(doc: PDFKit.PDFDocument, generatedBy: string, timestamp: string): void {
  if (_drawingWatermark) return; // prevent re-entrant calls from pageAdded
  _drawingWatermark = true;
  try {
    const { width, height } = doc.page;
    doc.save();
    doc
      .fontSize(8)
      .fillColor('#cccccc')
      .opacity(0.5)
      .text(`Generated: ${timestamp} | User: ${generatedBy}`, 0, height - 20, {
        width,
        align: 'center',
        lineBreak: false,
      });
    doc.restore();
  } finally {
    _drawingWatermark = false;
  }
}

// ── Section header helper ──────────────────────────────────────────────────
function sectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc
    .moveDown(0.5)
    .fontSize(12)
    .fillColor('#1a56db')
    .text(title)
    .moveDown(0.2)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#1a56db')
    .lineWidth(0.5)
    .stroke()
    .moveDown(0.3)
    .fillColor('#111111')
    .fontSize(10);
}

// ── Row helper ─────────────────────────────────────────────────────────────
function row(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc
    .fontSize(9)
    .fillColor('#555555')
    .text(`${label}: `, { continued: true })
    .fillColor('#111111')
    .text(value || '—');
}

function formatDate(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? sanitize(value) : parsed.toISOString().slice(0, 10);
}

function formatAppointmentType(type: string): string {
  return sanitize(type)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ensureSpace(doc: PDFKit.PDFDocument, height = 90): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - height) {
    doc.addPage();
  }
}

function drawSummaryTile(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  accent = '#1a56db',
): void {
  doc
    .roundedRect(x, y, width, 58, 6)
    .fillAndStroke('#f8fafc', '#dbeafe')
    .fillColor(accent)
    .fontSize(18)
    .text(value, x + 10, y + 10, { width: width - 20, lineBreak: false })
    .fillColor('#475569')
    .fontSize(8)
    .text(label.toUpperCase(), x + 10, y + 36, { width: width - 20, lineBreak: false });
}

function drawWeightChart(doc: PDFKit.PDFDocument, weightHistory: ReportWeightPoint[]): void {
  sectionHeader(doc, 'Weight Trend');

  const points = weightHistory
    .filter((point) => typeof point.weightKg === 'number' && Number.isFinite(point.weightKg))
    .slice(-12);

  if (points.length === 0) {
    doc.fontSize(9).fillColor('#888888').text('No weight data available.');
    return;
  }

  ensureSpace(doc, 140);

  const chartX = doc.page.margins.left;
  const chartY = doc.y + 6;
  const chartWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const chartHeight = 120;
  const weights = points.map((point) => point.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = Math.max(maxWeight - minWeight, 1);
  const plotPadding = 16;
  const plotWidth = chartWidth - plotPadding * 2;
  const plotHeight = chartHeight - 34;

  doc.roundedRect(chartX, chartY, chartWidth, chartHeight, 6).fillAndStroke('#ffffff', '#cbd5e1');
  doc
    .strokeColor('#e2e8f0')
    .lineWidth(0.5)
    .moveTo(chartX + plotPadding, chartY + 18)
    .lineTo(chartX + plotPadding + plotWidth, chartY + 18)
    .moveTo(chartX + plotPadding, chartY + 18 + plotHeight / 2)
    .lineTo(chartX + plotPadding + plotWidth, chartY + 18 + plotHeight / 2)
    .moveTo(chartX + plotPadding, chartY + 18 + plotHeight)
    .lineTo(chartX + plotPadding + plotWidth, chartY + 18 + plotHeight)
    .stroke();

  const coordinates = points.map((point, index) => {
    const x =
      chartX + plotPadding + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = chartY + 18 + plotHeight - ((point.weightKg - minWeight) / range) * plotHeight;
    return { x, y, point };
  });

  coordinates.forEach((coord, index) => {
    if (index === 0) return;
    const previous = coordinates[index - 1];
    doc
      .strokeColor('#1a56db')
      .lineWidth(2)
      .moveTo(previous.x, previous.y)
      .lineTo(coord.x, coord.y)
      .stroke();
  });

  coordinates.forEach((coord) => {
    doc.circle(coord.x, coord.y, 3).fill('#1a56db');
  });

  const first = points[0];
  const last = points[points.length - 1];
  doc
    .fontSize(8)
    .fillColor('#475569')
    .text(`${minWeight.toFixed(1)} kg`, chartX + 8, chartY + chartHeight - 22, {
      width: 70,
      lineBreak: false,
    })
    .text(`${maxWeight.toFixed(1)} kg`, chartX + 8, chartY + 12, { width: 70, lineBreak: false })
    .text(formatDate(first.date), chartX + plotPadding, chartY + chartHeight - 16, {
      width: 110,
      lineBreak: false,
    })
    .text(formatDate(last.date), chartX + chartWidth - plotPadding - 110, chartY + chartHeight - 16, {
      width: 110,
      align: 'right',
      lineBreak: false,
    });

  doc.y = chartY + chartHeight + 6;
}

// ── Main PDF generation ────────────────────────────────────────────────────
export async function generateHealthReport(opts: ReportOptions): Promise<ReportResult> {
  const {
    pet,
    owner,
    records,
    medications,
    appointments = [],
    dashboardSnapshot,
    generatedBy,
    dateFrom,
    dateTo,
    blockchainBaseUrl = 'https://cocohub.app/verify',
  } = opts;

  const filteredRecords = filterByDateRange(records, dateFrom, dateTo);
  const activeMeds = medications.filter((m) => m.active);
  const upcomingAppointments =
    dashboardSnapshot?.upcomingAppointments ??
    appointments
      .filter((appointment) => !['CANCELLED', 'COMPLETED'].includes(String(appointment.status)))
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime(),
      )
      .slice(0, 5);
  const recentRecords = (dashboardSnapshot?.recentRecords ?? filteredRecords)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
    .slice(0, 5);
  const weightHistory = dashboardSnapshot?.weightHistory ?? [];
  const timestamp = new Date().toISOString();
  const filename = `health-report-${sanitize(pet.id)}-${Date.now()}.pdf`;

  // Collect blockchain tx hashes for QR
  const verifiedRecords = filteredRecords.filter((r) => r.blockchainTxHash);
  const qrUrl =
    verifiedRecords.length > 0
      ? `${blockchainBaseUrl}/${sanitize(pet.id)}`
      : `${blockchainBaseUrl}/${sanitize(pet.id)}`;

  const qrBuffer = await generateQRCodeBuffer(qrUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () =>
      resolve({ buffer: Buffer.concat(chunks), filename, recordCount: filteredRecords.length }),
    );

    // Track pages for watermark
    const addWatermark = () => drawWatermark(doc, generatedBy, timestamp);
    doc.on('pageAdded', addWatermark);

    // ── Cover / Header ──────────────────────────────────────────────────
    doc
      .fontSize(20)
      .fillColor('#1a56db')
      .text('Cocohub Health Report', { align: 'center' })
      .moveDown(0.3)
      .fontSize(10)
      .fillColor('#555555')
      .text(`Generated: ${new Date(timestamp).toLocaleString()}`, { align: 'center' })
      .moveDown(0.1)
      .text(`Report Period: ${dateFrom ?? 'All time'} - ${dateTo ?? 'Present'}`, {
        align: 'center',
      })
      .moveDown(0.5);

    // QR code (top-right)
    const qrX = doc.page.width - doc.page.margins.right - 120;
    doc.image(qrBuffer, qrX, 50, { width: 100 });
    doc
      .fontSize(7)
      .fillColor('#888888')
      .text('Scan to verify on blockchain', qrX, 155, { width: 100, align: 'center' });

    // ── Pet Profile ─────────────────────────────────────────────────────
    sectionHeader(doc, 'Pet Profile');
    row(doc, 'Name', sanitize(pet.name));
    row(doc, 'Species', sanitize(pet.species));
    row(doc, 'Breed', sanitize(pet.breed));
    row(doc, 'Date of Birth', sanitize(pet.dateOfBirth));
    row(doc, 'Microchip ID', sanitize(pet.microchipId));
    row(doc, 'Current Weight', pet.weightKg == null ? '' : `${pet.weightKg} kg`);

    // ── Owner Info ──────────────────────────────────────────────────────
    sectionHeader(doc, 'Owner Information');
    row(doc, 'Name', sanitize(owner.name));
    row(doc, 'Email', sanitize(owner.email));
    row(doc, 'Phone', sanitize(owner.phone));

    // ── Dashboard Summary ───────────────────────────────────────────────
    sectionHeader(doc, 'Clinic Summary');
    const tileY = doc.y;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const gap = 10;
    const tileWidth = (contentWidth - gap * 3) / 4;
    drawSummaryTile(
      doc,
      doc.page.margins.left,
      tileY,
      tileWidth,
      'Health Score',
      dashboardSnapshot?.healthScore == null ? 'N/A' : `${dashboardSnapshot.healthScore}/100`,
      dashboardSnapshot?.healthScore != null && dashboardSnapshot.healthScore < 60 ? '#c62828' : '#1a56db',
    );
    drawSummaryTile(
      doc,
      doc.page.margins.left + tileWidth + gap,
      tileY,
      tileWidth,
      'Active Meds',
      String(activeMeds.length),
      '#6a1b9a',
    );
    drawSummaryTile(
      doc,
      doc.page.margins.left + (tileWidth + gap) * 2,
      tileY,
      tileWidth,
      'Appointments',
      String(upcomingAppointments.length),
      '#1565c0',
    );
    drawSummaryTile(
      doc,
      doc.page.margins.left + (tileWidth + gap) * 3,
      tileY,
      tileWidth,
      'Records',
      String(filteredRecords.length),
      '#2e7d32',
    );
    doc.y = tileY + 70;

    if (dashboardSnapshot?.latestMetric) {
      sectionHeader(doc, 'Latest Reading');
      row(doc, 'Recorded At', formatDate(dashboardSnapshot.latestMetric.recordedAt));
      row(
        doc,
        'Weight',
        dashboardSnapshot.latestMetric.weightKg == null
          ? ''
          : `${dashboardSnapshot.latestMetric.weightKg} kg`,
      );
      row(
        doc,
        'Temperature',
        dashboardSnapshot.latestMetric.temperatureC == null
          ? ''
          : `${dashboardSnapshot.latestMetric.temperatureC} C`,
      );
      row(doc, 'Activity Level', sanitize(dashboardSnapshot.latestMetric.activityLevel));
      row(doc, 'Notes', sanitize(dashboardSnapshot.latestMetric.notes));
    }

    drawWeightChart(doc, weightHistory);

    // ── Medical History ─────────────────────────────────────────────────
    sectionHeader(
      doc,
      `Recent Medical Records (${recentRecords.length} shown of ${filteredRecords.length})`,
    );

    if (recentRecords.length === 0) {
      doc
        .fontSize(9)
        .fillColor('#888888')
        .text('No medical records found for the selected period.');
    } else {
      recentRecords.forEach((record, idx) => {
        // Page break if near bottom
        ensureSpace(doc, 120);

        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(
            `${idx + 1}. ${sanitize(record.type).toUpperCase()} - ${sanitize(record.visitDate)}`,
            {
              underline: true,
            },
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
            .text(`Blockchain verified: ${sanitize(record.blockchainTxHash).slice(0, 20)}...`);
        }
        doc.moveDown(0.4);
      });
    }

    // ── Current Medications ─────────────────────────────────────────────
    sectionHeader(doc, `Active Medications (${activeMeds.length})`);

    if (activeMeds.length === 0) {
      doc.fontSize(9).fillColor('#888888').text('No active medications.');
    } else {
      activeMeds.forEach((med) => {
        ensureSpace(doc, 80);
        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(`- ${sanitize(med.name)}`)
          .moveDown(0.1);
        row(doc, 'Dosage', sanitize(med.dosage));
        row(doc, 'Frequency', sanitize(med.frequency));
        row(doc, 'Start Date', sanitize(med.startDate));
        doc.moveDown(0.3);
      });
    }

    // ── Upcoming Appointments ───────────────────────────────────────────
    sectionHeader(doc, `Upcoming Appointments (${upcomingAppointments.length})`);

    if (upcomingAppointments.length === 0) {
      doc.fontSize(9).fillColor('#888888').text('No upcoming appointments scheduled.');
    } else {
      upcomingAppointments.forEach((appointment) => {
        ensureSpace(doc, 80);
        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(`- ${formatAppointmentType(String(appointment.type))}`)
          .moveDown(0.1);
        row(doc, 'Date', `${formatDate(appointment.date)} ${sanitize(appointment.time)}`);
        row(doc, 'Status', sanitize(appointment.status));
        row(doc, 'Notes', sanitize(appointment.notes));
        doc.moveDown(0.3);
      });
    }

    // ── Blockchain Verification Summary ────────────────────────────────
    sectionHeader(doc, 'Blockchain Verification');
    row(doc, 'Verified Records', String(verifiedRecords.length));
    row(doc, 'Verification URL', qrUrl);
    doc
      .moveDown(0.3)
      .fontSize(8)
      .fillColor('#888888')
      .text('Scan the QR code on the first page to verify this report on the Stellar blockchain.');

    // Watermark on first page (pageAdded fires for subsequent pages only)
    addWatermark();

    doc.end();
  });
}
