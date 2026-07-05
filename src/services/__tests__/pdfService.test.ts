/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import {
  generateHealthDashboardReport,
  generateVaccinationCertificate,
  shareHealthReport,
  shareCertificate,
  type HealthDashboardReportData,
  type PetCertificateInfo,
} from '../../services/pdfService';
import type { VaccinationReminder } from '../../services/vaccinationService';

const mockWriteFile = FileSystem.writeAsStringAsync as jest.Mock;
const mockIsAvailable = Sharing.isAvailableAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockQRCode = QRCode.toDataURL as jest.Mock;

const mockPet: PetCertificateInfo = {
  petId: 'pet-123',
  petName: 'Buddy',
  species: 'dog',
  breed: 'Labrador',
  dateOfBirth: '2020-01-15',
  ownerName: 'Jane Doe',
  ownerContact: 'jane@example.com',
  vetName: 'Dr. Smith',
  vetClinic: 'Happy Paws Clinic',
};

const mockVaccinations: VaccinationReminder[] = [
  {
    id: 'v1',
    scheduleId: 's1',
    petId: 'pet-123',
    vaccineName: 'Rabies',
    dueDate: '2026-06-01',
    status: 'administered',
    reminderDates: [],
    lastAdministeredDate: '2025-06-01',
    veterinaryVerification: {
      vetId: 'vet-001',
      blockchainTxHash: 'abc123def456',
      verifiedAt: '2025-06-01T10:00:00Z',
    },
    schedule: {
      id: 's1',
      species: 'dog',
      vaccineName: 'Rabies',
      diseaseCoverage: ['Rabies'],
      dueAgeWeeks: 12,
      minimumAgeWeeks: 12,
      boosterIntervalMonths: 12,
      core: true,
      notes: 'Required by law',
    },
  },
  {
    id: 'v2',
    scheduleId: 's2',
    petId: 'pet-123',
    vaccineName: 'DHPP',
    dueDate: '2026-07-01',
    status: 'upcoming',
    reminderDates: [],
    schedule: {
      id: 's2',
      species: 'dog',
      vaccineName: 'DHPP',
      diseaseCoverage: ['Distemper', 'Parvovirus'],
      dueAgeWeeks: 8,
      minimumAgeWeeks: 6,
      core: true,
      notes: 'Core vaccine',
    },
  },
];

const mockHealthReport: HealthDashboardReportData = {
  pet: {
    petId: 'pet-123',
    petName: 'Buddy',
  },
  healthScore: 86,
  latestMetric: {
    recordedAt: '2026-06-20T12:00:00Z',
    weightKg: 27.4,
    temperatureC: 38.4,
    activityLevel: 'high',
    notes: 'Normal energy',
  },
  weightHistory: [
    {
      recordedAt: '2026-06-20T12:00:00Z',
      weightKg: 27.4,
    },
    {
      recordedAt: '2026-06-01T12:00:00Z',
      weightKg: 27.1,
    },
  ],
  activeMedications: [
    {
      name: 'Carprofen',
      dosage: '25mg',
      endDate: '2026-07-01',
    },
  ],
  upcomingAppointments: [
    {
      date: '2026-07-10',
      time: '09:30',
      type: 'wellness_check',
      status: 'scheduled',
      vetName: 'Dr. Smith',
    },
  ],
  recentRecords: [
    {
      type: 'treatment',
      createdAt: '2026-06-15T09:00:00Z',
      notes: 'Follow-up complete',
    },
  ],
  generatedAt: '2026-06-21T08:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWriteFile.mockResolvedValue(undefined);
  mockIsAvailable.mockResolvedValue(true);
  mockShare.mockResolvedValue(undefined);
  mockQRCode.mockResolvedValue('data:image/png;base64,mockqr');
});

describe('pdfService — Vaccination Certificate PDF Generator (Issue #417)', () => {
  describe('generateVaccinationCertificate', () => {
    it('generates a certificate and writes it to the filesystem', async () => {
      const cert = await generateVaccinationCertificate(mockPet, mockVaccinations);

      expect(cert.filePath).toContain('vaccination-certificate-pet-123');
      expect(cert.hash).toBeDefined();
      expect(cert.hash.length).toBeGreaterThan(0);
      expect(cert.generatedAt).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('includes pet info in the certificate content', async () => {
      await generateVaccinationCertificate(mockPet, mockVaccinations);

      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('Buddy');
      expect(content).toContain('pet-123');
      expect(content).toContain('Jane Doe');
      expect(content).toContain('Dr. Smith');
    });

    it('includes only administered vaccinations', async () => {
      await generateVaccinationCertificate(mockPet, mockVaccinations);

      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('Rabies');
      expect(content).toContain('abc123def456'); // blockchain tx hash
    });

    it('includes blockchain verification section', async () => {
      await generateVaccinationCertificate(mockPet, mockVaccinations);

      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('BLOCKCHAIN VERIFICATION');
      expect(content).toContain('cocohub.app/verify/');
    });

    it('generates a QR code', async () => {
      await generateVaccinationCertificate(mockPet, mockVaccinations);
      expect(mockQRCode).toHaveBeenCalledWith(
        expect.stringContaining('cocohub.app/verify/'),
        expect.any(Object),
      );
    });

    it('handles empty vaccination list gracefully', async () => {
      const cert = await generateVaccinationCertificate(mockPet, []);
      expect(cert.filePath).toBeDefined();
      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('No administered vaccinations on record.');
    });

    it('produces unique hashes for different pets', async () => {
      const cert1 = await generateVaccinationCertificate(mockPet, mockVaccinations);
      const pet2 = { ...mockPet, petId: 'pet-456', petName: 'Max' };
      const cert2 = await generateVaccinationCertificate(pet2, mockVaccinations);
      expect(cert1.hash).not.toBe(cert2.hash);
    });
  });

  describe('shareCertificate', () => {
    it('calls Sharing.shareAsync with the file path', async () => {
      await shareCertificate('/mock/documents/cert.txt');
      expect(mockShare).toHaveBeenCalledWith(
        '/mock/documents/cert.txt',
        expect.objectContaining({ mimeType: 'text/plain' }),
      );
    });

    it('throws when sharing is not available', async () => {
      mockIsAvailable.mockResolvedValue(false);
      await expect(shareCertificate('/mock/cert.txt')).rejects.toThrow(
        'Sharing is not available on this device.',
      );
    });
  });

  describe('generateHealthDashboardReport', () => {
    it('generates a PDF health dashboard report and writes it to the filesystem', async () => {
      const report = await generateHealthDashboardReport(mockHealthReport);

      expect(report.filePath).toContain('health-report-pet-123');
      expect(report.filePath).toContain('.pdf');
      expect(report.hash).toBeDefined();
      expect(report.generatedAt).toBe('2026-06-21T08:00:00Z');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('writes valid PDF content with health dashboard sections', async () => {
      await generateHealthDashboardReport(mockHealthReport);

      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content.startsWith('%PDF-1.4')).toBe(true);
      expect(content).toContain('Buddy Health Report');
      expect(content).toContain('Health Summary');
      expect(content).toContain('Weight History');
      expect(content).toContain('Active Medications');
      expect(content).toContain('Upcoming Appointments');
      expect(content).toContain('Recent Medical Records');
    });

    it('shares health reports as application/pdf', async () => {
      await shareHealthReport('/mock/documents/health-report.pdf');

      expect(mockShare).toHaveBeenCalledWith(
        '/mock/documents/health-report.pdf',
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
    });
  });
});
