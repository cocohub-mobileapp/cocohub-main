import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import MultiStepFormHeader from '../components/MultiStepFormHeader';
import { useMultiStepFormFocus } from '../hooks/useMultiStepFormFocus';
import type { Species } from '../models/Pet';
import { SPECIES_OPTIONS } from '../models/Pet';
import breedInsightsService, { type BreedInsight } from '../services/breedInsightsService';
import { schedulePetBirthday } from '../services/petBirthdayService';
import DatePickerInput from '../components/DatePickerInput';
import petService, { type Pet } from '../services/petService';
import { parseWeightToKg, weightUnit } from '../utils/localeValues';
import { getPhoto, removePhoto, savePhoto } from '../utils/petPhotoStore';

/** Special-case breed options shown at the bottom of every suggestion list */
const SPECIAL_BREEDS: BreedInsight[] = [
  {
    id: 'mixed-breed',
    name: 'Mixed breed',
    species: 'dog',
    lifeExpectancyYears: 0,
    commonHealthConditions: [],
    careRecommendations: [],
  },
  {
    id: 'unknown-breed',
    name: 'Unknown',
    species: 'dog',
    lifeExpectancyYears: 0,
    commonHealthConditions: [],
    careRecommendations: [],
  },
];

const DEBOUNCE_MS = 300;

interface Props {
  /** Pass a pet to edit; omit for add mode. */
  pet?: Pet;
  /** ownerId required when creating a new pet. */
  ownerId?: string;
  onBack: () => void;
  onSaved: (pet: Pet) => void;
}

interface FormState {
  name: string;
  species: string;
  breed: string;
  dateOfBirth: string;
  weight: string;
  microchipId: string;
}

const EMPTY: FormState = {
  name: '',
  species: '',
  breed: '',
  dateOfBirth: '',
  weight: '',
  microchipId: '',
};

/** Returns an image source for a breed — uses CDN URL, falls back gracefully if unavailable */
const getBreedImageSource = (breed: BreedInsight): { uri: string } | null => {
  if (breed.id === 'mixed-breed' || breed.id === 'unknown-breed') return null;
  return {
    uri: `https://cdn.cocohub.app/breeds/${encodeURIComponent(breed.name.toLowerCase().replace(/\s+/g, '-'))}.jpg`,
  };
};

const PetFormScreen: React.FC<Props> = ({ pet, ownerId = '', onBack, onSaved }) => {
  const isEdit = !!pet;
  const [form, setForm] = useState<FormState>(
    pet
      ? {
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '',
          dateOfBirth: pet.dateOfBirth?.slice(0, 10) ?? '',
          weight: pet.weightKg ? pet.weightKg.toString() : '',
          microchipId: pet.microchipId ?? '',
        }
      : EMPTY,
  );
  const [allBreeds, setAllBreeds] = useState<BreedInsight[]>([]);
  const [breedSuggestions, setBreedSuggestions] = useState<BreedInsight[]>([]);
  /** The currently selected breed object (for image preview after selection) */
  const [selectedBreed, setSelectedBreed] = useState<BreedInsight | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    currentStep,
    totalSteps,
    stepHeadingRef,
    stepAnnouncement,
    registerFirstInteractive,
    registerFieldRef,
    goNext,
    goBack,
    focusFirstError,
    isFirstStep,
    isLastStep,
  } = useMultiStepFormFocus(FORM_STEPS);

  const loadPhoto = useCallback(async () => {
    if (pet) setPhotoUri(await getPhoto(pet.id));
  }, [pet]);

  useEffect(() => {
    void loadPhoto();
  }, [loadPhoto]);

  // Load the full breed list once on mount
  useEffect(() => {
    void (async () => {
      try {
        const breeds = await breedInsightsService.getBreedList();
        setAllBreeds(breeds);
      } catch {
        setAllBreeds([]);
      }
    })();
  }, []);

  // If editing a pet with a known breed, pre-select it
  useEffect(() => {
    if (pet?.breed && allBreeds.length > 0) {
      const found = allBreeds.find(
        (b) => b.name.toLowerCase() === (pet.breed ?? '').toLowerCase(),
      );
      if (found) setSelectedBreed(found);
    }
  }, [pet, allBreeds]);

  const set = (key: keyof FormState) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  /**
   * Called on every keystroke in the breed field.
   * Debounces the suggestion search by 300 ms to avoid thrashing on fast typing.
   */
  const updateBreedField = (value: string) => {
    setForm((f) => ({ ...f, breed: value }));
    // Clear selected breed image when the user starts typing again
    setSelectedBreed(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      setBreedSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const matched = allBreeds
        .filter((b) => b.name.toLowerCase().includes(normalized))
        .slice(0, 6);
      // Always append the special-case options so the user can pick them
      const specials = SPECIAL_BREEDS.filter((s) =>
        s.name.toLowerCase().includes(normalized),
      );
      setBreedSuggestions([...matched, ...specials]);
    }, DEBOUNCE_MS);
  };

  const selectBreed = (breed: BreedInsight) => {
    setForm((f) => ({ ...f, breed: breed.name }));
    setSelectedBreed(breed);
    setBreedSuggestions([]);
  };

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Photo management ───────────────────────────────────────────────────────
  // Without expo-image-picker installed we prompt for a URI directly.
  // In a real build, replace this with ImagePicker.launchImageLibraryAsync().

  const handlePhotoAction = () => {
    Alert.alert('Pet Photo', 'Enter a photo URL or file URI', [
      {
        text: 'Enter URL',
        onPress: () => {
          Alert.prompt(
            'Photo URL',
            'Paste an image URL:',
            (url) => {
              if (url?.trim()) setPhotoUri(url.trim());
            },
            'plain-text',
          );
        },
      },
      photoUri
        ? {
            text: 'Remove Photo',
            style: 'destructive',
            onPress: () => setPhotoUri(null),
          }
        : { text: 'Cancel', style: 'cancel' },
      ...(!photoUri ? [{ text: 'Cancel', style: 'cancel' as const }] : []),
    ]);
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 0) {
      if (!form.name.trim()) {
        focusFirstError('name', 'Name is required.');
        return false;
      }
      if (!form.species.trim()) {
        focusFirstError('species', 'Species is required.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    goNext();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      focusFirstError('name', 'Name is required.', 0);
      return;
    }
    if (!form.species.trim()) {
      focusFirstError('species', 'Species is required.', 0);
      return;
    }
    setSaving(true);
    try {
      const weightValue = Number(form.weight.trim());
      const payload = {
        name: form.name.trim(),
        species: form.species.trim() as Species,
        breed: form.breed.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        weightKg:
          Number.isFinite(weightValue) && weightValue > 0
            ? parseWeightToKg(weightValue)
            : undefined,
        microchipId: form.microchipId.trim() || undefined,
      };

      let saved: Pet;
      if (isEdit && pet) {
        saved = await petService.updatePet(pet.id, payload);
      } else {
        saved = await petService.createPet({ ...payload, ownerId });
      }

      if (photoUri) {
        await savePhoto(saved.id, photoUri);
      } else if (isEdit && pet) {
        await removePhoto(pet.id);
      }

      // Reschedule birthday + health milestone notifications whenever pet DOB changes
      void schedulePetBirthday(saved);

      onSaved(saved);
    } catch {
      Alert.alert('Error', 'Failed to save pet. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = ({
    key,
    label,
    placeholder,
    keyboardType,
    isFirstInteractive = false,
  }: {
    key: keyof FormState;
    label: string;
    placeholder: string;
    keyboardType: 'default' | 'decimal-pad';
    isFirstInteractive?: boolean;
  }) => (
    <View key={key} style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        ref={(ref) => {
          registerFieldRef(key, ref);
          if (isFirstInteractive) {
            registerFirstInteractive(currentStep, ref);
          }
        }}
        style={styles.input}
        placeholder={placeholder}
        value={form[key]}
        onChangeText={key === 'breed' ? updateBreedField : set(key)}
        keyboardType={keyboardType}
        placeholderTextColor="#bbb"
        accessibilityLabel={label.replace('*', '').trim()}
        returnKeyType="next"
        testID={`pet-${key}-input`}
      />
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <TouchableOpacity
              ref={(ref) => registerFirstInteractive(0, ref)}
              style={styles.photoSection}
              onPress={handlePhotoAction}
              accessibilityRole="button"
              accessibilityLabel={photoUri ? 'Change photo' : 'Add photo'}
            >
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photo}
                  accessible
                  accessibilityLabel="Pet photo"
                />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Text style={styles.photoEmoji}>🐾</Text>
                </View>
              )}
              <Text style={styles.photoHint}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
            {renderField({
              key: 'name',
              label: 'Name *',
              placeholder: 'e.g. Buddy',
              keyboardType: 'default',
            })}
            {/* Species picker — grid of tappable chips */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Species *</Text>
              <View style={styles.speciesGrid}>
                {SPECIES_OPTIONS.map((opt) => {
                  const isSelected = form.species === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.speciesChip, isSelected && styles.speciesChipSelected]}
                      onPress={() => setForm((f) => ({ ...f, species: opt.value }))}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={opt.label}
                    >
                      <Text style={styles.speciesEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.speciesLabel, isSelected && styles.speciesLabelSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {renderField({
              key: 'breed',
              label: 'Breed',
              placeholder: 'e.g. Labrador',
              keyboardType: 'default',
            })}
            {breedSuggestions.length > 0 && (
              <View style={styles.suggestionsCard}>
                <Text style={styles.suggestionsTitle}>Suggested breeds</Text>
                <View style={styles.suggestionsRow}>
                  {breedSuggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      onPress={() => selectBreedSuggestion(suggestion)}
                      style={styles.suggestionChip}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${suggestion}`}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        );
      case 1:
        return (
          <>
            {renderField({
              key: 'weight',
              label: `Weight (${weightUnit()})`,
              placeholder: 'e.g. 12.5',
              keyboardType: 'decimal-pad',
              isFirstInteractive: true,
            })}
            <View style={{ height: 14 }} />
            <DatePickerInput
              label="Date of Birth"
              value={form.dateOfBirth}
              onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))}
              placeholder="Select date of birth"
              maxDate={new Date()}
            />
          </>
        );
      case 2:
        return (
          <>
            {renderField({
              key: 'microchipId',
              label: 'Microchip ID',
              placeholder: 'Optional',
              keyboardType: 'default',
              isFirstInteractive: true,
            })}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container} testID="pet-form-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Pet' : 'Add Pet'}</Text>
        {isLastStep ? (
          <TouchableOpacity
            onPress={() => void handleSave()}
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isEdit ? 'Save changes' : 'Save pet'}
            testID="pet-form-save-button"
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <MultiStepFormHeader
          stepHeadingRef={stepHeadingRef}
          announcement={stepAnnouncement}
          currentStep={currentStep}
          totalSteps={totalSteps}
        />
        <View style={styles.formCard}>{renderStepContent()}</View>

        {/* Step navigation */}
        <View style={styles.stepActions}>
          {!isFirstStep && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Go to previous step"
            >
              <Text style={styles.secondaryBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
          {!isLastStep && (
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.nextBtn]}
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel="Go to next step"
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17, color: '#4CAF50' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerSpacer: { width: 64 },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  content: { padding: 16 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photo: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  photoPlaceholder: { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  photoEmoji: { fontSize: 40 },
  photoHint: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: '#666', marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
    color: '#1a1a1a',
  },
  suggestionsCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f1f8e9',
    borderRadius: 10,
  },
  // ── Step navigation ──
  stepActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  nextBtn: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // ── Species picker ──
  speciesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginHorizontal: -4,
  },
  speciesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    margin: 4,
    gap: 4,
  },
  speciesChipSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  speciesEmoji: {
    fontSize: 15,
  },
  speciesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  speciesLabelSelected: {
    color: '#2e7d32',
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#33691e',
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  suggestionChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c5e1a5',
    margin: 4,
  },
  suggestionText: {
    color: '#33691e',
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Breed autocomplete with images ──
  selectedBreedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f8e9',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  selectedBreedImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#e8f5e9',
  },
  selectedBreedName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#33691e',
  },
  clearBreedBtn: {
    padding: 4,
  },
  clearBreedText: {
    fontSize: 16,
    color: '#888',
  },
  suggestionsDropdown: {
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#e8f5e9',
  },
  breedImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
  },
  breedPlaceholderEmoji: {
    fontSize: 18,
  },
  suggestionRowText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  suggestionDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 60,
  },
});

export default PetFormScreen;
