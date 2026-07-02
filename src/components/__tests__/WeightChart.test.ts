import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-svg', () => {
  const React = require('react');

  const host = (name: string) =>
    function MockSvgHost({ children, ...props }: Record<string, unknown>) {
      return React.createElement(name, props, children);
    };

  const Svg = host('Svg');

  return {
    __esModule: true,
    default: Svg,
    Circle: host('Circle'),
    Defs: host('Defs'),
    LinearGradient: host('LinearGradient'),
    Line: host('Line'),
    Path: host('Path'),
    Rect: host('Rect'),
    Stop: host('Stop'),
    Text: host('Text'),
  };
});

jest.mock('../../theme', () => {
  const { lightTheme } = jest.requireActual('../../theme/colors');
  return {
    useAppTheme: () => lightTheme,
  };
});

import WeightChart, {
  buildDataPointAccessibilityLabel,
  buildWeightChartAccessibilityLabel,
} from '../WeightChart';
import { describeWeightTrend, rangeLabel } from '../weightChartAccessibility';

function renderWeightChart(props: React.ComponentProps<typeof WeightChart>): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  const originalConsoleError = console.error;
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) {
      return;
    }
    originalConsoleError(...args);
  });

  try {
    act(() => {
      tree = create(React.createElement(WeightChart, props));
    });
  } finally {
    consoleErrorSpy.mockRestore();
  }

  if (!tree) {
    throw new Error('WeightChart failed to render');
  }

  return tree;
}

describe('WeightChart accessibility helpers', () => {
  const sampleData = [
    { date: '2026-01-01T00:00:00Z', weightKg: 10 },
    { date: '2026-02-01T00:00:00Z', weightKg: 11 },
    { date: '2026-03-01T00:00:00Z', weightKg: 12 },
  ];

  it('builds a chart summary label with pet name, weight, and trend', () => {
    expect(buildWeightChartAccessibilityLabel('Buddy', sampleData, '1M')).toBe(
      'Weight chart for Buddy. Current weight: 12.0 kg. Trend: increasing over the last 30 days.',
    );
  });

  it('describes stable and decreasing trends', () => {
    expect(describeWeightTrend(sampleData)).toBe('increasing');
    expect(
      describeWeightTrend([
        { date: '2026-01-01T00:00:00Z', weightKg: 12 },
        { date: '2026-02-01T00:00:00Z', weightKg: 11.5 },
      ]),
    ).toBe('decreasing');
    expect(
      describeWeightTrend([
        { date: '2026-01-01T00:00:00Z', weightKg: 12 },
        { date: '2026-02-01T00:00:00Z', weightKg: 12.05 },
      ]),
    ).toBe('stable');
  });

  it('labels individual data points for screen readers', () => {
    expect(
      buildDataPointAccessibilityLabel({
        date: '2026-03-01T00:00:00Z',
        weightKg: 12,
        note: 'Post-surgery',
      }),
    ).toContain('12.0 kilograms');
    expect(
      buildDataPointAccessibilityLabel({
        date: '2026-03-01T00:00:00Z',
        weightKg: 12,
        note: 'Post-surgery',
      }),
    ).toContain('Post-surgery');
  });

  it('maps range filters to readable periods', () => {
    expect(rangeLabel('3M')).toBe('the last 3 months');
    expect(rangeLabel('ALL')).toBe('all recorded data');
  });
});

describe('WeightChart rendered accessibility', () => {
  const chartData = [
    { date: '2026-06-20T12:00:00Z', weightKg: 4.2 },
    { date: '2026-06-25T12:00:00Z', weightKg: 4.5, note: 'After checkup' },
  ];

  beforeEach(() => {
    jest.setSystemTime(new Date('2026-07-02T12:00:00Z'));
  });

  it('renders the chart summary with an image role and readable label', () => {
    const chartLabel = buildWeightChartAccessibilityLabel('Mochi', chartData, '3M');
    const tree = renderWeightChart({ data: chartData, petName: 'Mochi' });

    expect(tree.root.findByProps({ accessibilityLabel: chartLabel }).props.accessibilityRole).toBe(
      'image',
    );
  });

  it('labels each plotted data point and exposes selected state', () => {
    const firstPointLabel = buildDataPointAccessibilityLabel(chartData[0]);
    const secondPointLabel = buildDataPointAccessibilityLabel(chartData[1]);
    const tree = renderWeightChart({ data: chartData, petName: 'Mochi' });

    expect(
      tree.root.findByProps({ accessibilityLabel: firstPointLabel }).props.accessibilityRole,
    ).toBe('button');
    expect(
      tree.root.findByProps({ accessibilityLabel: firstPointLabel }).props.accessibilityState,
    ).toEqual({
      selected: false,
    });
    expect(
      tree.root.findByProps({ accessibilityLabel: secondPointLabel }).props.accessibilityRole,
    ).toBe('button');

    act(() => {
      tree.root.findByProps({ accessibilityLabel: firstPointLabel }).props.onPress();
    });

    expect(
      tree.root.findByProps({ accessibilityLabel: firstPointLabel }).props.accessibilityState,
    ).toEqual({
      selected: true,
    });
  });
});
