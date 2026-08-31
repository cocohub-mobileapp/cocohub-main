/**
 * TrustlineScreen.test.tsx
 * Issue #43 — Stellar Trustline Management UI (PETC / VETH / PAWP)
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import * as StellarSdk from '@stellar/stellar-sdk';

import TrustlineScreen from '../TrustlineScreen';
import * as trustlineService from '../../services/trustlineService';
import type { TrustlineState, TrustlineTransaction } from '../../models/Trustline';

// Mock trustlineService
jest.mock('../../services/trustlineService', () => {
  const actual = jest.requireActual('../../services/trustlineService');
  return {
    ...actual,
    loadTrustlineState: jest.fn(),
    addTrustline: jest.fn(),
    removeTrustline: jest.fn(),
    loadTrustlineHistory: jest.fn(),
    getEarnedBalances: jest.fn(),
  };
});

describe('TrustlineScreen', () => {
  const mockOnBack = jest.fn();
  const testKp = StellarSdk.Keypair.random();
  const mockPublicKey = testKp.publicKey();
  const mockSecretKey = testKp.secret();

  const mockState: TrustlineState = {
    accountPublicKey: mockPublicKey,
    xlmBalance: '100.00',
    totalReservedXlm: 2.5,
    availableXlm: '97.50',
    trustlines: [
      {
        assetCode: 'PETC',
        issuerPublicKey: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '500.00',
        limit: '922337203685.4775807',
        isCocohubAsset: true,
      },
    ],
  };

  const mockEarned = {
    PETC: '25.00',
    VETH: '10.00',
    PAWP: '150.00',
  };

  const mockHistory: TrustlineTransaction[] = [
    {
      id: 'tx-1',
      type: 'add_trustline',
      assetCode: 'PETC',
      issuerPublicKey: mockPublicKey,
      txHash: 'a1b2c3d4e5f6g7h8i9j0',
      createdAt: '2026-08-30T10:00:00Z',
      successful: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (trustlineService.loadTrustlineState as jest.Mock).mockResolvedValue(mockState);
    (trustlineService.getEarnedBalances as jest.Mock).mockResolvedValue(mockEarned);
    (trustlineService.loadTrustlineHistory as jest.Mock).mockResolvedValue(mockHistory);
    (trustlineService.addTrustline as jest.Mock).mockResolvedValue('mock-add-tx-hash-123456');
    (trustlineService.removeTrustline as jest.Mock).mockResolvedValue('mock-remove-tx-hash-123456');
    jest.spyOn(Alert, 'alert');
  });

  it('renders connect screen initially with testnet mode banner', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<TrustlineScreen onBack={mockOnBack} />);
    });

    const texts = tree.root.findAllByType('Text').map((t: any) => t.props.children);
    const joined = texts.flat().join(' ');
    expect(joined).toContain('Connect Stellar Account');
    expect(joined).toContain('Stellar Testnet Mode');
  });

  it('renders Cocohub tokens dashboard (PETC, VETH, PAWP) when connected with initialSecretKey', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <TrustlineScreen onBack={mockOnBack} initialSecretKey={mockSecretKey} />,
      );
    });

    const allTexts = tree.root
      .findAllByType('Text')
      .map((t: any) => t.props.children)
      .flat()
      .join(' ');

    expect(allTexts).toContain('PETC');
    expect(allTexts).toContain('VETH');
    expect(allTexts).toContain('PAWP');
    expect(allTexts).toContain('Cocohub Ecosystem Tokens');
    expect(allTexts).toContain('Wallet Balance');
    expect(allTexts).toContain('Earned (Backend)');
    expect(allTexts).toContain('500.00'); // PETC wallet balance
    expect(allTexts).toContain('25.00'); // PETC earned
    expect(allTexts).toContain('10.00'); // VETH earned
    expect(allTexts).toContain('150.00'); // PAWP earned
  });

  it('calls onBack when back button is pressed', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<TrustlineScreen onBack={mockOnBack} />);
    });

    const touchables = tree.root.findAllByType('TouchableOpacity');
    const backBtn = touchables.find((t: any) => t.props.accessibilityLabel === 'Back');

    await act(async () => {
      backBtn.props.onPress();
    });

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to Add Custom Trustline form and displays input fields', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <TrustlineScreen onBack={mockOnBack} initialSecretKey={mockSecretKey} />,
      );
    });

    // Click + Custom button in header
    const touchables = tree.root.findAllByType('TouchableOpacity');
    const customAddBtn = touchables.find((t: any) =>
      t.findAllByType('Text').some((txt: any) => txt.props.children === '+ Custom'),
    );
    expect(customAddBtn).toBeDefined();

    await act(async () => {
      customAddBtn.props.onPress();
    });

    const allTexts = tree.root
      .findAllByType('Text')
      .map((t: any) => t.props.children)
      .flat()
      .join(' ');

    expect(allTexts).toContain('Add Trustline');
    expect(allTexts).toContain('XLM Reserve Required');
    expect(allTexts).toContain('Cocohub Assets');
    expect(allTexts).toContain('Custom Asset');
  });

  it('switches to history view and renders transactions', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <TrustlineScreen onBack={mockOnBack} initialSecretKey={mockSecretKey} />,
      );
    });

    // Click History ->
    const historyBtn = tree.root
      .findAllByType('TouchableOpacity')
      .find((t: any) =>
        t.findAllByType('Text').some((txt: any) => txt.props.children === 'History →'),
      );
    expect(historyBtn).toBeDefined();

    await act(async () => {
      historyBtn.props.onPress();
    });

    const allTexts = tree.root
      .findAllByType('Text')
      .map((t: any) => t.props.children)
      .flat()
      .join(' ');

    expect(allTexts).toContain('Transaction History');
    expect(trustlineService.loadTrustlineHistory).toHaveBeenCalled();
  });
});
