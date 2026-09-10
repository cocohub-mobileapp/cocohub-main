import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';

jest.mock('../../components/HealthScoreChart', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'health-score-chart' }),
  };
});

jest.mock('../../components/SkeletonCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SkeletonCard: () => React.createElement(View, { testID: 'skeleton-card' }),
  };
});

jest.mock('../../components/WeightChart', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onExport }: { onExport?: () => void }) =>
      React.createElement(
        View,
        { testID: 'weight-chart' },
        onExport
          ? React.createElement(
              TouchableOpacity,
              { testID: 'weight-chart-export', onPress: onExport },
              React.createElement(Text, null, 'Export Chart'),
            )
          : null,
      ),
  };
});

jest.mock('../../services/appointmentService', () => ({
  getUpcomingAppointments: jest.fn().mockResolvedValue([
    {
      id: 'a1',
      petId: 'pet-1',
      title: 'Booster Shot',
      type: 'Vaccination',
      date: '2026-07-01',
      time: '10:00 AM',
      status: 'confirmed',
      notes: 'Rabies booster',
    },
  ]),
}));

jest.mock('../../services/medicalRecordService', () => ({
  getMedicalRecords: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'r1',
        petId: 'pet-1',
        type: 'checkup',
        visitDate: '2026-05-01',
        diagnosis: 'Healthy',
        treatment: 'None',
        notes: 'All clear',
        createdAt: '2026-05-01T10:00:00Z',
      },
    ],
  }),
}));

jest.mock('../../services/medicationService', () => ({
  getMedications: jest.fn().mockResolvedValue([
    {
      id: 'm1',
      petId: 'pet-1',
      name: 'Simparica Trio',
      dosage: '1 chewable',
      frequency: 'Monthly',
      startDate: '2026-01-01',
      active: true,
    },
  ]),
  isMedicationActive: jest.fn().mockReturnValue(true),
}));

jest.mock('../../services/healthMetricService', () => ({
  getHealthMetrics: jest.fn().mockResolvedValue([
    {
      id: 'h1',
      petId: 'pet-1',
      weightKg: 25.4,
      recordedAt: '2026-06-01T08:00:00Z',
      activityLevel: 'active',
    },
  ]),
  activityLevelToScore: jest.fn().mockReturnValue(3),
}));

jest.mock('../../services/healthScoringServiceV2', () => ({
  __esModule: true,
  default: {
    computeScore: jest.fn().mockReturnValue({ score: 90, status: 'Optimal' }),
    getScoreHistory: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../services/breedInsightsService', () => ({
  __esModule: true,
  default: {
    getPetWeightRange: jest.fn().mockResolvedValue({ minKg: 20, maxKg: 30 }),
  },
}));

jest.mock('../../services/petService', () => ({
  __esModule: true,
  default: {
    getPetById: jest.fn().mockResolvedValue({
      id: 'pet-1',
      name: 'Milo',
      species: 'dog',
      breed: 'Beagle',
    }),
  },
}));

jest.mock('../../services/pdfService', () => ({
  exportAndShareHealthReport: jest.fn().mockResolvedValue({
    filePath: '/tmp/health-report-pet-1.pdf',
    hash: 'hash1234',
    generatedAt: '2026-06-01T12:00:00Z',
    recordCount: 1,
  }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      surface: '#f9f9f9',
      border: '#e5e7eb',
      text: '#111827',
      textMuted: '#6b7280',
      primary: '#1a56db',
      primaryMuted: '#dbeafe',
      info: '#0284c7',
      infoMuted: '#e0f2fe',
    },
  }),
}));

jest.mock('../../utils/secureScreen', () => ({
  useSecureScreen: jest.fn(),
}));

import PetHealthDashboardScreen from '../PetHealthDashboardScreen';
import { exportAndShareHealthReport } from '../../services/pdfService';

const mockExportAndShare = exportAndShareHealthReport as jest.MockedFunction<
  typeof exportAndShareHealthReport
>;

async function renderAndFlush(ui: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe('PetHealthDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders pet dashboard and PDF export button', async () => {
    const { getByText, getByLabelText } = await renderAndFlush(
      <PetHealthDashboardScreen
        petId="pet-1"
        petName="Milo"
        onBack={jest.fn()}
        onOpenMetrics={jest.fn()}
      />,
    );

    expect(getByText('Milo · Dashboard')).toBeTruthy();
    expect(getByLabelText('Export PDF health report')).toBeTruthy();
  });

  it('triggers exportAndShareHealthReport upon tapping the PDF export button', async () => {
    const { getByLabelText } = await renderAndFlush(
      <PetHealthDashboardScreen
        petId="pet-1"
        petName="Milo"
        onBack={jest.fn()}
        onOpenMetrics={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Export PDF health report'));
    });

    expect(mockExportAndShare).toHaveBeenCalledTimes(1);
    expect(mockExportAndShare).toHaveBeenCalledWith(
      expect.objectContaining({
        petId: 'pet-1',
        petName: 'Milo',
        weightKg: 25.4,
        medications: expect.arrayContaining([
          expect.objectContaining({ name: 'Simparica Trio' }),
        ]),
        appointments: expect.arrayContaining([
          expect.objectContaining({ type: 'Vaccination' }),
        ]),
        records: expect.arrayContaining([
          expect.objectContaining({ diagnosis: 'Healthy' }),
        ]),
      }),
    );
  });

  it('triggers exportAndShareHealthReport when chart export is triggered', async () => {
    const { getByTestId } = await renderAndFlush(
      <PetHealthDashboardScreen
        petId="pet-1"
        petName="Milo"
        onBack={jest.fn()}
        onOpenMetrics={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId('weight-chart-export'));
    });

    expect(mockExportAndShare).toHaveBeenCalledTimes(1);
  });
});
