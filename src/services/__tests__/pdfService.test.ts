/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import {
  generateVaccinationCertificate,
  shareCertificate,
  generateHealthReport,
  shareHealthReport,
  type PetCertificateInfo,
  type PetHealthReportData,
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

  describe('generateHealthReport (Issue #45)', () => {
    const mockHealthData: PetHealthReportData = {
      pet: mockPet,
      healthScore: 88,
      latestMetrics: {
        weightKg: 14.5,
        temperatureC: 38.6,
        activityLevel: 'high',
        recordedAt: '2026-06-15T09:00:00Z',
      },
      weightHistory: [
        { date: '2026-06-15', weightKg: 14.5, note: 'Normal' },
        { date: '2026-05-15', weightKg: 14.2 },
      ],
      activeMedications: [{ name: 'Heartgard Plus', dosage: '1 chewable', frequency: 'Monthly' }],
      upcomingAppointments: [
        { date: '2026-07-01', title: 'Annual Checkup', vetName: 'Smith', clinicName: 'Happy Paws' },
      ],
      recentRecords: [
        { date: '2026-06-01', type: 'examination', title: 'Wellness exam', notes: 'All clear' },
      ],
    };

    it('generates a vet-ready health report file', async () => {
      const report = await generateHealthReport(mockHealthData);
      expect(report.filePath).toBeDefined();
      expect(report.hash).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('includes patient info, clinical score, vitals, meds, and appointments in report content', async () => {
      await generateHealthReport(mockHealthData);
      const content: string = mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1][1];
      expect(content).toContain('COCOHUB VETERINARY HEALTH SUMMARY REPORT');
      expect(content).toContain('Buddy');
      expect(content).toContain('88/100');
      expect(content).toContain('14.5 kg');
      expect(content).toContain('Heartgard Plus');
      expect(content).toContain('Annual Checkup');
      expect(content).toContain('Wellness exam');
    });

    it('handles minimal/empty health metrics gracefully', async () => {
      const minimalData: PetHealthReportData = {
        pet: mockPet,
      };
      const report = await generateHealthReport(minimalData);
      expect(report.filePath).toBeDefined();
      const content: string = mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1][1];
      expect(content).toContain('Overall Health Score: Not evaluated');
      expect(content).toContain('No active medications on record.');
    });

    it('shares health report via shareHealthReport', async () => {
      mockIsAvailable.mockResolvedValue(true);
      await shareHealthReport('/mock/documents/report.txt');
      expect(mockShare).toHaveBeenCalledWith(
        '/mock/documents/report.txt',
        expect.objectContaining({ dialogTitle: 'Share Vet-Ready Health Report' }),
      );
    });
  });
});
