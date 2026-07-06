/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import { AppointmentStatus, AppointmentType } from '../../models/Appointment';
import {
  generateHealthMetricsReport,
  generateVaccinationCertificate,
  shareCertificate,
  shareHealthMetricsReport,
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

  describe('generateHealthMetricsReport', () => {
    it('generates a vet-ready health metrics report with dashboard data', async () => {
      const report = await generateHealthMetricsReport({
        pet: {
          id: 'pet-123',
          name: 'Buddy',
          species: 'dog',
          breed: 'Labrador',
          dateOfBirth: '2020-01-15',
          weightKg: 28,
          microchipId: 'chip-1',
        },
        healthScore: 87,
        latestMetric: {
          id: 'metric-1',
          petId: 'pet-123',
          recordedAt: '2026-07-01T12:00:00Z',
          weightKg: 28.4,
          temperatureC: 38.5,
          activityLevel: 'high',
          notes: 'Doing well',
        },
        weightHistory: [{ date: '2026-07-01T12:00:00Z', weightKg: 28.4 }],
        activeMedications: [
          {
            id: 'med-1',
            petId: 'pet-123',
            name: 'Carprofen',
            dosage: '25 mg',
            frequency: 12,
            startDate: '2026-06-01',
          },
        ],
        upcomingAppointments: [
          {
            id: 'appt-1',
            petId: 'pet-123',
            vetId: 'vet-1',
            date: '2026-07-15',
            time: '09:30',
            type: AppointmentType.ROUTINE_CHECKUP,
            status: AppointmentStatus.CONFIRMED,
            createdAt: '2026-07-01T00:00:00Z',
            updatedAt: '2026-07-01T00:00:00Z',
          },
        ],
        recentRecords: [
          {
            id: 'rec-1',
            petId: 'pet-123',
            type: 'treatment',
            date: '2026-06-20',
            veterinarian: 'Dr. Smith',
            notes: 'Follow-up exam',
            createdAt: '2026-06-20T00:00:00Z',
          },
        ],
      });

      expect(report.filePath).toContain('health-metrics-report-pet-123');
      const content: string = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('COCOHUB VET-READY HEALTH METRICS REPORT');
      expect(content).toContain('Buddy');
      expect(content).toContain('Health Score: 87/100');
      expect(content).toContain('Carprofen');
      expect(content).toContain('ROUTINE CHECKUP');
      expect(content).toContain('Follow-up exam');
    });
  });

  describe('shareHealthMetricsReport', () => {
    it('shares the report as a PDF', async () => {
      await shareHealthMetricsReport('/mock/documents/health-report.pdf');
      expect(mockShare).toHaveBeenCalledWith(
        '/mock/documents/health-report.pdf',
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
    });
  });
});
