import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, {
  Line,
  Circle,
  Rect,
  Text as SvgText,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

import { useAppTheme } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthScoreDataPoint {
  date: string;
  score: number;
  explanation?: any;
  confidenceMin?: number;
  confidenceMax?: number;
}

export interface MedicalEvent {
  date: string;
  type: 'vaccination' | 'treatment' | 'diagnosis';
  label: string;
}

export type DateRangeFilter = '30D' | '90D' | '1Y';

interface Props {
  data: HealthScoreDataPoint[];
  medicalEvents?: MedicalEvent[];
  onExport?: () => void;
  height?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Lazily evaluated so it works during SSR/web initialisation
const getScreenWidth = () => Dimensions.get('window').width || 375;
const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 48 };

function filterDataByRange(data: HealthScoreDataPoint[], range: DateRangeFilter): HealthScoreDataPoint[] {
  const now = new Date();
  const cutoff = new Date(now);

  switch (range) {
    case '30D':
      cutoff.setDate(now.getDate() - 30);
      break;
    case '90D':
      cutoff.setDate(now.getDate() - 90);
      break;
    case '1Y':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }

  return data.filter((d) => new Date(d.date) >= cutoff);
}

function formatDateLabel(iso: string, compact = false): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  if (compact) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function describeTrend(data: HealthScoreDataPoint[]): string {
  if (data.length < 2) return 'Insufficient data';
  
  const firstScore = data[0].score;
  const lastScore = data[data.length - 1].score;
  const change = lastScore - firstScore;
  
  if (Math.abs(change) < 3) return 'stable';
  if (change > 0) return `improving by ${Math.abs(change)} points`;
  return `declining by ${Math.abs(change)} points`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const HealthScoreChart: React.FC<Props> = ({ data, medicalEvents = [], onExport, height = 300 }) => {
  const colors = useAppTheme();
  const [selectedRange, setSelectedRange] = useState<DateRangeFilter>('90D');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const filteredData = useMemo(
    () =>
      filterDataByRange(data, selectedRange).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [data, selectedRange],
  );

  const filteredEvents = useMemo(
    () =>
      medicalEvents.filter((event) => {
        const eventDate = new Date(event.date);
        const firstDate = filteredData.length > 0 ? new Date(filteredData[0].date) : new Date();
        const lastDate =
          filteredData.length > 0
            ? new Date(filteredData[filteredData.length - 1].date)
            : new Date();
        return eventDate >= firstDate && eventDate <= lastDate;
      }),
    [medicalEvents, filteredData],
  );

  const chartWidth = getScreenWidth() - 32;
  const chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  const { xScale, yScale } = useMemo(() => {
    if (filteredData.length === 0) {
      return { xScale: () => 0, yScale: () => 0 };
    }

    const yScale = (score: number) => {
      const ratio = score / 100;
      return chartHeight - ratio * chartHeight;
    };

    const xScale = (index: number) => {
      return (
        (index / Math.max(1, filteredData.length - 1)) *
        (chartWidth - CHART_PADDING.left - CHART_PADDING.right)
      );
    };

    return { xScale, yScale };
  }, [filteredData, chartHeight, chartWidth]);

  const trendDescription = useMemo(() => describeTrend(filteredData), [filteredData]);

  // Theme-aware score color function
  const themeScoreColor = (score: number): string => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  // ── Render empty state ────────────────────────────────────────────────────

  if (filteredData.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Health Score Trend</Text>
        </View>
        <View style={[styles.emptyContainer, { height }]}>
          <Text style={[styles.emptyText, { color: colors.placeholder }]}>
            No health score data available for the selected period.
          </Text>
        </View>
      </View>
    );
  }

  // ── Build SVG path ────────────────────────────────────────────────────────

  const linePath = filteredData
    .map((point, idx) => {
      const x = CHART_PADDING.left + xScale(idx);
      const y = CHART_PADDING.top + yScale(point.score);
      return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // ── Y-axis labels ─────────────────────────────────────────────────────────

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Health Score Trend</Text>
        {onExport && (
          <TouchableOpacity
            onPress={onExport}
            style={[styles.exportBtn, { backgroundColor: colors.infoMuted }]}
            accessibilityRole="button"
          >
            <Text style={[styles.exportText, { color: colors.info }]}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date range filters */}
      <View style={styles.filterRow}>
        {(['30D', '90D', '1Y'] as DateRangeFilter[]).map((range) => (
          <TouchableOpacity
            key={range}
            onPress={() => setSelectedRange(range)}
            style={[
              styles.filterBtn,
              { backgroundColor: colors.muted },
              selectedRange === range && { backgroundColor: colors.info },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedRange === range }}
          >
            <Text
              style={[
                styles.filterText,
                { color: colors.secondaryText },
                selectedRange === range && { color: colors.white },
              ]}
            >
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={height}>
          <Defs>
            <LinearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.success} stopOpacity="0.22" />
              <Stop offset="1" stopColor={colors.success} stopOpacity="0.06" />
            </LinearGradient>
          </Defs>

          {/* Score zones overlay */}
          <Rect
            x={CHART_PADDING.left}
            y={CHART_PADDING.top + yScale(80)}
            width={chartWidth - CHART_PADDING.left - CHART_PADDING.right}
            height={yScale(0) - yScale(20)}
            fill={colors.success} 
            fillOpacity={0.08}
          />

          {/* Y-axis grid lines */}
          {yTicks.map((tick, idx) => {
            const y = CHART_PADDING.top + yScale(tick);
            return (
              <Line
                key={idx}
                x1={CHART_PADDING.left}
                y1={y}
                x2={chartWidth - CHART_PADDING.right}
                y2={y}
                stroke={colors.chartGrid}
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Y-axis labels */}
          {yTicks.map((tick, idx) => {
            const y = CHART_PADDING.top + yScale(tick);
            return (
              <SvgText
                key={idx}
                x={CHART_PADDING.left - 8}
                y={y + 4}
                fontSize="11"
                fill={colors.chartAxis}
                textAnchor="end"
              >
                {tick}
              </SvgText>
            );
          })}

          {/* Medical event markers */}
          {filteredEvents.map((event, idx) => {
            const eventDate = new Date(event.date);
            const eventIndex = filteredData.findIndex(
              (d) => Math.abs(new Date(d.date).getTime() - eventDate.getTime()) < 24 * 60 * 60 * 1000,
            );
            if (eventIndex === -1) return null;

            const x = CHART_PADDING.left + xScale(eventIndex);
            const color =
              event.type === 'vaccination' ? colors.info : event.type === 'treatment' ? colors.warning : colors.error;

            return (
              <React.Fragment key={`event-${idx}`}>
                <Line
                  x1={x}
                  y1={CHART_PADDING.top}
                  x2={x}
                  y2={height - CHART_PADDING.bottom}
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />
                <SvgText
                  x={x}
                  y={CHART_PADDING.top - 5}
                  fontSize="9"
                  fill={color}
                  textAnchor="middle"
                >
                  {event.type === 'vaccination' ? '💉' : event.type === 'treatment' ? '💊' : '🏥'}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Line chart */}
          <Path d={linePath} stroke={colors.chartLine} strokeWidth="2.5" fill="none" />

          {/* Data points */}
          {filteredData.map((point, idx) => {
            const x = CHART_PADDING.left + xScale(idx);
            const y = CHART_PADDING.top + yScale(point.score);
            const isSelected = selectedPoint === idx;
            const pointColor = themeScoreColor(point.score);

            return (
              <React.Fragment key={idx}>
                <Circle
                  cx={x}
                  cy={y}
                  r={4}
                  fill={pointColor}
                  stroke={colors.card}
                  strokeWidth="2"
                  onPress={() => setSelectedPoint(isSelected ? null : idx)}
                />
                {isSelected && (
                  <Circle
                    cx={x}
                    cy={y}
                    r={10}
                    fill="none"
                    stroke={pointColor}
                    strokeWidth="1.5"
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* X-axis labels */}
          {filteredData.map((point, idx) => {
            if (filteredData.length > 10 && idx % Math.ceil(filteredData.length / 6) !== 0) {
              return null;
            }
            const x = CHART_PADDING.left + xScale(idx);
            const y = height - CHART_PADDING.bottom + 16;
            return (
              <SvgText
                key={idx}
                x={x}
                y={y}
                fontSize="10"
                fill={colors.chartAxis}
                textAnchor="middle"
                transform={`rotate(-45, ${x}, ${y})`}
              >
                {formatDateLabel(point.date, true)}
              </SvgText>
            );
          })}
        </Svg>

        {/* Selected point tooltip */}
        {selectedPoint !== null && filteredData[selectedPoint] && (
          <View style={[styles.tooltip, { backgroundColor: colors.cardElevated }]}>
            <Text style={[styles.tooltipDate, { color: colors.secondaryText }]}>
              {formatDateLabel(filteredData[selectedPoint].date)}
            </Text>
            <Text
              style={[
                styles.tooltipScore,
                { color: themeScoreColor(filteredData[selectedPoint].score) },
              ]}
            >
              {filteredData[selectedPoint].score} / 100
            </Text>
            {filteredData[selectedPoint].explanation?.topStrengths && (
              <Text style={[styles.tooltipDetail, { color: colors.text }]}>
                💪 {filteredData[selectedPoint].explanation.topStrengths[0]}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Trend summary */}
      <View
        style={[styles.trendSummary, { backgroundColor: colors.subtle }]}
        accessibilityLabel={`Health score trend is ${trendDescription}`}
      >
        <Text style={[styles.trendText, { color: colors.secondaryText }]}>
          📊 Trend: <Text style={{ fontWeight: '700' }}>{trendDescription}</Text>
        </Text>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterRow: { flexDirection: 'row', marginBottom: 16 },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chartContainer: {
    position: 'relative',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 10,
    borderRadius: 8,
    minWidth: 140,
  },
  tooltipDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  tooltipScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  tooltipDetail: {
    fontSize: 11,
    marginTop: 4,
  },
  trendSummary: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 13,
    textAlign: 'center',
  },
});

export default HealthScoreChart;
