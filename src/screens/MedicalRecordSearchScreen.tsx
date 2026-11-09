import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { HeaderOfflineStatus, useOfflineStatus } from '../components/OfflineIndicator';
import { searchMedicalRecords, type MedicalRecord } from '../services/medicalRecordService';
import { useTheme } from '../context/ThemeContext';
import {
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
} from '../services/searchSuggestionsService';

interface Props {
  petId: string;
  onBack: () => void;
}

const DEBOUNCE_MS = 300;
const MAX_RECENT = 10;

/** Highlight matching query text within a string. */
function HighlightedText({ text, query, style }: { text: string; query: string; style?: object }) {
  if (!query.trim() || !text) return <Text style={style}>{text}</Text>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={styles.highlight}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

const MedicalRecordSearchScreen: React.FC<Props> = ({ petId, onBack }) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecents, setShowRecents] = useState(false);
  const offlineStatus = useOfflineStatus();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getRecentSearches().then((recents) => setRecentSearches(recents.slice(0, MAX_RECENT)));
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      setShowRecents(false);
      try {
        const data = await searchMedicalRecords(petId, q);
        setResults(data);
        await addRecentSearch(q);
        const updated = await getRecentSearches();
        setRecentSearches(updated.slice(0, MAX_RECENT));
      } catch {
        Alert.alert('Error', 'Failed to search medical records.');
      } finally {
        setLoading(false);
      }
    },
    [petId],
  );

  const handleChangeText = (text: string) => {
    setQuery(text);
    setShowRecents(text.length === 0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
    setShowRecents(false);
    void runSearch(q);
  };

  const handleRemoveRecent = async (q: string) => {
    const updated = await removeRecentSearch(q);
    setRecentSearches(updated.slice(0, MAX_RECENT));
  };

  const renderItem = useCallback(
    ({ item }: { item: MedicalRecord }) => (
      <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityRole="text">
        <View style={styles.cardRow}>
          <Text style={[styles.badge, { color: colors.success, backgroundColor: colors.primaryMuted }]}>{item.type}</Text>
          <Text style={[styles.date, { color: colors.placeholder }]}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        {item.notes ? (
          <HighlightedText text={item.notes} query={query} style={[styles.notes, { color: colors.text }]} />
        ) : null}
        {item.veterinarian ? (
          <HighlightedText text={`Vet: ${item.veterinarian}`} query={query} style={[styles.meta, { color: colors.secondaryText }]} />
        ) : null}
        {item.documents?.length ? (
          <Text style={[styles.meta, { color: colors.secondaryText }]}>
            {item.documents.length} attachment{item.documents.length === 1 ? '' : 's'}
          </Text>
        ) : null}
        {!offlineStatus?.isOnline ? <Text style={[styles.cachedChip, { color: colors.warning, backgroundColor: colors.muted, borderColor: colors.warning }]}>Cached</Text> : null}
      </View>
    ),
    [offlineStatus?.isOnline, query],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="back-button"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>Search Records</Text>
          <HeaderOfflineStatus />
        </View>
      </View>

      {!offlineStatus?.isOnline ? (
        <View style={[styles.cachedBanner, { backgroundColor: colors.muted, borderBottomColor: colors.border }]}>
          <Text style={[styles.cachedBannerText, { color: colors.warning }]}>Showing cached records while offline.</Text>
        </View>
      ) : null}

      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.input, color: colors.text }]}
          placeholder="Search by diagnosis, notes, vet…"
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => setShowRecents(query.length === 0)}
          onSubmitEditing={() => runSearch(query)}
          returnKeyType="search"
          accessibilityLabel="Search medical records"
          testID="search-input"
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              setQuery('');
              setResults([]);
              setSearched(false);
              setShowRecents(true);
            }}
            accessibilityLabel="Clear search"
            testID="clear-button"
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {showRecents && recentSearches.length > 0 && (
        <View style={[styles.recentsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.recentsTitle, { color: colors.placeholder }]}>Recent Searches</Text>
          {recentSearches.map((r) => (
            <View key={r} style={styles.recentRow}>
              <TouchableOpacity
                style={styles.recentItem}
                onPress={() => handleSelectRecent(r)}
                testID={`recent-${r}`}
              >
                <Text style={styles.recentText}>{r}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRemoveRecent(r)}
                accessibilityLabel={`Remove ${r}`}
              >
                <Text style={styles.recentRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            searched ? (
              <Text style={[styles.empty, { color: colors.placeholder }]} accessibilityLiveRegion="polite">
                No records found for "{query}".
              </Text>
            ) : null
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17 },
  title: { fontSize: 17, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cachedBanner: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cachedBannerText: { fontSize: 12, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  clearBtn: { padding: 6 },
  clearText: { fontSize: 14 },
  recentsContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recentsTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentItem: { flex: 1, paddingVertical: 6 },
  recentText: { fontSize: 14 },
  recentRemove: { fontSize: 12, paddingLeft: 8 },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  card: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  date: { fontSize: 12 },
  notes: { fontSize: 14, marginBottom: 4 },
  meta: { fontSize: 12 },
  highlight: { backgroundColor: '#fff176', fontWeight: '700', color: '#1a1a1a' },
  cachedChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});

export default MedicalRecordSearchScreen;
