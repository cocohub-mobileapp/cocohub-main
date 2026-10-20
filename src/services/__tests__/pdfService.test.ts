/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import {
  generateVaccinationCertificate,
  shareCertificate,
  generateVetHealthReport,
  shareHealthReport,
  type PetCertificateInfo,
  type VetHealthReportData,
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
  describe('generateVetHealthReport (#45)', () => {
    const mockReportData: VetHealthReportData = {
      pet: {
        id: 'pet-999',
        name: 'Milo',
        species: 'Feline',
        breed: 'Siamese',
        weight: 4.5,
        weightUnit: 'kg',
      },
      owner: {
        name: 'Alice',
        contact: 'alice@example.com',
      },
      healthScore: 92,
      weightHistory: [
        { date: '2026-09-01', weight: 4.3 },
        { date: '2026-10-01', weight: 4.5 },
      ],
      activeMedications: [{ name: 'Amoxicillin', dosage: '50mg', frequency: 'Twice daily' }],
      upcomingAppointments: [{ date: '2026-11-15', vetName: 'Dr. Johnson', reason: 'Annual Checkup' }],
      recentRecords: [{ date: '2026-08-10', title: 'Ear cleaning', diagnosis: 'Minor wax buildup' }],
    };

    it('generates clinical vet report document with all sections', async () => {
      const rep = await generateVetHealthReport(mockReportData);
      expect(rep.filePath).toContain('vet-health-report-pet-999');
      expect(rep.hash).toBeDefined();

      const content: string = mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1][1];
      expect(content).toContain('COCOHUB CLINICAL VET HEALTH REPORT');
      expect(content).toContain('Milo (ID: pet-999)');
      expect(content).toContain('Amoxicillin (50mg - Twice daily)');
      expect(content).toContain('Annual Checkup (Dr. Johnson)');
      expect(content).toContain('Ear cleaning');
      expect(content).toContain('Score:        92 / 100');
    });

    it('shares vet report via native sharing sheet', async () => {
      await shareHealthReport('/mock/vet-report.pdf');
      expect(mockShare).toHaveBeenCalledWith(
        '/mock/vet-report.pdf',
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
    });
  });
});
