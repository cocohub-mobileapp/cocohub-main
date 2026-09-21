export type DateRangeFilter = '1M' | '3M' | '1Y' | 'ALL';

export interface WeightDataPoint {
  date: string;
  weightKg: number;
  note?: string;
}

export function rangeLabel(range: DateRangeFilter): string {
  switch (range) {
    case '1M':
      return 'the last 30 days';
    case '3M':
      return 'the last 3 months';
    case '1Y':
      return 'the last year';
    default:
      return 'all recorded data';
  }
}

export function formatDateLabel(iso: string, compact = false): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  if (compact) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function filterDataByRange(
  data: WeightDataPoint[],
  range: DateRangeFilter,
): WeightDataPoint[] {
  if (range === 'ALL') return data;

  const now = new Date();
  const cutoff = new Date(now);

  switch (range) {
    case '1M':
      cutoff.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      cutoff.setMonth(now.getMonth() - 3);
      break;
    case '1Y':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }

  return data.filter((d) => new Date(d.date) >= cutoff);
}

export function describeWeightTrend(data: WeightDataPoint[]): string {
  if (data.length < 2) return 'insufficient data for trend';
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const delta = sorted[sorted.length - 1].weightKg - sorted[0].weightKg;
  if (Math.abs(delta) < 0.1) return 'stable';
  return delta > 0 ? 'increasing' : 'decreasing';
}



export function buildDataPointAccessibilityLabel(point: WeightDataPoint): string {
  const noteSuffix = point.note ? `. Note: ${point.note}` : '';
  return `${formatDateLabel(point.date)}: ${point.weightKg.toFixed(1)} kilograms${noteSuffix}`;
}

/**
 * Returns an accessibility label for a date-range filter button so that screen
 * readers announce the action and current selection state together.
 *
 * @param range  - The filter value (e.g. '1M', '3M')
 * @param active - Whether this filter is currently selected
 */
export function buildRangeFilterAccessibilityLabel(
  range: DateRangeFilter,
  active: boolean,
): string {
  const description = rangeLabel(range);
  return active
    ? `Show ${description}, currently selected`
    : `Show ${description}`;
}

/**
 * Returns a human-readable accessibility label for the vet-recommended weight
 * range band shown on the chart.
 *
 * @param min - Lower bound in kg
 * @param max - Upper bound in kg
 * @param label - Optional custom label from the prop
 */
export function buildVetRangeAccessibilityLabel(
  min: number,
  max: number,
  label?: string,
): string {
  const base = `Vet recommended weight range: ${min.toFixed(1)} to ${max.toFixed(1)} kilograms`;
  return label ? `${base} (${label})` : base;
}

/**
 * Builds the full chart container accessibility label, including the total
 * number of recorded data points so screen readers can announce it.
 */
export function buildWeightChartAccessibilityLabel(
  petName: string | undefined,
  data: WeightDataPoint[],
  range: DateRangeFilter,
): string {
  if (data.length === 0) {
    return 'No weight data available for the selected period.';
  }

  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const current = sorted[sorted.length - 1].weightKg;
  const name = petName?.trim() || 'Pet';
  const trend = describeWeightTrend(sorted);
  const pointCount = sorted.length;
  const pointWord = pointCount === 1 ? 'entry' : 'entries';

  return (
    `Weight chart for ${name}. ` +
    `${pointCount} ${pointWord} over ${rangeLabel(range)}. ` +
    `Current weight: ${current.toFixed(1)} kg. ` +
    `Trend: ${trend}.`
  );
}
