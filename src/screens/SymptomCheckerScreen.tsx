import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import GlobalPetSelector, { usePetSelector } from '../components/GlobalPetSelector';
import { useTheme } from '../context/ThemeContext';
import apiClient from '../services/apiClient';

interface BreedOption {
  id: string;
  name: string;
  species: string;
}

interface SymptomAnalysis {
  probableConditions: Array<{
    condition: string;
    confidence: number;
    description: string;
  }>;
  urgency: 'low' | 'moderate' | 'high' | 'emergency';
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
}

const URGENCY_CONFIG = {
  low: { label: 'Low urgency', color: '#2e7d32', bg: '#e8f5e9' },
  moderate: { label: 'Moderate - monitor closely', color: '#f57f17', bg: '#fffde7' },
  high: { label: 'High - see a vet soon', color: '#c62828', bg: '#ffebee' },
  emergency: { label: 'Emergency - seek help now', color: '#b71c1c', bg: '#ffcdd2' },
};

const FALLBACK_SYMPTOM_OPTIONS = [
  'Vomiting',
  'Diarrhea',
  'Not eating',
  'Lethargy',
  'Coughing',
  'Fast breathing',
  'Limping',
  'Scratching',
  'Ear shaking',
  'Frequent urination',
  'Straining to urinate',
  'Skin redness',
  'Eye discharge',
  'Pain',
  'Collapse or fainting',
];

const EXAMPLE_SYMPTOMS = [
  'Not eating for 2 days and seems lethargic',
  'Vomiting repeatedly this morning',
  'Limping on back left leg after playing',
  'Scratching ears constantly and shaking head',
  'Breathing faster than normal and panting a lot',
];

interface Props {
  onBack?: () => void;
}

const SymptomCheckerScreen: React.FC<Props> = ({ onBack }) => {
  const { colors } = useTheme();
  const { selectedPet } = usePetSelector();

  const [symptoms, setSymptoms] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [breeds, setBreeds] = useState<BreedOption[]>([]);
  const [selectedBreed, setSelectedBreed] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SymptomAnalysis | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBreeds() {
      try {
        const response = await apiClient.get<{ data: BreedOption[] }>('/breeds');
        if (mounted) setBreeds(response.data?.data ?? []);
      } catch {
        if (mounted) setBreeds([]);
      }
    }

    void loadBreeds();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedBreed(selectedPet?.breed ?? '');
    setResult(null);
  }, [selectedPet?.id, selectedPet?.breed]);

  const visibleBreeds = useMemo(() => {
    const species = selectedPet?.species?.toLowerCase();
    const matchingSpecies = species
      ? breeds.filter((breed) => breed.species.toLowerCase() === species)
      : breeds;

    const selected = selectedBreed
      ? matchingSpecies.find((breed) => breed.name === selectedBreed)
      : undefined;
    const firstOptions = matchingSpecies.slice(0, 16);

    return selected && !firstOptions.some((breed) => breed.id === selected.id)
      ? [selected, ...firstOptions]
      : firstOptions;
  }, [breeds, selectedBreed, selectedPet?.species]);

  const canAnalyze = Boolean(symptoms.trim() || selectedSymptoms.length > 0);

  const toggleSymptom = useCallback((symptom: string) => {
    setSelectedSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    );
    setResult(null);
  }, []);

  const handleCheck = useCallback(async () => {
    const trimmed = symptoms.trim();
    if (!canAnalyze) {
      Alert.alert('Add symptoms', 'Please describe symptoms or select at least one symptom.');
      inputRef.current?.focus();
      return;
    }
    if (!selectedPet) {
      Alert.alert('Select a pet', 'Please select which pet has these symptoms.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await apiClient.post<{ data: SymptomAnalysis }>('/symptom-checker/check', {
        petId: selectedPet.id,
        species: selectedPet.species,
        breed: selectedBreed || selectedPet.breed,
        symptoms: trimmed,
        selectedSymptoms,
      });
      setResult(response.data?.data ?? null);
    } catch {
      Alert.alert(
        'Service unavailable',
        'The symptom checker is temporarily offline. Please contact your vet directly if you are concerned.',
      );
    } finally {
      setLoading(false);
    }
  }, [canAnalyze, selectedBreed, selectedPet, selectedSymptoms, symptoms]);

  const handleUseExample = (example: string) => {
    setSymptoms(example);
    setResult(null);
  };

  const urgencyCfg = result ? URGENCY_CONFIG[result.urgency] : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {onBack && (
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Symptom Checker</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <GlobalPetSelector />

        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: colors.text }]}>
            Describe your pet's symptoms
          </Text>
          <Text style={[styles.introSub, { color: colors.placeholder }]}>
            Select a breed and symptoms, then add any details. Always follow up with a licensed vet.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Breed</Text>
          <TextInput
            style={[
              styles.breedInput,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            value={selectedBreed}
            onChangeText={(value) => {
              setSelectedBreed(value);
              setResult(null);
            }}
            placeholder="Select or type breed"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Pet breed"
          />
          {visibleBreeds.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroller}
            >
              {visibleBreeds.map((breed) => {
                const selected = breed.name === selectedBreed;
                return (
                  <TouchableOpacity
                    key={breed.id}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      setSelectedBreed(breed.name);
                      setResult(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${breed.name}`}
                  >
                    <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>
                      {breed.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Symptoms</Text>
          <View style={styles.symptomGrid}>
            {FALLBACK_SYMPTOM_OPTIONS.map((symptom) => {
              const selected = selectedSymptoms.includes(symptom);
              return (
                <TouchableOpacity
                  key={symptom}
                  style={[
                    styles.symptomChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => toggleSymptom(symptom)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={symptom}
                >
                  <Text
                    style={[styles.symptomChipText, { color: selected ? '#fff' : colors.text }]}
                  >
                    {symptom}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.inputCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            value={symptoms}
            onChangeText={(value) => {
              setSymptoms(value);
              setResult(null);
            }}
            placeholder="Add timing, severity, behavior changes, food changes, or anything unusual"
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
            maxLength={500}
            accessibilityLabel="Describe symptoms"
          />
          <Text style={[styles.charCount, { color: colors.placeholder }]}>
            {symptoms.length}/500
          </Text>
        </View>

        {!symptoms && selectedSymptoms.length === 0 && (
          <View style={styles.examples}>
            <Text style={[styles.examplesTitle, { color: colors.placeholder }]}>
              Try an example:
            </Text>
            {EXAMPLE_SYMPTOMS.map((example) => (
              <TouchableOpacity
                key={example}
                style={[
                  styles.exampleChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => handleUseExample(example)}
                accessibilityRole="button"
                accessibilityLabel={`Use example: ${example}`}
              >
                <Text style={[styles.exampleText, { color: colors.text }]}>{example}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.analyseBtn,
            { backgroundColor: colors.primary },
            (loading || !canAnalyze) && styles.analyseBtnDisabled,
          ]}
          onPress={() => void handleCheck()}
          disabled={loading || !canAnalyze}
          accessibilityRole="button"
          accessibilityLabel="Analyze symptoms"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.analyseBtnText}>Analyze Symptoms</Text>
          )}
        </TouchableOpacity>

        {result && urgencyCfg && (
          <View style={styles.results}>
            <View style={[styles.urgencyBanner, { backgroundColor: urgencyCfg.bg }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgencyLabel, { color: urgencyCfg.color }]}>
                  {urgencyCfg.label}
                </Text>
                <Text style={[styles.urgencyReason, { color: urgencyCfg.color }]}>
                  {result.urgencyReason}
                </Text>
              </View>
            </View>

            {result.probableConditions.length > 0 && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>Possible conditions</Text>
                {result.probableConditions.map((condition) => (
                  <View key={condition.condition} style={styles.conditionRow}>
                    <View style={styles.conditionLeft}>
                      <Text style={[styles.conditionName, { color: colors.text }]}>
                        {condition.condition}
                      </Text>
                      <Text style={[styles.conditionDesc, { color: colors.placeholder }]}>
                        {condition.description}
                      </Text>
                    </View>
                    <View
                      style={[styles.confidenceBadge, { backgroundColor: colors.primaryMuted }]}
                    >
                      <Text style={[styles.confidenceText, { color: colors.primary }]}>
                        {Math.round(condition.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {result.recommendedActions.length > 0 && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>Recommended actions</Text>
                {result.recommendedActions.map((action) => (
                  <View key={action} style={styles.actionRow}>
                    <Text style={styles.actionBullet}>*</Text>
                    <Text style={[styles.actionText, { color: colors.text }]}>{action}</Text>
                  </View>
                ))}
              </View>
            )}

            <View
              style={[
                styles.disclaimer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.disclaimerText, { color: colors.placeholder }]}>
                {result.disclaimer}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backText: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 48 },
  scroll: { paddingBottom: 40 },
  intro: { padding: 20, alignItems: 'center' },
  introTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  introSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  section: { marginHorizontal: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  breedInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipScroller: { paddingTop: 10, gap: 8 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  symptomChipText: { fontSize: 13, fontWeight: '600' },
  inputCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  input: {
    fontSize: 15,
    minHeight: 100,
    lineHeight: 22,
  },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 6 },
  examples: { marginHorizontal: 16, marginTop: 16 },
  examplesTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  exampleChip: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  exampleText: { fontSize: 13, lineHeight: 18 },
  analyseBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  analyseBtnDisabled: { opacity: 0.5 },
  analyseBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  results: { marginTop: 20 },
  urgencyBanner: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  urgencyLabel: { fontSize: 16, fontWeight: '700' },
  urgencyReason: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  conditionLeft: { flex: 1 },
  conditionName: { fontSize: 14, fontWeight: '600' },
  conditionDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  confidenceBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    minWidth: 44,
    alignItems: 'center',
  },
  confidenceText: { fontSize: 12, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: 8,
  },
  actionBullet: { fontSize: 16, color: '#4CAF50', fontWeight: '700', marginTop: -1 },
  actionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  disclaimer: {
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  disclaimerText: { fontSize: 12, lineHeight: 17 },
});

export default SymptomCheckerScreen;
