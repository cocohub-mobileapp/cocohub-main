/**
 * PetHealthMetricsScreen.test.tsx
 *
 * Tests for the wearable data visualization dashboard in PetHealthMetricsScreen.
 *
 * Key testing notes for this Node-environment project:
 * - react-native   → mapped to src/__mocks__/react-native.ts via jest.config.js
 * - React 18 concurrent-mode state updates triggered by useEffect/async code
 *   must be fully flushed inside act(). We use RTLRN's act() for this.
 * - jest.setup.js installs fake timers globally; we switch to real timers
 *   per test to avoid the unawaited-act() cascade.
 */

import React from 'react';
import { act, render, waitFor, fireEvent } from '@testing-library/react-native';

// ─── 1. Explicit factory mocks — hoisted above all imports by Jest ────────────

jest.mock('../../services/wearableService', () => ({
  __esModule: true,
  WEARABLE_PROVIDERS: [
    {
      key: 'fitbark',
      name: 'FitBark',
      description: 'Daily activity and sleep sync',
      supportsOAuth: true,
    },
    {
      key: 'whistle',
      name: 'Whistle',
      description: 'GPS distance and activity sync',
      supportsOAuth: false,
    },
    {
      key: 'mockfit',
      name: 'MockFit',
      description: 'Demo wearable provider',
      supportsOAuth: false,
    },
  ],
  default: {
    getWearableStatus: jest.fn(),
    syncWearable: jest.fn(),
    connectWearable: jest.fn(),
    getHistoricalMetrics: jest.fn(),
    getActivitySummary: jest.fn(),
  },
}));

jest.mock('../../services/healthMetricService', () => ({
  getHealthMetrics: jest.fn().mockResolvedValue([]),
  saveHealthMetric: jest.fn().mockResolvedValue(undefined),
  deleteHealthMetric: jest.fn().mockResolvedValue(undefined),
  activityLevelToScore: jest.fn((level: string) =>
    level === 'low' ? 1 : level === 'moderate' ? 2 : 3,
  ),
}));

jest.mock('../../services/petService', () => ({
  updatePet: jest.fn().mockResolvedValue({}),
  getAllPets: jest.fn().mockResolvedValue([]),
  getPetById: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

jest.mock('../../utils/secureScreen', () => ({
  useSecureScreen: jest.fn(),
}));

jest.mock('../../components/MetricBarChart', () => {
  const React = require('react');
  function MetricBarChartMock({ unit }: { unit?: string }) {
    const { Text } = require('react-native');
    return React.createElement(
      Text,
      { testID: `metric-chart-${unit ?? 'unknown'}` },
      `Chart(${unit})`,
    );
  }
  return { __esModule: true, default: MetricBarChartMock };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

// ─── 2. Import after mocks ────────────────────────────────────────────────────

import PetHealthMetricsScreen from '../PetHealthMetricsScreen';
import wearableService from '../../services/wearableService';
import { updatePet } from '../../services/petService';

const ws = wearableService as jest.Mocked<typeof wearableService>;
const mockUpdatePet = updatePet as jest.MockedFunction<typeof updatePet>;

// ─── 3. Shared fixtures ───────────────────────────────────────────────────────

const HR_DATA = [
  { recorded_at: '2026-06-20T08:00:00Z', value: 72 },
  { recorded_at: '2026-06-21T08:00:00Z', value: 80 },
  { recorded_at: '2026-06-22T08:00:00Z', value: 75 },
  { recorded_at: '2026-06-23T08:00:00Z', value: 90 },
  { recorded_at: '2026-06-24T08:00:00Z', value: 68 },
  { recorded_at: '2026-06-25T08:00:00Z', value: 85 },
  { recorded_at: '2026-06-26T08:00:00Z', value: 78 },
];

const SLEEP_DATA = [
  { recorded_at: '2026-06-20T08:00:00Z', value: 420 },
  { recorded_at: '2026-06-21T08:00:00Z', value: 480 },
  { recorded_at: '2026-06-22T08:00:00Z', value: 390 },
  { recorded_at: '2026-06-23T08:00:00Z', value: 450 },
  { recorded_at: '2026-06-24T08:00:00Z', value: 510 },
  { recorded_at: '2026-06-25T08:00:00Z', value: 400 },
  { recorded_at: '2026-06-26T08:00:00Z', value: 430 },
];

const BASE_PROPS = {
  petId: 'pet-123',
  petName: 'Buddy',
  onBack: jest.fn(),
};

// Render and wait for the initial async useEffect data load to complete.
async function renderAndFlush(ui: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui);
    // Flush the microtask queue so all Promise.all() calls inside useEffect resolve
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

// ─── 4. Tests ─────────────────────────────────────────────────────────────────

describe('PetHealthMetricsScreen — Wearable Dashboard', () => {
  beforeEach(() => {
    // Use real timers so that async state updates settle without the
    // "unawaited act()" warnings caused by jest.useFakeTimers() in jest.setup.js
    jest.useRealTimers();
    jest.clearAllMocks();

    ws.getWearableStatus.mockResolvedValue({ connected: false });
    ws.getHistoricalMetrics.mockResolvedValue([]);
    ws.getActivitySummary.mockResolvedValue([]);
    ws.syncWearable.mockResolvedValue({ imported: 0 });
    ws.connectWearable.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  // ── 4.1 Service calls on mount ──────────────────────────────────────────────

  it('calls all wearable service methods on initial mount', async () => {
    await renderAndFlush(<PetHealthMetricsScreen {...BASE_PROPS} />);

    expect(ws.getWearableStatus).toHaveBeenCalledWith('pet-123');
    expect(ws.getHistoricalMetrics).toHaveBeenCalledWith('pet-123', 'heart_rate');
    expect(ws.getHistoricalMetrics).toHaveBeenCalledWith('pet-123', 'sleep_duration');
    expect(ws.getActivitySummary).toHaveBeenCalledWith('pet-123');
  });

  // ── 4.2 No device — empty state ─────────────────────────────────────────────

  it('renders "No Wearable Connected" empty state when no device is linked', async () => {
    const { getByText } = await renderAndFlush(<PetHealthMetricsScreen {...BASE_PROPS} />);

    expect(getByText('No Wearable Connected')).toBeTruthy();
    expect(getByText('Connect a device to track steps, heart rate, and sleep.')).toBeTruthy();
    expect(getByText('+ Set Up Wearable')).toBeTruthy();
  });

  it('does NOT render wearable chart cards when no device is connected', async () => {
    const { queryByText } = await renderAndFlush(<PetHealthMetricsScreen {...BASE_PROPS} />);

    expect(queryByText('❤️ Heart Rate')).toBeNull();
    expect(queryByText('😴 Sleep Duration')).toBeNull();
  });

  // ── 4.3 Connected device ────────────────────────────────────────────────────

  it('renders provider name and "Just now" sync time when device is connected', async () => {
    ws.getWearableStatus.mockResolvedValue({
      connected: true,
      providerKey: 'mockfit',
      lastSync: new Date().toISOString(),
    });

    const { getByText, getAllByText } = await renderAndFlush(
      <PetHealthMetricsScreen {...BASE_PROPS} />,
    );

    // 'MockFit' may appear once in the provider badge; use getAllByText and check at least one
    expect(getAllByText('MockFit').length).toBeGreaterThan(0);
    expect(getByText('Synced Just now')).toBeTruthy();
  });

  it('renders heart rate and sleep chart cards when device is connected', async () => {
    ws.getWearableStatus.mockResolvedValue({
      connected: true,
      providerKey: 'mockfit',
      lastSync: new Date().toISOString(),
    });
    ws.getHistoricalMetrics.mockImplementation(async (_id, metricType) => {
      if (metricType === 'heart_rate') return HR_DATA;
      if (metricType === 'sleep_duration') return SLEEP_DATA;
      return [];
    });

    const { getByText } = await renderAndFlush(<PetHealthMetricsScreen {...BASE_PROPS} />);

    expect(getByText('❤️ Heart Rate')).toBeTruthy();
    expect(getByText('😴 Sleep Duration')).toBeTruthy();
  });

  // ── 4.4 Sync button ─────────────────────────────────────────────────────────

  it('calls syncWearable and reloads data when Sync button is pressed', async () => {
    ws.getWearableStatus.mockResolvedValue({
      connected: true,
      providerKey: 'mockfit',
      lastSync: new Date(Date.now() - 120_000).toISOString(),
    });
    ws.syncWearable.mockResolvedValue({ imported: 7 });

    const { getByText } = await renderAndFlush(<PetHealthMetricsScreen {...BASE_PROPS} />);

    expect(getByText('↻ Sync')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('↻ Sync'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ws.syncWearable).toHaveBeenCalledWith('pet-123');
    expect(ws.getWearableStatus).toHaveBeenCalledTimes(2);
  });

  // ── 4.5 Connect wearable modal ──────────────────────────────────────────────

  it('opens the connect wearable modal when the CTA is pressed', async () => {
    const { getByText } = await renderAndFlush(<PetHealthMetricsScreen {...BASE_PROPS} />);

    expect(getByText('+ Set Up Wearable')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('+ Set Up Wearable'));
    });

    expect(getByText('Connect Wearable')).toBeTruthy();
  });

  it('calls connectWearable + syncWearable when MockFit is selected', async () => {
    ws.connectWearable.mockResolvedValue(undefined);
    ws.syncWearable.mockResolvedValue({ imported: 7 });
    ws.getWearableStatus
      .mockResolvedValueOnce({ connected: false })
      .mockResolvedValue({ connected: true, providerKey: 'mockfit' });

    const { getByText } = await renderAndFlush(<PetHealthMetricsScreen {...BASE_PROPS} />);

    // Open connect modal
    await act(async () => {
      fireEvent.press(getByText('+ Set Up Wearable'));
    });

    expect(getByText('Connect Wearable')).toBeTruthy();

    // Tap MockFit provider row
    await act(async () => {
      fireEvent.press(getByText('MockFit'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ws.connectWearable).toHaveBeenCalledWith('pet-123', 'mockfit', 'mockfit-token');
    expect(ws.syncWearable).toHaveBeenCalledWith('pet-123', 'mockfit');
  });

  // ── 4.6 Steps progress card ─────────────────────────────────────────────────

  it('displays today step count and step goal', async () => {
    ws.getWearableStatus.mockResolvedValue({
      connected: true,
      providerKey: 'mockfit',
      lastSync: new Date().toISOString(),
    });
    ws.getActivitySummary.mockResolvedValue([{ metric_type: 'steps', avg: '5200', sum: '5200' }]);

    const { getByText } = await renderAndFlush(
      <PetHealthMetricsScreen {...BASE_PROPS} stepGoal={8000} />,
    );

    expect(getByText(/5,200/)).toBeTruthy();
    expect(getByText(/8,000 goal/)).toBeTruthy();
  });

  it('shows "Goal achieved!" banner when steps exceed the goal', async () => {
    ws.getWearableStatus.mockResolvedValue({
      connected: true,
      providerKey: 'mockfit',
      lastSync: new Date().toISOString(),
    });
    ws.getActivitySummary.mockResolvedValue([{ metric_type: 'steps', avg: '9500', sum: '9500' }]);

    const { getByText } = await renderAndFlush(
      <PetHealthMetricsScreen {...BASE_PROPS} stepGoal={8000} />,
    );

    expect(getByText('🎉 Goal achieved!')).toBeTruthy();
  });

  // ── 4.7 Step goal popover ───────────────────────────────────────────────────

  it('opens step goal modal when "Edit goal" is tapped', async () => {
    ws.getWearableStatus.mockResolvedValue({
      connected: true,
      providerKey: 'mockfit',
      lastSync: new Date().toISOString(),
    });

    const { getByText } = await renderAndFlush(
      <PetHealthMetricsScreen {...BASE_PROPS} stepGoal={6000} />,
    );

    expect(getByText('Edit goal')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Edit goal'));
    });

    expect(getByText('Daily Step Goal')).toBeTruthy();
  });

  it('saves a new step goal and persists it via updatePet', async () => {
    ws.getWearableStatus.mockResolvedValue({
      connected: true,
      providerKey: 'mockfit',
      lastSync: new Date().toISOString(),
    });
    mockUpdatePet.mockResolvedValue({} as any);

    const { getByText, getByPlaceholderText, getByTestId } = await renderAndFlush(
      <PetHealthMetricsScreen {...BASE_PROPS} stepGoal={6000} />,
    );

    // Open step goal modal
    await act(async () => {
      fireEvent.press(getByText('Edit goal'));
    });

    expect(getByText('Daily Step Goal')).toBeTruthy();

    // Change the value and flush microtasks so the component rerenders with the new state
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('e.g. 8000'), '10000');
      await Promise.resolve();
      await Promise.resolve();
    });

    // Save and let the async updatePet call resolve
    await act(async () => {
      fireEvent.press(getByTestId('save-step-goal-btn'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpdatePet).toHaveBeenCalledWith('pet-123', {
      metadata: { stepGoal: 10000 },
    });
  });
});
