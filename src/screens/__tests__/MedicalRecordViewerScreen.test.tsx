import React from 'react';
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
  type ReactTestRendererNode,
} from 'react-test-renderer';

import { ThemeProvider } from '../../context/ThemeContext';
import { requireBiometric, verifyPin } from '../../services/authService';
import { getMedicalRecords, searchMedicalRecords } from '../../services/medicalRecordService';
import MedicalRecordViewerScreen from '../MedicalRecordViewerScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: ({ name }: { name: string }) => React.createElement('Icon', { name }),
  };
});

jest.mock('../../context/ThemeContext', () => {
  const React = require('react');
  return {
    ThemeProvider: ({ children }: React.PropsWithChildren<unknown>) =>
      React.createElement(React.Fragment, null, children),
    useTheme: () => ({
      colors: {
        placeholder: '#9CA3AF',
        primary: '#10B981',
        secondaryText: '#6B7280',
        text: '#111827',
      },
    }),
  };
});

jest.mock('../../services/authService', () => ({
  requireBiometric: jest.fn(),
  verifyPin: jest.fn(),
}));

jest.mock('../../services/medicalRecordService', () => ({
  getMedicalRecords: jest.fn(),
  searchMedicalRecords: jest.fn(),
}));

jest.mock('../../services/sessionMonitoringService', () => ({
  setLastBiometricCheck: jest.fn(() => Promise.resolve()),
}));

const mockRequireBiometric = requireBiometric as jest.MockedFunction<typeof requireBiometric>;
const mockVerifyPin = verifyPin as jest.MockedFunction<typeof verifyPin>;
const mockGetMedicalRecords = getMedicalRecords as jest.MockedFunction<typeof getMedicalRecords>;
const mockSearchMedicalRecords = searchMedicalRecords as jest.MockedFunction<
  typeof searchMedicalRecords
>;
const originalConsoleError = console.error;

const flushPromises = async (times = 3) => {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const collectText = (
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | ReactTestRendererNode | null,
): string[] => {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return node.children?.flatMap(collectText) ?? [];
};

describe('MedicalRecordViewerScreen', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) {
        return;
      }
      originalConsoleError(...args);
    });
    mockRequireBiometric.mockResolvedValue('authenticated');
    mockVerifyPin.mockResolvedValue(true);
    mockSearchMedicalRecords.mockResolvedValue([]);
    mockGetMedicalRecords.mockResolvedValue({
      data: {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      },
    } as Awaited<ReturnType<typeof getMedicalRecords>>);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows a polished empty state when a pet has no medical records', async () => {
    let renderer: ReactTestRenderer | undefined;

    await act(async () => {
      renderer = create(
        <ThemeProvider>
          <MedicalRecordViewerScreen petId="pet-1" petName="Milo" onBack={jest.fn()} />
        </ThemeProvider>,
      );
    });

    await flushPromises();

    const renderedText = collectText(renderer?.toJSON() ?? null);

    expect(renderedText).toContain('No medical records yet');
    expect(renderedText).toContain(
      "Milo doesn't have any medical records yet. Refresh to check for newly synced vaccinations, treatments, or diagnoses.",
    );
    expect(renderedText).toContain('Refresh records');
    expect(renderedText).not.toContain('No records found.');
  });
});
