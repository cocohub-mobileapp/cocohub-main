import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList } from 'react-native';
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
import {
  buildDataPointAccessibilityLabel,
  buildWeightChartAccessibilityLabel,
  filterDataByRange,
  formatDateLabel,
  type DateRangeFilter,
  type WeightDataPoint,
} from './weightChartAccessibility';

export type { DateRangeFilter, WeightDataPoint } from './weightChartAccessibility';
export {
  buildDataPointAccessibilityLabel,
  buildWeightChartAccessibilityLabel,
  describeWeightTrend,
  filterDataByRange,
  formatDateLabel,
  rangeLabel,
} from './weightChartAccessibility';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeightRange {
  min: number;
  max: number;
  label?: string;
}

interface Props {
  data: WeightDataPoint[];
  petName?: string;
  vetRecommendedRange?: WeightRange;
  onExport?: () => void;
  height?: number;
}

// ─── Chart layout ─────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 48 };

// ─── Main Component ───────────────────────────────────────────────────────────

const WeightChart: React.FC<Props> = ({
  data,
  petName,
  vetRecommendedRange,
  onExport,
  height = 300,
}) => {
  const colors = useAppTheme();
  const [selectedRange, setSelectedRange] = useState<DateRangeFilter>('3M');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [showTableView, setShowTableView] = useState(false);

  const filteredData = useMemo(
    () =>
      filterDataByRange(data, selectedRange).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [data, selectedRange],
  );

  const chartAccessibilityLabel = useMemo(
    () => buildWeightChartAccessibilityLabel(petName, filteredData, selectedRange),
    [petName, filteredData, selectedRange],
  );

  const chartWidth = SCREEN_WIDTH - 32; // Account for container padding
  const chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  const { minWeight, maxWeight, yScale, xScale } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minWeight: 0, maxWeight: 10, yScale: () => 0, xScale: () => 0 };
    }

    const weights = filteredData.map((d) => d.weightKg);
    let min = Math.min(...weights);
    let max = Math.max(...weights);

    if (vetRecommendedRange) {
      min = Math.min(min, vetRecommendedRange.min);
      max = Math.max(max, vetRecommendedRange.max);
    }

    const padding = (max - min) * 0.1;
    min = Math.max(0, min - padding);
    max = max + padding;

    const nextYScale = (weight: number) => {
      const ratio = (weight - min) / (max - min);
      return chartHeight - ratio * chartHeight;
    };

    const nextXScale = (index: number) => {
      return (
        (index / Math.max(1, filteredData.length - 1)) *
        (chartWidth - CHART_PADDING.left - CHART_PADDING.right)
      );
    };

    return { minWeight: min, maxWeight: max, yScale: nextYScale, xScale: nextXScale };
  }, [filteredData, vetRecommendedRange, chartHeight, chartWidth]);

  const renderTableRow = ({ item }: { item: WeightDataPoint }) => (
    <View
      style={[styles.tableRow, { borderBottomColor: colors.muted }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={buildDataPointAccessibilityLabel(item)}
    >
      <Text style={[styles.tableDate, { color: colors.text }]}>{formatDateLabel(item.date)}</Text>
      <Text style={[styles.tableWeight, { color: colors.text }]}>
        {item.weightKg.toFixed(1)} kg
      </Text>
      {item.note ? (
        <Text style={[styles.tableNote, { color: colors.warning }]}>{item.note}</Text>
      ) : null}
    </View>
  );

  if (filteredData.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={chartAccessibilityLabel}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Weight & Growth Chart
          </Text>
        </View>
        <View style={[styles.emptyContainer, { height }]}>
          <Text style={[styles.emptyText, { color: colors.placeholder }]}>
            No weight data available for the selected period.
          </Text>
        </View>
      </View>
    );
  }

  const linePath = filteredData
    .map((point, idx) => {
      const x = CHART_PADDING.left + xScale(idx);
      const y = CHART_PADDING.top + yScale(point.weightKg);
      return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  const yTicks = [minWeight, (minWeight + maxWeight) / 2, maxWeight];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Weight & Growth Chart
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowTableView((current) => !current)}
            style={[styles.viewToggleBtn, { backgroundColor: colors.muted }]}
            accessibilityRole="button"
            accessibilityLabel={showTableView ? 'View as chart' : 'View as table'}
            accessibilityHint={
              showTableView
                ? 'Switches back to the visual weight chart'
                : 'Shows weight data in an accessible table list'
            }
          >
            <Text style={[styles.viewToggleText, { color: colors.text }]}>
              {showTableView ? 'View as chart' : 'View as table'}
            </Text>
          </TouchableOpacity>
          {onExport && (
            <TouchableOpacity
              onPress={onExport}
              style={[styles.exportBtn, { backgroundColor: colors.infoMuted }]}
              accessibilityRole="button"
              accessibilityLabel="Export weight chart"
            >
              <Text style={[styles.exportText, { color: colors.info }]}>Export</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['1M', '3M', '1Y', 'ALL'] as DateRangeFilter[]).map((range) => (
          <TouchableOpacity
            key={range}
            onPress={() => setSelectedRange(range)}
            style={[
              styles.filterBtn,
              { backgroundColor: colors.muted },
              selectedRange === range && { backgroundColor: colors.info },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show ${rangeLabel(range)}`}
            accessibilityState={{ selected: selectedRange === range }}
          >
            <Text
              style={[
                styles.filterText,
                { color: colors.secondaryText },
                selectedRange === range && styles.filterTextActive,
              ]}
            >
              {range}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={chartAccessibilityLabel}
        style={styles.chartSummary}
      >
        <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
          {chartAccessibilityLabel}
        </Text>
      </View>

      {showTableView ? (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => `${item.date}-${index}`}
          renderItem={renderTableRow}
          ListHeaderComponent={
            <View style={styles.tableHeader} accessible={false}>
              <Text style={[styles.tableHeaderText, { color: colors.secondaryText }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { color: colors.secondaryText }]}>Weight</Text>
            </View>
          }
          style={[styles.tableList, { maxHeight: height }]}
          accessibilityRole="list"
          accessibilityLabel="Weight data table"
        />
      ) : (
        <>
          <View style={styles.chartContainer} importantForAccessibility="no-hide-descendants">
            <Svg width={chartWidth} height={height} accessible={false}>
              <Defs>
                <LinearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity="0.06" />
                </LinearGradient>
              </Defs>

              {vetRecommendedRange && (
                <Rect
                  x={CHART_PADDING.left}
                  y={CHART_PADDING.top + yScale(vetRecommendedRange.max)}
                  width={chartWidth - CHART_PADDING.left - CHART_PADDING.right}
                  height={yScale(vetRecommendedRange.min) - yScale(vetRecommendedRange.max)}
                  fill="url(#rangeGradient)"
                />
              )}

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
                    {tick.toFixed(1)}
                  </SvgText>
                );
              })}

              <Path d={linePath} stroke={colors.chartLine} strokeWidth="2.5" fill="none" />

              {filteredData.map((point, idx) => {
                const x = CHART_PADDING.left + xScale(idx);
                const y = CHART_PADDING.top + yScale(point.weightKg);
                const isAnnotated = Boolean(point.note);
                const isSelected = selectedPoint === idx;

                return (
                  <React.Fragment key={idx}>
                    <Circle
                      cx={x}
                      cy={y}
                      r={isAnnotated ? 6 : 4}
                      fill={isAnnotated ? colors.chartAnnotation : colors.chartLine}
                      stroke={colors.card}
                      strokeWidth="2"
                      onPress={() => setSelectedPoint(isSelected ? null : idx)}
                      accessibilityLabel={buildDataPointAccessibilityLabel(point)}
                      accessibilityHint={Double tap to see weight details}
                    />
                    {isSelected && (
                      <Circle
                        cx={x}
                        cy={y}
                        r={10}
                        fill="none"
                        stroke={colors.chartLine}
                        strokeWidth="1.5"
                        accessibilityLabel={Selected point: }
                        accessibilityRole="none"
                      />
                    )}
                  </React.Fragment>
                );
              })}

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

            {selectedPoint !== null && filteredData[selectedPoint] && (
              <View style={[styles.tooltip, { backgroundColor: colors.cardElevated }]}>
                <Text style={[styles.tooltipDate, { color: colors.secondaryText }]}>
                  {formatDateLabel(filteredData[selectedPoint].date)}
                </Text>
                <Text style={[styles.tooltipWeight, { color: colors.text }]}>
                  {filteredData[selectedPoint].weightKg.toFixed(2)} kg
                </Text>
                {filteredData[selectedPoint].note && (
                  <Text style={[styles.tooltipNote, { color: colors.warning }]}>
                    {filteredData[selectedPoint].note}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.accessiblePointsList} accessibilityRole="list">
            {filteredData.map((point, idx) => (
              <Text
                key={`${point.date}-${idx}`}
                accessible
                accessibilityRole="text"
                accessibilityLabel={buildDataPointAccessibilityLabel(point)}
                style={styles.accessiblePointItem}
              >
                {buildDataPointAccessibilityLabel(point)}
              </Text>
            ))}
          </View>
        </>
      )}

      {vetRecommendedRange && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendBox,
                { backgroundColor: colors.chartRangeFill, borderColor: colors.primary },
              ]}
            />
            <Text style={[styles.legendText, { color: colors.secondaryText }]}>
              Vet Recommended: {vetRecommendedRange.min.toFixed(1)} -{' '}
              {vetRecommendedRange.max.toFixed(1)} kg
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: '600',
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
  filterTextActive: {
    color: '#fff',
  },
  chartSummary: {
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  chartContainer: {
    position: 'relative',
  },
  accessiblePointsList: {
    marginTop: 12,
  },
  accessiblePointItem: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  tableList: {
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  tableDate: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  tableWeight: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'right',
  },
  tableNote: {
    width: '100%',
    fontSize: 12,
    fontStyle: 'italic',
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
  tooltipWeight: {
    fontSize: 16,
    fontWeight: '700',
  },
  tooltipNote: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  legend: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBox: {
    width: 20,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 12,
  },
});

export default WeightChart;

