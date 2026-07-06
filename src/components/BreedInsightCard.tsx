/**
 * BreedInsightCard
 *
 * Surfaces breed-specific health risks and care recommendations for a pet.
 * Pulls from breedInsightsService and renders a collapsible card.
 *
 * Usage:
 *   <BreedInsightCard petId={pet.id} breed={pet.breed} species={pet.species} />
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import type { Species } from '../models/Pet';
import breedInsightsService, { type PetBreedInsights } from '../services/breedInsightsService';

interface Props {
  petId: string;
  breed?: string;
  species: Species;
  weightKg?: number;
  dateOfBirth?: string;
}

function ageYears(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return undefined;
  const diffMs = Date.now() - dob.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
}

const BreedInsightCard: React.FC<Props> = ({ petId, breed, species, weightKg, dateOfBirth }) => {
  const { colors } = useTheme();
  const [insights, setInsights] = useState<PetBreedInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!breed) return;
    setLoading(true);
    setError(false);
    try {
      const data = await breedInsightsService.getPetBreedInsights({
        petId,
        breed,
        species,
        weightKg,
        ageYears: ageYears(dateOfBirth),
      });
      setInsights(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [petId, breed, species, weightKg, dateOfBirth]);

  useEffect(() => {
    void load();
  }, [load]);

  // Don't render if no breed is known
  if (!breed) return null;
  if (error) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Breed insights for ${breed}`}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🧬</Text>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Breed Insights</Text>
            {insights && (
              <Text style={[styles.subtitle, { color: colors.placeholder }]}>
                {insights.breedDisplay} · {insights.lifeExpectancyLabel}
              </Text>
            )}
          </View>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.chevron, { color: colors.placeholder }]}>
            {expanded ? '▲' : '▼'}
          </Text>
        )}
      </TouchableOpacity>

      {expanded && insights && (
        <View style={styles.body}>
          {/* Health risks */}
          {insights.healthRisks.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                ⚠️ Common health risks
              </Text>
              {insights.healthRisks.map((risk, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: '#f57f17' }]} />
                  <Text style={[styles.rowText, { color: colors.text }]}>{risk}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Care recommendations */}
          {insights.careRecommendations.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                💡 Care recommendations
              </Text>
              {insights.careRecommendations.map((rec, i) => (
                <View key={i} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={[styles.rowText, { color: colors.text }]}>{rec}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Breed mix breakdown */}
          {insights.breakdown.length > 1 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>🐕 Breed breakdown</Text>
              {insights.breakdown.map((b, i) => (
                <View key={i} style={styles.breakdownRow}>
                  <Text style={[styles.breakdownName, { color: colors.text }]}>{b.name}</Text>
                  <View style={styles.breakdownBarBg}>
                    <View
                      style={[
                        styles.breakdownBarFill,
                        { width: `${b.percentage}%`, backgroundColor: colors.primary },
                      ]}
                    />
                  </View>
                  <Text style={[styles.breakdownPct, { color: colors.placeholder }]}>
                    {b.percentage}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.footer, { color: colors.placeholder }]}>
            Data is general breed information, not a veterinary assessment.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  chevron: { fontSize: 12 },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  rowText: { flex: 1, fontSize: 13, lineHeight: 19 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  breakdownName: { fontSize: 13, fontWeight: '500', width: 100 },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: 6,
    borderRadius: 3,
  },
  breakdownPct: { fontSize: 12, width: 36, textAlign: 'right' },
  footer: { fontSize: 11, marginTop: 14, fontStyle: 'italic' },
});

export default BreedInsightCard;
