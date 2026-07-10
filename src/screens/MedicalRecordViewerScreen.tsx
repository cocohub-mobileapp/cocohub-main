import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { EmptyState } from '../components/EmptyState';
import MedicalRecordAttachments from '../components/MedicalRecordAttachments';
import { useTheme } from '../context/ThemeContext';
import { requireBiometric, verifyPin } from '../services/authService';
import {
  getMedicalRecords,
  searchMedicalRecords,
  type MedicalRecord,
  type RecordFilters,
} from '../services/medicalRecordService';
import sessionMonitoringService from '../services/sessionMonitoringService';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordType = RecordFilters['type'];

/** Extended fields present on Vaccination / Treatment subtypes */
interface ExtendedRecord extends MedicalRecord {
  vaccineName?: string;
  treatmentName?: string;
  medication?: string;
  dosage?: string;
}

const RECORD_TYPES: { label: string; value: RecordType }[] = [
  { label: 'All', value: undefined },
  { label: 'Vaccination', value: 'vaccination' },
  { label: 'Treatment', value: 'treatment' },
  { label: 'Diagnosis', value: 'diagnosis' },
];

interface Props {
  petId: string;
  petName?: string;
  onBack: () => void;
  onAddRecord?: () => void;
}

type AuthGateState = 'checking' | 'authenticated' | 'pin_required' | 'failed';

// ─── Component ────────────────────────────────────────────────────────────────

const MedicalRecordViewerScreen: React.FC<Props> = ({ petId, petName, onBack, onAddRecord }) => {
  const { colors } = useTheme();
  const [authState, setAuthState] = useState<AuthGateState>('checking');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  // initial load state — shows full-screen spinner
  const [loading, setLoading] = useState(false);
  // next-page fetch state — shows footer spinner
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // page acts as our cursor: next page to load
  const nextPageRef = useRef(1);
  // prevent duplicate onEndReached fires
  const isFetchingRef = useRef(false);

  const [selectedType, setSelectedType] = useState<RecordType>(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [detailRecord, setDetailRecord] = useState<MedicalRecord | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const mapRecord = (r: MedicalRecord): MedicalRecord => ({
    ...r,
    verificationStatus: (r.isBlockchainVerified ? 'verified' : 'unknown') as
      | 'verified'
      | 'unknown'
      | 'pending',
  });

  // ─── Biometric auth gate ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const result = await requireBiometric();
        if (cancelled) return;

        if (result === 'authenticated') {
          setAuthState('authenticated');
        } else {
          // Biometric failed or unavailable — PIN fallback
          setAuthState('pin_required');
        }
      } catch {
        if (!cancelled) {
          setAuthState('failed');
        }
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePinSubmit = useCallback(async () => {
    if (!pinInput.trim()) {
      setPinError('Please enter your PIN.');
      return;
    }

    try {
      const valid = await verifyPin(pinInput.trim());
      if (valid) {
        await sessionMonitoringService.setLastBiometricCheck();
        setAuthState('authenticated');
        setPinInput('');
        setPinError('');
      } else {
        setPinError('Incorrect PIN. Please try again.');
        setPinInput('');
      }
    } catch {
      setPinError('Failed to verify PIN. Please try again.');
    }
  }, [pinInput]);

  const handleAuthCancel = useCallback(() => {
    Alert.alert(
      'Authentication required to view records',
      'You must authenticate to view medical records.',
      [{ text: 'OK', onPress: onBack }],
    );
  }, [onBack]);

  // ─── Initial / reset load ─────────────────────────────────────────────────

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setRecords([]);
    setHasMore(true);
    nextPageRef.current = 1;
    isFetchingRef.current = true;
    try {
      const filters: RecordFilters = {
        type: selectedType,
        page: 1,
        limit: PAGE_SIZE,
      };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const res = await getMedicalRecords(petId, filters);
      const { data: payload } = res;
      const mapped = payload.data.map(mapRecord);

      setRecords(mapped);
      // If the API returned fewer records than requested, we've hit the end
      setHasMore(payload.data.length === PAGE_SIZE && payload.page < payload.totalPages);
      nextPageRef.current = 2;
    } catch {
      Alert.alert('Error', 'Failed to load medical records.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [petId, selectedType, startDate, endDate]);

  useEffect(() => {
    if (!isSearchMode) void loadFirstPage();
  }, [loadFirstPage, isSearchMode]);

  // ─── Paginated next-page fetch ────────────────────────────────────────────

  const loadNextPage = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || isSearchMode) return;

    isFetchingRef.current = true;
    setLoadingMore(true);
    try {
      const filters: RecordFilters = {
        type: selectedType,
        page: nextPageRef.current,
        limit: PAGE_SIZE,
      };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const res = await getMedicalRecords(petId, filters);
      const { data: payload } = res;
      const mapped = payload.data.map(mapRecord);

      setRecords((prev) => [...prev, ...mapped]);
      setHasMore(payload.data.length === PAGE_SIZE && payload.page < payload.totalPages);
      nextPageRef.current += 1;
    } catch {
      Alert.alert('Error', 'Failed to load more records.');
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [petId, selectedType, startDate, endDate, hasMore, isSearchMode]);

  // ─── Search ───────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearchMode(false);
      return;
    }
    setLoading(true);
    setIsSearchMode(true);
    try {
      const results = await searchMedicalRecords(petId, searchQuery);
      setRecords(results);
      setHasMore(false); // search returns all results at once
    } catch {
      Alert.alert('Error', 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchMode(false);
  }, []);

  // ─── Filter actions ───────────────────────────────────────────────────────

  const applyFilters = () => {
    setIsSearchMode(false);
    setFiltersVisible(false);
    // loadFirstPage will be triggered by the useEffect dependency on selectedType/startDate/endDate
  };

  const resetFilters = useCallback(() => {
    setSelectedType(undefined);
    setStartDate('');
    setEndDate('');
  }, []);

  const hasActiveFilters = Boolean(selectedType || startDate || endDate);

  const handleEmptyStateAction = useCallback(() => {
    if (isSearchMode) {
      clearSearch();
      return;
    }

    if (hasActiveFilters) {
      resetFilters();
      return;
    }

    if (onAddRecord) {
      onAddRecord();
      return;
    }

    onBack();
  }, [clearSearch, hasActiveFilters, isSearchMode, onAddRecord, onBack, resetFilters]);

  // ─── FlatList callbacks ───────────────────────────────────────────────────

  const handleEndReached = useCallback(() => {
    void loadNextPage();
  }, [loadNextPage]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: MedicalRecord }) => (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            shadowColor: colors.shadow,
          },
        ]}
        onPress={() => setDetailRecord(item)}
      >
        <View style={styles.cardRow}>
          <View style={[styles.typeBadge, typeBadgeColor(item.type)]}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
          <Text style={[styles.cardDate, { color: colors.secondaryText }]}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>
        {item.notes ? (
          <Text style={[styles.cardNotes, { color: colors.text }]} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
        {item.veterinarian ? (
          <Text style={[styles.cardMeta, { color: colors.secondaryText }]}>
            Vet: {item.veterinarian}
          </Text>
        ) : null}
        {item.documents?.length ? (
          <Text style={[styles.cardMeta, { color: colors.secondaryText }]}>
            {item.documents.length} attachment{item.documents.length === 1 ? '' : 's'}
          </Text>
        ) : null}
      </TouchableOpacity>
    ),
    [colors],
  );

  const renderFooter = useCallback(() => {
    if (isSearchMode) return null;
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (!hasMore && records.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={[styles.footerEndText, { color: colors.secondaryText }]}>
            All records loaded
          </Text>
        </View>
      );
    }
    return null;
  }, [colors.primary, colors.secondaryText, loadingMore, hasMore, records.length, isSearchMode]);

  const emptyStateTitle = isSearchMode
    ? 'No matching records'
    : hasActiveFilters
      ? 'No records match these filters'
      : petName
        ? `No records for ${petName} yet`
        : 'No medical records yet';

  const emptyStateDescription = isSearchMode
    ? 'Try a different keyword or clear your search to see all records.'
    : hasActiveFilters
      ? 'Clear the current filters to return to the full medical history.'
      : 'Start a health timeline by importing vaccination, treatment, diagnosis, or visit records.';

  const emptyStateButtonText = isSearchMode
    ? 'Clear search'
    : hasActiveFilters
      ? 'Reset filters'
      : onAddRecord
        ? 'Import a record'
        : 'Back to pet profile';

  const emptyStateIcon = isSearchMode
    ? 'search-outline'
    : hasActiveFilters
      ? 'filter-outline'
      : 'document-text-outline';

  // ─── Render ───────────────────────────────────────────────────────────────

  // ── Auth gate: show authentication screen until verified ──
  if (authState === 'checking') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.authGateContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.authGateText, { color: colors.secondaryText }]}>
            Verifying authentication…
          </Text>
        </View>
      </View>
    );
  }

  if (authState === 'failed') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.authGateContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.authGateTitle, { color: colors.text }]}>
            Authentication Required
          </Text>
          <Text style={[styles.authGateDescription, { color: colors.secondaryText }]}>
            You must authenticate to view medical records.
          </Text>
          <TouchableOpacity
            style={[styles.authGateButton, { backgroundColor: colors.primary }]}
            onPress={onBack}
            accessibilityRole="button"
          >
            <Text style={styles.authGateButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (authState === 'pin_required') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.authGateContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.authGateTitle, { color: colors.text }]}>Enter PIN</Text>
          <Text style={[styles.authGateDescription, { color: colors.secondaryText }]}>
            Biometric authentication is unavailable. Please enter your PIN to continue.
          </Text>
          <TextInput
            style={[
              styles.pinInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Enter your PIN"
            placeholderTextColor={colors.placeholder}
            value={pinInput}
            onChangeText={(text) => {
              setPinInput(text);
              setPinError('');
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={10}
            accessibilityLabel="PIN input"
            onSubmitEditing={handlePinSubmit}
          />
          {pinError ? <Text style={styles.pinErrorText}>{pinError}</Text> : null}
          <TouchableOpacity
            style={[styles.authGateButton, { backgroundColor: colors.primary }]}
            onPress={handlePinSubmit}
            accessibilityRole="button"
          >
            <Text style={styles.authGateButtonText}>Submit PIN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.authGateCancelButton}
            onPress={handleAuthCancel}
            accessibilityRole="button"
          >
            <Text style={[styles.authGateCancelText, { color: colors.secondaryText }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {petName ? `${petName}'s Records` : 'Medical Records'}
        </Text>
        <TouchableOpacity
          onPress={() => setFiltersVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Filters"
        >
          <Text style={[styles.filterBtn, { color: colors.primary }]}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.input,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Search records…"
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => void handleSearch()}
          returnKeyType="search"
          accessibilityLabel="Search medical records"
        />
        {isSearchMode ? (
          <TouchableOpacity
            style={[styles.clearBtn, { backgroundColor: colors.error }]}
            onPress={clearSearch}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary }]}
            onPress={() => void handleSearch()}
            accessibilityRole="button"
            accessibilityLabel="Search records"
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active filter chips */}
      {(selectedType || startDate || endDate) && !isSearchMode ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[
            styles.chipRow,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
          contentContainerStyle={styles.chipContent}
        >
          {selectedType ? (
            <View style={[styles.chip, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.chipText, { color: colors.primary }]}>{selectedType}</Text>
            </View>
          ) : null}
          {startDate ? (
            <View style={[styles.chip, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.chipText, { color: colors.primary }]}>From: {startDate}</Text>
            </View>
          ) : null}
          {endDate ? (
            <View style={[styles.chip, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.chipText, { color: colors.primary }]}>To: {endDate}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.chipClear, { backgroundColor: colors.primaryMuted }]}
            onPress={resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
          >
            <Text style={[styles.chipClearText, { color: colors.primary }]}>Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {/* List */}
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          // Pagination
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          // Performance
          initialNumToRender={10}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          // Layout
          contentContainerStyle={records.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <EmptyState
              icon={emptyStateIcon}
              title={emptyStateTitle}
              description={emptyStateDescription}
              buttonText={emptyStateButtonText}
              onPress={handleEmptyStateAction}
              secondaryText={!isSearchMode && !hasActiveFilters ? 'Back to pet profile' : undefined}
              onSecondaryPress={!isSearchMode && !hasActiveFilters ? onBack : undefined}
              buttonAccessibilityLabel={emptyStateButtonText}
              testID="medical-records-empty-state"
            />
          }
        />
      )}

      {/* ── Filter Modal ── */}
      <Modal
        visible={filtersVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFiltersVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter Records</Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)}>
                <Text style={styles.filterClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Record Type</Text>
            <View style={styles.typeRow}>
              {RECORD_TYPES.map(({ label, value }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.typeChip, selectedType === value && styles.typeChipActive]}
                  onPress={() => setSelectedType(value)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === value && styles.typeChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Date Range</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>From</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={startDate}
                  onChangeText={setStartDate}
                  accessibilityLabel="Start date"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>To</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={endDate}
                  onChangeText={setEndDate}
                  accessibilityLabel="End date"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal ── */}
      {detailRecord && (
        <Modal visible animationType="slide" onRequestClose={() => setDetailRecord(null)}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setDetailRecord(null)}>
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Record Details</Text>
              <View style={{ width: 50 }} />
            </View>
            <ScrollView contentContainerStyle={styles.detailBody}>
              {(() => {
                const record = detailRecord as ExtendedRecord;
                return (
                  <>
                    <DetailRow label="Type" value={detailRecord.type} />
                    <DetailRow
                      label="Date"
                      value={new Date(detailRecord.date).toLocaleDateString()}
                    />
                    {detailRecord.veterinarian ? (
                      <DetailRow label="Vet" value={detailRecord.veterinarian} />
                    ) : null}
                    {detailRecord.notes ? (
                      <DetailRow label="Notes" value={detailRecord.notes} />
                    ) : null}
                    {detailRecord.nextVisitDate ? (
                      <DetailRow
                        label="Next Due"
                        value={new Date(detailRecord.nextVisitDate).toLocaleDateString()}
                      />
                    ) : null}
                    {record.vaccineName ? (
                      <DetailRow label="Vaccine" value={record.vaccineName} />
                    ) : null}
                    {record.treatmentName ? (
                      <DetailRow label="Treatment" value={record.treatmentName} />
                    ) : null}
                    {record.medication ? (
                      <DetailRow label="Medication" value={record.medication} />
                    ) : null}
                    {record.dosage ? <DetailRow label="Dosage" value={record.dosage} /> : null}
                    <MedicalRecordAttachments documents={detailRecord.documents} />
                    <DetailRow
                      label="Created"
                      value={new Date(detailRecord.createdAt).toLocaleDateString()}
                    />
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  vaccination: { bg: '#E8F5E9', text: '#2E7D32' },
  treatment: { bg: '#E3F2FD', text: '#1565C0' },
  diagnosis: { bg: '#FFF3E0', text: '#E65100' },
  other: { bg: '#F3E5F5', text: '#6A1B9A' },
};

const typeBadgeColor = (type: string) => {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.other;
  return { backgroundColor: c.bg };
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Auth gate
  authGateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
  },
  authGateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  authGateDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  authGateText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 16,
  },
  authGateButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  authGateButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  authGateCancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  authGateCancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#111827',
    backgroundColor: '#fff',
    width: '100%',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinErrorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backText: { color: '#10B981', fontSize: 16, fontWeight: '600', minWidth: 50 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  filterBtn: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  searchBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  clearBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  clearBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  chipRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  chipContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, color: '#065F46', fontWeight: '600' },
  chipClear: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipClearText: { fontSize: 12, color: '#991B1B', fontWeight: '600' },
  loader: { marginTop: 40 },
  list: { padding: 12, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#9CA3AF', fontSize: 15, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize', color: '#374151' },
  cardDate: { fontSize: 12, color: '#6B7280' },
  cardNotes: { fontSize: 14, color: '#374151', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  // Footer
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerEnd: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerEndText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  // Filter sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  filterClose: { fontSize: 20, color: '#6B7280' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  typeChipActive: { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
  typeChipText: { fontSize: 13, color: '#6B7280' },
  typeChipTextActive: { color: '#065F46', fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  applyBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resetBtn: { paddingVertical: 10, alignItems: 'center' },
  resetBtnText: { color: '#6B7280', fontSize: 14 },
  // Detail
  detailBody: { padding: 20 },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: { width: 90, fontSize: 13, color: '#6B7280', fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 14, color: '#111827' },
});

export default MedicalRecordViewerScreen;
