import { render } from '@testing-library/react-native';
import React from 'react';

import WeightChart from '../WeightChart';
import {
  buildDataPointAccessibilityLabel,
  buildWeightChartAccessibilityLabel,
  describeWeightTrend,
  rangeLabel,
} from '../weightChartAccessibility';

jest.mock('../../theme', () => ({
  useAppTheme: () => ({
    card: '#ffffff',
    cardElevated: '#ffffff',
    chartAnnotation: '#f59e0b',
    chartAxis: '#64748b',
    chartGrid: '#e2e8f0',
    chartLine: '#2563eb',
    chartRangeFill: '#dbeafe',
    info: '#2563eb',
    infoMuted: '#dbeafe',
    muted: '#e2e8f0',
    placeholder: '#94a3b8',
    primary: '#2563eb',
    secondaryText: '#475569',
    shadow: '#000000',
    text: '#0f172a',
    warning: '#d97706',
  }),
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const host = (name: string) =>
    function MockSvgComponent({ children, ...props }: Record<string, unknown>) {
      return React.createElement(name, props, children);
    };

  return {
    __esModule: true,
    default: host('Svg'),
    Circle: host('Circle'),
    Defs: host('Defs'),
    LinearGradient: host('LinearGradient'),
    Line: host('Line'),
    Path: host('Path'),
    Rect: host('Rect'),
    Stop: host('Stop'),
    Text: host('SvgText'),
  };
});

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

describe('WeightChart accessibility rendering', () => {
  const recentData = [
    { date: '2026-06-10T00:00:00Z', weightKg: 4.1 },
    { date: '2026-06-24T00:00:00Z', weightKg: 4.3, note: 'Post checkup' },
  ];

  it('renders a chart summary role and accessible markers for each data point', () => {
    const { UNSAFE_getAllByType } = render(
      React.createElement(WeightChart, { data: recentData, petName: 'Milo' }),
    );

    const chartSummary = UNSAFE_getAllByType('View').find(
      (node) => node.props.accessibilityRole === 'image',
    );
    expect(chartSummary?.props.accessibilityLabel).toBe(
      buildWeightChartAccessibilityLabel('Milo', recentData, '3M'),
    );

    const pointMarkers = UNSAFE_getAllByType('TouchableOpacity').filter(
      (node) => node.props.accessibilityHint === 'Shows this weight data point details',
    );

    expect(pointMarkers).toHaveLength(recentData.length);
    pointMarkers.forEach((marker, index) => {
      expect(marker.props.accessibilityRole).toBe('button');
      expect(marker.props.accessibilityLabel).toBe(
        buildDataPointAccessibilityLabel(recentData[index]),
      );
    });
  });
});
