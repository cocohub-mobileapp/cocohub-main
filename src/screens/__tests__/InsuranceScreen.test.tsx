import React from 'react';
import { Alert } from 'react-native';
import { act, render, fireEvent } from '@testing-library/react-native';

jest.mock('../../services/claimsService', () => ({
  getPolicies: jest.fn(),
  getClaims: jest.fn(),
  connectProvider: jest.fn(),
  submitClaim: jest.fn(),
}));

jest.mock('../../services/pdfService', () => ({
  generateClaimSummaryPdf: jest.fn(),
  shareClaimSummary: jest.fn(),
}));

jest.mock('../../services/documentService', () => ({
  pickDocument: jest.fn(),
}));

import InsuranceScreen from '../InsuranceScreen';
import {
  getPolicies,
  getClaims,
  submitClaim,
  type InsurancePolicy,
  type InsuranceClaim,
} from '../../services/claimsService';
import { generateClaimSummaryPdf } from '../../services/pdfService';
import { pickDocument } from '../../services/documentService';

const mockGetPolicies = getPolicies as jest.Mock;
const mockGetClaims = getClaims as jest.Mock;
const mockSubmitClaim = submitClaim as jest.Mock;
const mockGenerateClaimSummaryPdf = generateClaimSummaryPdf as jest.Mock;
const mockPickDocument = pickDocument as jest.Mock;

const MOCK_POLICIES: InsurancePolicy[] = [
  {
    id: 'pol-101',
    provider: 'trupanion',
    policyNumber: 'TRUP-987654',
    petId: 'pet-1',
    coverageLimit: 10000,
    deductible: 200,
    premium: 50,
    status: 'active',
    expiresAt: '2027-12-31T00:00:00.000Z',
  },
];

const MOCK_CLAIMS: InsuranceClaim[] = [
  {
    id: 'claim-001-xyz',
    policyId: 'pol-101',
    petId: 'pet-1',
    amount: 175.5,
    description: 'Routine blood panel and checkup',
    status: 'under_review',
    attachmentUrls: ['https://example.com/receipt-001.pdf'],
    submittedAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-02T10:00:00.000Z',
  },
  {
    id: 'claim-999-abc',
    policyId: 'pol-101',
    petId: 'pet-1',
    amount: 450.0,
    description: 'Dental cleaning procedure',
    status: 'denied',
    attachmentUrls: [],
    submittedAt: '2026-02-15T10:00:00.000Z',
    updatedAt: '2026-02-18T10:00:00.000Z',
  },
];

async function renderAndFlush(ui: React.ReactElement) {
  let result: any;
  await act(async () => {
    result = render(ui);
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe('InsuranceScreen', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetPolicies.mockResolvedValue(MOCK_POLICIES);
    mockGetClaims.mockResolvedValue(MOCK_CLAIMS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders policies tab with linked policy info', async () => {
    const { getByText } = await renderAndFlush(<InsuranceScreen />);

    expect(getByText('TRUPANION')).toBeTruthy();
    expect(getByText('Policy: TRUP-987654')).toBeTruthy();
    expect(getByText('Coverage: $10,000')).toBeTruthy();
  });

  it('switches to claims tab and renders claims list with status and attachments count', async () => {
    const { getByLabelText, getByText } = await renderAndFlush(<InsuranceScreen />);

    const claimsTab = getByLabelText('Claims tab');
    await act(async () => {
      fireEvent.press(claimsTab);
      await Promise.resolve();
    });

    expect(getByText('#CLAIM-00')).toBeTruthy();
    expect(getByText('Routine blood panel and checkup')).toBeTruthy();
    expect(getByText('Amount: $175.50')).toBeTruthy();
    expect(getByText('Attachments: 1 file(s)')).toBeTruthy();
    expect(getByText('under review')).toBeTruthy();
    expect(getByText('denied')).toBeTruthy();
  });

  it('opens claim detail modal with timeline and handles PDF export', async () => {
    mockGenerateClaimSummaryPdf.mockResolvedValue({
      filePath: '/mock/dir/claim-summary-claim-00-hash123.txt',
      hash: 'hash1234567890abcdef',
      generatedAt: '2026-03-03T12:00:00.000Z',
    });

    const { getByLabelText, getByText } = await renderAndFlush(<InsuranceScreen />);

    await act(async () => {
      fireEvent.press(getByLabelText('Claims tab'));
      await Promise.resolve();
    });

    const claimCard = getByText('Routine blood panel and checkup');
    await act(async () => {
      fireEvent.press(claimCard);
      await Promise.resolve();
    });

    expect(getByText('Status Timeline')).toBeTruthy();
    expect(getByText('Submitted')).toBeTruthy();
    expect(getByText('Under Review')).toBeTruthy();
    expect(getByText('Decision Pending')).toBeTruthy();
    expect(getByText('Expected completion: 3/15/2026')).toBeTruthy();

    const exportBtn = getByLabelText('Export claim summary as PDF');
    await act(async () => {
      fireEvent.press(exportBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGenerateClaimSummaryPdf).toHaveBeenCalledTimes(1);
    expect(mockGenerateClaimSummaryPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: 'claim-001-xyz',
        policyId: 'pol-101',
        amount: 175.5,
        description: 'Routine blood panel and checkup',
        status: 'under_review',
      }),
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Claim Summary Exported',
      expect.stringContaining('hash1234567890ab'),
      expect.any(Array),
    );
  });

  it('submits a new claim with description, amount, and attachments', async () => {
    const newClaim: InsuranceClaim = {
      id: 'claim-003-new',
      policyId: 'pol-101',
      petId: 'pet-1',
      amount: 320.0,
      description: 'Emergency sprain treatment and bandage',
      status: 'submitted',
      attachmentUrls: [
        'https://example.com/clinic-invoice.pdf',
        'xray.png (file:///data/user/0/xray.png)',
      ],
      submittedAt: '2026-03-03T14:00:00.000Z',
      updatedAt: '2026-03-03T14:00:00.000Z',
    };

    mockSubmitClaim.mockResolvedValue(newClaim);
    mockPickDocument.mockResolvedValue({
      uri: 'file:///data/user/0/xray.png',
      name: 'xray.png',
    });

    const { getByLabelText, getByText, getAllByText } = await renderAndFlush(<InsuranceScreen />);

    await act(async () => {
      fireEvent.press(getByLabelText('Claims tab'));
      await Promise.resolve();
    });

    const submitBtn = getByText('+ Submit Claim');
    await act(async () => {
      fireEvent.press(submitBtn);
      await Promise.resolve();
    });

    expect(getAllByText('Submit Claim').length).toBeGreaterThanOrEqual(1);

    const amountInput = getByLabelText('Claim amount');
    await act(async () => {
      fireEvent.changeText(amountInput, '320.00');
    });

    const descInput = getByLabelText('Claim description');
    await act(async () => {
      fireEvent.changeText(descInput, 'Emergency sprain treatment and bandage');
    });

    const urlInput = getByLabelText('Attachment URL input');
    await act(async () => {
      fireEvent.changeText(urlInput, 'https://example.com/clinic-invoice.pdf');
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Add attachment URL'));
    });

    const pickDocBtn = getByLabelText('Select document from device');
    await act(async () => {
      fireEvent.press(pickDocBtn);
      await Promise.resolve();
    });

    expect(mockPickDocument).toHaveBeenCalledTimes(1);

    const submitClaimBtn = getByLabelText('Submit claim button');
    await act(async () => {
      fireEvent.press(submitClaimBtn);
      await Promise.resolve();
    });

    expect(mockSubmitClaim).toHaveBeenCalledWith({
      policyId: 'pol-101',
      petId: 'pet-1',
      amount: 320.0,
      description: 'Emergency sprain treatment and bandage',
      attachmentUrls: [
        'https://example.com/clinic-invoice.pdf',
        'xray.png (file:///data/user/0/xray.png)',
      ],
    });

    expect(Alert.alert).toHaveBeenCalledWith('Claim Submitted', expect.any(String));
  });

  it('validates required fields before submitting claim', async () => {
    const { getByLabelText, getByText } = await renderAndFlush(<InsuranceScreen />);

    await act(async () => {
      fireEvent.press(getByLabelText('Claims tab'));
      await Promise.resolve();
    });

    const submitBtn = getByText('+ Submit Claim');
    await act(async () => {
      fireEvent.press(submitBtn);
      await Promise.resolve();
    });

    const submitClaimBtn = getByLabelText('Submit claim button');
    await act(async () => {
      fireEvent.press(submitClaimBtn);
      await Promise.resolve();
    });

    expect(mockSubmitClaim).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Validation Error',
      'Please enter a valid claim amount greater than $0.00.',
    );
  });
});
