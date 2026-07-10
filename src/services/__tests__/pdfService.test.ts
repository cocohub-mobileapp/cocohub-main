/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import apiClient from '../../services/apiClient';
import { getToken } from '../../services/authService';
import {
  generateHealthDashboardReport,
  generateVaccinationCertificate,
  shareHealthDashboardReport,
  shareCertificate,
  type HealthDashboardReportPayload,
  type PetCertificateInfo,
} from '../../services/pdfService';
import type { VaccinationReminder } from '../../services/vaccinationService';

jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    api: {
      baseUrl: 'https://api.test/api',
      timeoutMs: 1000,
    },
  },
}));

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../../services/authService', () => ({
  getToken: jest.fn(),
}));

const mockWriteFile = FileSystem.writeAsStringAsync as jest.Mock;
const mockDownload = FileSystem.downloadAsync as jest.Mock;
const mockIsAvailable = Sharing.isAvailableAsync as jest.Mock;
const mockShare = Sharing.shareAsync as jest.Mock;
const mockQRCode = QRCode.toDataURL as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockGet = apiClient.get as jest.Mock;
const mockGetToken = getToken as jest.Mock;

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
  mockDownload.mockResolvedValue({ uri: '/mock/cache/report.pdf', status: 200 });
  mockIsAvailable.mockResolvedValue(true);
  mockShare.mockResolvedValue(undefined);
  mockQRCode.mockResolvedValue('data:image/png;base64,mockqr');
  mockPost.mockReset();
  mockGet.mockReset();
  mockGetToken.mockResolvedValue('jwt-token');
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
    const payload: HealthDashboardReportPayload = {
      petId: 'pet-123',
      petName: 'Buddy',
      healthScore: 87,
      healthScoreLabel: 'Excellent',
      latestMetric: {
        recordedAt: '2026-07-09T10:00:00.000Z',
        weightKg: 12.4,
        temperatureC: 38.6,
        activityLevel: 'high',
        notes: 'Bright and active',
      },
      weightHistory: [
        { date: '2026-07-01', weightKg: 12.1 },
        { date: '2026-07-08', weightKg: 12.4, note: 'Healthy gain' },
      ],
      activeMedications: [
        {
          id: 'm-1',
          name: 'HeartGuard',
          dosage: '1 tablet',
          frequency: 'monthly',
          startDate: '2026-01-01',
        },
      ],
      upcomingAppointments: [
        {
          id: 'a-1',
          date: '2026-07-20',
          time: '09:00',
          type: 'Wellness',
          status: 'scheduled',
        },
      ],
      recentRecords: [
        {
          id: 'r-1',
          type: 'checkup',
          date: '2026-07-08',
          notes: 'Routine wellness visit',
        },
      ],
    };

    it('creates, polls, downloads, and returns a shareable PDF report', async () => {
      mockPost.mockResolvedValue({ data: { jobId: 'job-1' } });
      mockGet.mockResolvedValue({
        data: {
          jobId: 'job-1',
          status: 'complete',
          filename: 'buddy-health-report.pdf',
          recordCount: 3,
        },
      });

      const report = await generateHealthDashboardReport(payload);

      expect(mockPost).toHaveBeenCalledWith('/reports/pets/pet-123/health', {
        dashboard: payload,
      });
      expect(mockGet).toHaveBeenCalledWith('/reports/job-1/status');
      expect(mockDownload).toHaveBeenCalledWith(
        'https://api.test/api/reports/job-1/download',
        '/mock/cache/buddy-health-report.pdf',
        { headers: { Authorization: 'Bearer jwt-token' } },
      );
      expect(report).toEqual({
        filePath: '/mock/cache/buddy-health-report.pdf',
        filename: 'buddy-health-report.pdf',
        jobId: 'job-1',
        recordCount: 3,
      });
    });

    it('fails when the report service does not return a job id', async () => {
      mockPost.mockResolvedValue({ data: {} });
      await expect(generateHealthDashboardReport(payload)).rejects.toThrow(
        'The report service did not return a job id.',
      );
    });

    it('shares generated health dashboard reports as PDF files', async () => {
      await shareHealthDashboardReport('/mock/cache/buddy-health-report.pdf');
      expect(mockShare).toHaveBeenCalledWith(
        '/mock/cache/buddy-health-report.pdf',
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
    });
  });
});
