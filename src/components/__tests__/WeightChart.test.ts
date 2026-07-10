import {
  buildDataPointAccessibilityLabel,
  buildWeightChartAccessibilityLabel,
  describeWeightTrend,
  filterDataByRange,
  rangeLabel,
} from '../weightChartAccessibility';

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

  it('builds an empty-state chart label for screen readers', () => {
    expect(buildWeightChartAccessibilityLabel('Buddy', [], '3M')).toBe(
      'No weight data available for the selected period.',
    );
  });

  it('falls back to a generic pet name when none is provided', () => {
    expect(buildWeightChartAccessibilityLabel(undefined, sampleData, 'ALL')).toContain(
      'Weight chart for Pet.',
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
    const label = buildDataPointAccessibilityLabel({
      date: '2026-03-01T00:00:00Z',
      weightKg: 12,
      note: 'Post-surgery',
    });

    expect(label).toContain('12.0 kilograms');
    expect(label).toContain('Post-surgery');
  });

  it('labels individual data points without optional notes', () => {
    const label = buildDataPointAccessibilityLabel({
      date: '2026-03-01T00:00:00Z',
      weightKg: 12.34,
    });

    expect(label).toContain('12.3 kilograms');
    expect(label).not.toContain('Note:');
  });

  it('maps range filters to readable periods', () => {
    expect(rangeLabel('1M')).toBe('the last 30 days');
    expect(rangeLabel('3M')).toBe('the last 3 months');
    expect(rangeLabel('1Y')).toBe('the last year');
    expect(rangeLabel('ALL')).toBe('all recorded data');
  });

  it('filters weight entries to the selected date range', () => {
    jest.setSystemTime(new Date('2026-07-10T00:00:00Z'));

    const data = [
      { date: '2026-06-25T00:00:00Z', weightKg: 12.4 },
      { date: '2026-05-01T00:00:00Z', weightKg: 12.1 },
      { date: '2025-07-01T00:00:00Z', weightKg: 10.8 },
    ];

    expect(filterDataByRange(data, '1M')).toEqual([data[0]]);
    expect(filterDataByRange(data, '3M')).toEqual([data[0], data[1]]);
    expect(filterDataByRange(data, 'ALL')).toEqual(data);
  });
});
