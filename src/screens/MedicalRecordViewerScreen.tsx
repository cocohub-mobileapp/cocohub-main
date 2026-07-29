"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useAppTheme } from '../theme';

interface PetRecord {
  id: string;
  petName: string;
  recordType: string;
  date: string;
  veterinarian: string;
  notes: string;
}

const MOCK_RECORDS: PetRecord[] = [
  { id: '1', petName: 'Max', recordType: 'Vaccination', date: '2026-06-15', veterinarian: 'Dr. Smith', notes: 'Rabies vaccine administered.' },
  { id: '2', petName: 'Bella', recordType: 'Checkup', date: '2026-06-20', veterinarian: 'Dr. Johnson', notes: 'Annual wellness exam - all clear.' },
  { id: '3', petName: 'Max', recordType: 'Surgery', date: '2026-07-01', veterinarian: 'Dr. Williams', notes: 'Dental cleaning under anesthesia.' },
];

export default function MedicalRecordViewerScreen() {
  const colors = useAppTheme();
  const [records] = useState<PetRecord[]>(MOCK_RECORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.petName.toLowerCase().includes(q) ||
        r.recordType.toLowerCase().includes(q) ||
        r.veterinarian.toLowerCase().includes(q),
    );
  }, [records, searchQuery]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Loading records...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search records..."
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filteredRecords.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.placeholder }]}>No records found.</Text>
        ) : (
          filteredRecords.map((record) => (
            <TouchableOpacity
              key={record.id}
              style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow, borderColor: colors.border }]}
              onPress={() => Alert.alert(record.recordType, `${record.veterinarian}\n${record.date}\n\n${record.notes}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.petName, { color: colors.text }]}>{record.petName}</Text>
                <View style={[styles.badge, { backgroundColor: colors.primaryMuted }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>{record.recordType}</Text>
                </View>
              </View>
              <Text style={[styles.vetName, { color: colors.secondaryText }]}>{record.veterinarian}</Text>
              <Text style={[styles.date, { color: colors.placeholder }]}>{record.date}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  searchBar: { margin: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  searchInput: { padding: 14, fontSize: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyText: { textAlign: 'center', marginTop: 48, fontSize: 14 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  petName: { fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  vetName: { fontSize: 13, marginBottom: 4 },
  date: { fontSize: 12 },
});
