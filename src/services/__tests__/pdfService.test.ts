/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import {
  generateVaccinationCertificate,
  shareCertificate,
  generateHealthReportPdf,
  shareHealthReport,
  exportAndShareHealthReport,
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

  describe('Health Report PDF Generator (Issue #45)', () => {
    const mockHealthData: PetHealthReportData = {
      petId: 'pet-123',
      petName: 'Buddy',
      species: 'dog',
      breed: 'Golden Retriever',
      dateOfBirth: '2021-04-10',
      microchipId: '985141002345678',
      weightKg: 30.5,
      ownerName: 'Jane Doe',
      ownerEmail: 'jane@example.com',
      ownerPhone: '+1-555-0199',
      healthScore: 92,
      healthStatus: 'Optimal',
      weightHistory: [
        { date: '2024-05-01', weightKg: 30.5, note: 'Stable' },
        { date: '2024-04-01', weightKg: 29.8, note: 'Routine' },
      ],
      medications: [
        {
          id: 'm1',
          name: 'Heartgard Plus',
          dosage: '1 chewable',
          frequency: 'Monthly',
          startDate: '2024-01-01',
          active: true,
        },
      ],
      appointments: [
        {
          id: 'a1',
          type: 'Annual Wellness Exam',
          date: '2024-11-15',
          time: '10:30 AM',
          status: 'Confirmed',
          notes: 'Bring stool sample',
          vetName: 'Dr. Johnson',
        },
      ],
      records: [
        {
          id: 'r1',
          type: 'Vaccination',
          visitDate: '2024-05-01',
          diagnosis: 'Healthy canine',
          treatment: 'DHPP booster administered',
          notes: 'No adverse reaction',
          blockchainTxHash: 'stellar-tx-hash-12345',
        },
      ],
      clinicName: 'Metro Animal Hospital',
    };

    beforeEach(() => {
      mockWriteFile.mockClear();
      mockShare.mockClear();
      mockIsAvailable.mockResolvedValue(true);
    });

    it('generates health report file with complete content', async () => {
      const report = await generateHealthReportPdf(mockHealthData);

      expect(report.filePath).toBeDefined();
      expect(report.filePath).toContain('health-report-pet-123-');
      expect(report.hash).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('VETERINARY HEALTH REPORT');
      expect(content).toContain('Buddy');
      expect(content).toContain('Golden Retriever');
      expect(content).toContain('30.5 kg');
      expect(content).toContain('985141002345678');
      expect(content).toContain('92 / 100');
      expect(content).toContain('Optimal');
      expect(content).toContain('Heartgard Plus');
      expect(content).toContain('Annual Wellness Exam');
      expect(content).toContain('DHPP booster');
      expect(content).toContain('stellar-tx-hash-12345');
      expect(content).toContain('Metro Animal Hospital');
      expect(content).toContain('VETERINARY ASSESSMENT & SIGN-OFF');
    });

    it('handles minimal health report data gracefully', async () => {
      const minimalData: PetHealthReportData = {
        petId: 'pet-456',
        petName: 'Luna',
      };

      const report = await generateHealthReportPdf(minimalData);
      expect(report.filePath).toBeDefined();

      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('Luna');
      expect(content).toContain('No recorded weight entries.');
      expect(content).toContain('No active medications on record.');
      expect(content).toContain('No upcoming appointments scheduled.');
      expect(content).toContain('No medical records on file for this period.');
    });

    it('shares health report via Sharing.shareAsync with PDF mimeType', async () => {
      await shareHealthReport('/path/to/health-report.pdf', 'Buddy');

      expect(mockShare).toHaveBeenCalledWith(
        '/path/to/health-report.pdf',
        expect.objectContaining({
          mimeType: 'application/pdf',
          dialogTitle: "Share Buddy's Health Report",
        }),
      );
    });

    it('throws error when sharing health report if sharing unavailable', async () => {
      mockIsAvailable.mockResolvedValue(false);

      await expect(
        shareHealthReport('/path/to/health-report.pdf', 'Buddy'),
      ).rejects.toThrow('Sharing is not available on this device.');
    });

    it('exports and shares health report in a single invocation', async () => {
      const report = await exportAndShareHealthReport(mockHealthData);

      expect(report.filePath).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockShare).toHaveBeenCalledWith(
        report.filePath,
        expect.objectContaining({
          mimeType: 'application/pdf',
        }),
      );
    });
  });
});

