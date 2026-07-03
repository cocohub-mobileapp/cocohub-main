import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { type Species } from '../models/Pet';
import {
  checkSymptoms,
  SYMPTOM_OPTIONS,
  type SymptomCheckResult,
  type SymptomKey,
} from '../services/symptomCheckerService';

const speciesOptions: Array<{ value: Species; label: string }> = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'other', label: 'Other' },
];

const urgencyColors = {
  monitor: '#2E7D32',
  soon: '#1565C0',
  urgent: '#92400E',
  emergency: '#D32F2F',
};

export default function SymptomCheckerScreen() {
  const { colors } = useTheme();
  const [species, setSpecies] = useState<Species>('dog');
  const [breed, setBreed] = useState('');
  const [freeText, setFreeText] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomKey[]>([]);
  const [result, setResult] = useState<SymptomCheckResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => selectedSymptoms.length > 0 || freeText.trim().length > 0,
    [freeText, selectedSymptoms.length],
  );

  const toggleSymptom = (symptom: SymptomKey) => {
    setSelectedSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Select at least one symptom or describe what you are seeing.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const nextResult = await checkSymptoms({
        species,
        breed: breed.trim() || undefined,
        symptoms: selectedSymptoms,
        freeText: freeText.trim() || undefined,
      });
      setResult(nextResult);
    } catch {
      setError('Could not analyze symptoms right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor = result ? urgencyColors[result.urgency] : colors.primary;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[
          styles.disclaimer,
          { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
        ]}
      >
        <Ionicons name="alert-circle-outline" size={22} color={colors.primary} />
        <Text style={[styles.disclaimerText, { color: colors.text }]}>
          This is not veterinary advice. Use this checker to decide how quickly to contact a
          licensed veterinarian.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pet details</Text>
        <Text style={[styles.label, { color: colors.secondaryText }]}>Species</Text>
        <View style={styles.segmentRow}>
          {speciesOptions.map((option) => {
            const active = species === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.segment,
                  {
                    backgroundColor: active ? colors.primary : colors.input,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSpecies(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Species ${option.label}`}
              >
                <Text style={[styles.segmentText, { color: active ? colors.white : colors.text }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.secondaryText }]}>Breed</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
          ]}
          value={breed}
          onChangeText={setBreed}
          placeholder="Labrador Retriever"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="words"
          accessibilityLabel="Breed"
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Symptoms</Text>
        <View style={styles.symptomGrid}>
          {SYMPTOM_OPTIONS.map((symptom) => {
            const checked = selectedSymptoms.includes(symptom.id);
            return (
              <TouchableOpacity
                key={symptom.id}
                style={[
                  styles.symptomChip,
                  {
                    backgroundColor: checked ? colors.primaryMuted : colors.input,
                    borderColor: checked ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleSymptom(symptom.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={symptom.label}
              >
                <Ionicons
                  name={checked ? 'checkbox-outline' : 'square-outline'}
                  size={18}
                  color={checked ? colors.primary : colors.placeholder}
                />
                <Text style={[styles.symptomText, { color: colors.text }]}>{symptom.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.secondaryText }]}>Describe anything else</Text>
        <TextInput
          style={[
            styles.textArea,
            { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
          ]}
          value={freeText}
          onChangeText={setFreeText}
          placeholder="Timing, appetite, bathroom changes, behavior, possible exposure..."
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Symptom description"
        />

        {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: canSubmit ? colors.primary : colors.muted },
          ]}
          onPress={handleSubmit}
          disabled={loading || !canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Check symptoms"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="sparkles-outline" size={18} color={colors.white} />
              <Text style={styles.submitText}>Check symptoms</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {result ? (
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.urgencyBanner, { backgroundColor: `${urgencyColor}18` }]}>
            <Text style={[styles.urgencyText, { color: urgencyColor }]}>{result.urgencyLabel}</Text>
          </View>

          {result.redFlags.length > 0 ? (
            <View style={styles.resultSection}>
              <Text style={[styles.resultTitle, { color: colors.error }]}>Red flags</Text>
              {result.redFlags.map((flag) => (
                <Text key={flag} style={[styles.bullet, { color: colors.text }]}>
                  - {flag}
                </Text>
              ))}
            </View>
          ) : null}

          {result.conditions.length > 0 ? (
            <View style={styles.resultSection}>
              <Text style={[styles.resultTitle, { color: colors.text }]}>
                Possible causes to discuss
              </Text>
              {result.conditions.map((condition) => (
                <View
                  key={condition.id}
                  style={[styles.conditionBox, { borderColor: colors.border }]}
                >
                  <Text style={[styles.conditionName, { color: colors.text }]}>
                    {condition.name}
                  </Text>
                  <Text style={[styles.conditionMeta, { color: colors.placeholder }]}>
                    {condition.likelihood} likelihood - {condition.urgency} priority
                  </Text>
                  {condition.rationale.map((line) => (
                    <Text key={line} style={[styles.bullet, { color: colors.secondaryText }]}>
                      - {line}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          {result.breedRisks.length > 0 ? (
            <View style={styles.resultSection}>
              <Text style={[styles.resultTitle, { color: colors.text }]}>Breed context</Text>
              {result.breedRisks.slice(0, 4).map((risk) => (
                <Text key={risk} style={[styles.bullet, { color: colors.secondaryText }]}>
                  - {risk}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.resultSection}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>Next steps</Text>
            {result.nextSteps.map((step) => (
              <Text key={step} style={[styles.bullet, { color: colors.secondaryText }]}>
                - {step}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  disclaimer: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  disclaimerText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  segmentText: { fontSize: 14, fontWeight: '700' },
  input: { borderRadius: 10, borderWidth: 1, fontSize: 15, minHeight: 46, paddingHorizontal: 12 },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomChip: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  symptomText: { fontSize: 13, fontWeight: '600' },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 108,
    padding: 12,
  },
  errorText: { fontSize: 13, fontWeight: '600' },
  submitButton: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  urgencyBanner: { borderRadius: 10, padding: 12 },
  urgencyText: { fontSize: 18, fontWeight: '800' },
  resultSection: { gap: 8, marginTop: 4 },
  resultTitle: { fontSize: 16, fontWeight: '800' },
  bullet: { fontSize: 14, lineHeight: 20 },
  conditionBox: { borderRadius: 10, borderWidth: 1, gap: 6, padding: 12 },
  conditionName: { fontSize: 15, fontWeight: '800' },
  conditionMeta: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
});
