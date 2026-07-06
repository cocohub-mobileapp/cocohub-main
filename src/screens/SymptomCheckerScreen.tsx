/**
 * SymptomCheckerScreen
 *
 * AI-powered symptom triage screen. The user describes their pet's symptoms
 * in plain text; the backend ML prediction service returns a probable condition,
 * urgency level, and recommended next actions.
 *
 * Surfaces the existing /api/predictions endpoint backed by mlPredictionService.
 */

import React, { useState, useRef, useCallback } from 'react';
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

import { useTheme } from '../context/ThemeContext';
import { usePetSelector } from '../components/GlobalPetSelector';
import GlobalPetSelector from '../components/GlobalPetSelector';
import apiClient from '../services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SymptomAnalysis {
  probableConditions: Array<{
    condition: string;
    confidence: number; // 0–1
    description: string;
  }>;
  urgency: 'low' | 'moderate' | 'high' | 'emergency';
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
}

const URGENCY_CONFIG = {
  low: { emoji: '🟢', label: 'Low urgency', color: '#2e7d32', bg: '#e8f5e9' },
  moderate: { emoji: '🟡', label: 'Moderate — monitor closely', color: '#f57f17', bg: '#fffde7' },
  high: { emoji: '🔴', label: 'High — see a vet soon', color: '#c62828', bg: '#ffebee' },
  emergency: { emoji: '🆘', label: 'Emergency — seek help now', color: '#b71c1c', bg: '#ffcdd2' },
};

const EXAMPLE_SYMPTOMS = [
  'Not eating for 2 days and seems lethargic',
  'Vomiting repeatedly this morning',
  'Limping on back left leg after playing',
  'Scratching ears constantly and shaking head',
  'Breathing faster than normal, panting a lot',
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
}

const SymptomCheckerScreen: React.FC<Props> = ({ onBack }) => {
  const { colors } = useTheme();
  const { selectedPet } = usePetSelector();

  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SymptomAnalysis | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleCheck = useCallback(async () => {
    const trimmed = symptoms.trim();
    if (!trimmed) {
      Alert.alert('Describe symptoms', 'Please describe what you are observing.');
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
      const response = await apiClient.post<{ data: SymptomAnalysis }>(
        '/predictions/symptoms',
        {
          petId: selectedPet.id,
          species: selectedPet.species,
          breed: selectedPet.breed,
          symptoms: trimmed,
        },
      );
      setResult(response.data?.data ?? null);
    } catch {
      // Graceful fallback when backend ML service is unavailable
      Alert.alert(
        'Service unavailable',
        'The AI symptom checker is temporarily offline. Please contact your vet directly if you are concerned.',
      );
    } finally {
      setLoading(false);
    }
  }, [symptoms, selectedPet]);

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
      {/* Header */}
      {onBack && (
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Symptom Checker</Text>
          <View style={{ width: 48 }} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pet selector */}
        <GlobalPetSelector />

        {/* Intro */}
        <View style={styles.intro}>
          <Text style={styles.introEmoji}>🩺</Text>
          <Text style={[styles.introTitle, { color: colors.text }]}>
            Describe your pet's symptoms
          </Text>
          <Text style={[styles.introSub, { color: colors.placeholder }]}>
            Our AI will assess urgency and suggest next steps. Always follow up with a licensed vet.
          </Text>
        </View>

        {/* Symptom input */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            value={symptoms}
            onChangeText={(v) => { setSymptoms(v); setResult(null); }}
            placeholder={`e.g. "Not eating for 2 days and seems lethargic"`}
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

        {/* Example prompts */}
        {!symptoms && (
          <View style={styles.examples}>
            <Text style={[styles.examplesTitle, { color: colors.placeholder }]}>
              Try an example:
            </Text>
            {EXAMPLE_SYMPTOMS.map((ex) => (
              <TouchableOpacity
                key={ex}
                style={[styles.exampleChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleUseExample(ex)}
                accessibilityRole="button"
                accessibilityLabel={`Use example: ${ex}`}
              >
                <Text style={[styles.exampleText, { color: colors.text }]}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Analyse button */}
        <TouchableOpacity
          style={[
            styles.analyseBtn,
            { backgroundColor: colors.primary },
            (loading || !symptoms.trim()) && styles.analyseBtnDisabled,
          ]}
          onPress={() => void handleCheck()}
          disabled={loading || !symptoms.trim()}
          accessibilityRole="button"
          accessibilityLabel="Analyse symptoms"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.analyseBtnText}>Analyse Symptoms →</Text>
          )}
        </TouchableOpacity>

        {/* Results */}
        {result && urgencyCfg && (
          <View style={styles.results}>
            {/* Urgency banner */}
            <View style={[styles.urgencyBanner, { backgroundColor: urgencyCfg.bg }]}>
              <Text style={styles.urgencyEmoji}>{urgencyCfg.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgencyLabel, { color: urgencyCfg.color }]}>
                  {urgencyCfg.label}
                </Text>
                <Text style={[styles.urgencyReason, { color: urgencyCfg.color }]}>
                  {result.urgencyReason}
                </Text>
              </View>
            </View>

            {/* Probable conditions */}
            {result.probableConditions.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Possible conditions</Text>
                {result.probableConditions.map((c, i) => (
                  <View key={i} style={styles.conditionRow}>
                    <View style={styles.conditionLeft}>
                      <Text style={[styles.conditionName, { color: colors.text }]}>
                        {c.condition}
                      </Text>
                      <Text style={[styles.conditionDesc, { color: colors.placeholder }]}>
                        {c.description}
                      </Text>
                    </View>
                    <View style={[styles.confidenceBadge, { backgroundColor: colors.primaryMuted }]}>
                      <Text style={[styles.confidenceText, { color: colors.primary }]}>
                        {Math.round(c.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Recommended actions */}
            {result.recommendedActions.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Recommended actions</Text>
                {result.recommendedActions.map((action, i) => (
                  <View key={i} style={styles.actionRow}>
                    <Text style={styles.actionBullet}>•</Text>
                    <Text style={[styles.actionText, { color: colors.text }]}>{action}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Disclaimer */}
            <View style={[styles.disclaimer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.disclaimerIcon}>⚕️</Text>
              <Text style={[styles.disclaimerText, { color: colors.placeholder }]}>
                {result.disclaimer ||
                  'This is an AI-assisted triage only and is not a medical diagnosis. Always consult a licensed veterinarian for definitive advice.'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backText: { fontSize: 17 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  scroll: { paddingBottom: 40 },
  intro: { padding: 20, alignItems: 'center' },
  introEmoji: { fontSize: 48, marginBottom: 10 },
  introTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  introSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  urgencyEmoji: { fontSize: 28 },
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  disclaimerIcon: { fontSize: 16 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 17 },
});

export default SymptomCheckerScreen;
