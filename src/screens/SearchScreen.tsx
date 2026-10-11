import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { resilientRequest } from '../services/apiClient';

interface SearchHit {
  id: string;
  index: string;
  score: number;
  source: Record<string, unknown>;
  highlights: Record<string, string[]>;
}

interface SearchResult {
  hits: SearchHit[];
  total: number;
}

const INDEX_LABELS: Record<string, string> = {
  pet_records: '🩺 Record',
  medications: '💊 Medication',
  appointments: '📅 Appointment',
};

const DEBOUNCE_MS = 350;

const SearchScreen: React.FC = () => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await resilientRequest<{ data: SearchResult }>({
        method: 'GET',
        url: `/search?q=${encodeURIComponent(q)}`,
      });
      setResults(res.data.data.hits);
      setTotal(res.data.data.total);
    } catch {
      setError('Search unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSearch(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const getTitle = (hit: SearchHit): string => {
    const s = hit.source;
    return (s.name ?? s.diagnosis ?? s.type ?? s.id) as string;
  };

  const getHighlight = (hit: SearchHit): string => {
    const first = Object.values(hit.highlights)[0];
    return first?.[0]?.replace(/<\/?mark>/g, '') ?? '';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Search</Text>

      <View
        style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.searchIcon, { color: colors.secondaryText }]}>🔍</Text>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Search records, medications, appointments…"
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search input"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
            <Text style={[styles.clearBtn, { color: colors.placeholder }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator style={styles.loader} color={colors.primary} />}

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      {!loading && query.length > 0 && results.length > 0 && (
        <Text style={[styles.resultCount, { color: colors.secondaryText }]}>
          {total} result{total !== 1 ? 's' : ''}
        </Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(h) => `${h.index}-${h.id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.indexLabel, { color: colors.primary }]}>
                {INDEX_LABELS[item.index] ?? item.index}
              </Text>
              <Text style={[styles.score, { color: colors.placeholder }]}>
                {(item.score * 100).toFixed(0)}%
              </Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{getTitle(item)}</Text>
            {getHighlight(item) ? (
              <Text style={[styles.highlight, { color: colors.secondaryText }]} numberOfLines={2}>
                {getHighlight(item)}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          !loading && query.length > 0 ? (
            <Text style={[styles.empty, { color: colors.placeholder }]}>
              No results for "{query}"
            </Text>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', padding: 16, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
  clearBtn: { fontSize: 16, paddingLeft: 8 },
  loader: { marginTop: 16 },
  error: { textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  resultCount: { fontSize: 13, paddingHorizontal: 16, marginBottom: 4 },
  list: { padding: 16 },
  card: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  indexLabel: { fontSize: 12, fontWeight: '600' },
  score: { fontSize: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  highlight: { fontSize: 13, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40 },
});

export default SearchScreen;
