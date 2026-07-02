/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import apiClient from '../../services/apiClient';
import {
  generateHealthReportPdf,
  generateVaccinationCertificate,
  shareCertificate,
  shareHealthReportPdf,
  type PetCertificateInfo,
} from '../../services/pdfService';
import type { VaccinationReminder } from '../../services/vaccinationService';

const mockWriteFile = FileSystem.writeAsStringAsync as jest.Mock;
const mockIsAvailable = Sharing.isAvailableAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockQRCode = QRCode.toDataURL as jest.Mock;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

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

  describe('generateHealthReportPdf', () => {
    it('downloads and stores a backend-generated PDF report', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="buddy-health-report.pdf"',
          'x-record-count': '3',
        },
      });

      const report = await generateHealthReportPdf('pet-123', 'Buddy');

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/reports/pets/pet-123/health',
        undefined,
        expect.objectContaining({
          responseType: 'arraybuffer',
          headers: expect.objectContaining({ Accept: 'application/pdf, application/json' }),
        }),
      );
      expect(report.filePath).toBe('/mock/documents/buddy-health-report.pdf');
      expect(report.filename).toBe('buddy-health-report.pdf');
      expect(report.recordCount).toBe(3);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/mock/documents/buddy-health-report.pdf',
        expect.any(String),
        expect.objectContaining({ encoding: FileSystem.EncodingType.Base64 }),
      );
    });
  });

  describe('shareHealthReportPdf', () => {
    it('shares the saved PDF via expo-sharing', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="buddy-health-report.pdf"',
        },
      });

      const report = await shareHealthReportPdf('pet-123', 'Buddy');

      expect(report.filePath).toBe('/mock/documents/buddy-health-report.pdf');
      expect(mockShare).toHaveBeenCalledWith(
        '/mock/documents/buddy-health-report.pdf',
        expect.objectContaining({
          mimeType: 'application/pdf',
          dialogTitle: "Share Buddy's Health Report",
        }),
      );
    });
  });
});
