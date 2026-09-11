/**
 * Tests for Vaccination Certificate PDF Generator — Issue #417
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';

import {
  generateVaccinationCertificate,
  shareCertificate,
  generateClaimSummaryPdf,
  shareClaimSummary,
  type PetCertificateInfo,
  type ClaimSummaryInfo,
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

  describe('generateClaimSummaryPdf', () => {
    const mockClaim: ClaimSummaryInfo = {
      claimId: 'claim-12345678-abcd',
      policyId: 'pol-999',
      petId: 'pet-123',
      petName: 'Buddy',
      provider: 'trupanion',
      policyNumber: 'TRUPANION-POL123',
      amount: 450.75,
      description: 'Emergency surgery and antibiotics',
      status: 'under_review',
      submittedAt: '2026-03-01T12:00:00.000Z',
      updatedAt: '2026-03-02T15:00:00.000Z',
      attachmentUrls: ['https://example.com/receipt1.pdf', 'https://example.com/invoice2.jpg'],
    };

    it('generates a claim summary text file and saves it', async () => {
      const result = await generateClaimSummaryPdf(mockClaim);

      expect(result.filePath).toContain('claim-summary-claim-12');
      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBeGreaterThan(0);
      expect(result.generatedAt).toBeDefined();
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      const writtenContent: string = mockWriteFile.mock.calls[0][1];
      expect(writtenContent).toContain('PET INSURANCE CLAIM SUMMARY');
      expect(writtenContent).toContain('TRUPANION-POL123');
      expect(writtenContent).toContain('$450.75');
      expect(writtenContent).toContain('Emergency surgery and antibiotics');
      expect(writtenContent).toContain('UNDER REVIEW');
      expect(writtenContent).toContain('https://example.com/receipt1.pdf');
      expect(writtenContent).toContain('https://example.com/invoice2.jpg');
      expect(writtenContent).toContain(result.hash);
    });

    it('handles claim summary without attachments gracefully', async () => {
      const claimWithoutAttachments: ClaimSummaryInfo = {
        ...mockClaim,
        attachmentUrls: [],
      };

      const result = await generateClaimSummaryPdf(claimWithoutAttachments);
      expect(result.filePath).toBeDefined();

      const writtenContent: string = mockWriteFile.mock.calls[0][1];
      expect(writtenContent).toContain('No attachments provided.');
    });

    it('creates QR code for claim verification', async () => {
      await generateClaimSummaryPdf(mockClaim);
      expect(mockQRCode).toHaveBeenCalledWith(
        expect.stringContaining('cocohub.app/claims/claim-12345678-abcd'),
        expect.any(Object),
      );
    });
  });

  describe('shareClaimSummary', () => {
    it('calls Sharing.shareAsync with the file path and claim title', async () => {
      await shareClaimSummary('/mock/documents/claim-summary.txt');
      expect(mockShare).toHaveBeenCalledWith(
        '/mock/documents/claim-summary.txt',
        expect.objectContaining({
          mimeType: 'text/plain',
          dialogTitle: 'Share Claim Summary',
        }),
      );
    });

    it('throws when sharing is not available', async () => {
      mockIsAvailable.mockResolvedValue(false);
      await expect(shareClaimSummary('/mock/claim.txt')).rejects.toThrow(
        'Sharing is not available on this device.',
      );
    });
  });
});
