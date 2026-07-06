/**
 * GlobalPetSelector
 *
 * A horizontal scrollable strip showing all the user's pets.
 * Tapping one selects it and persists the choice via AsyncStorage.
 * Screens that need a "current pet" context consume the usePetSelector hook.
 *
 * Usage:
 *   <GlobalPetSelector />
 *
 *   // In any screen:
 *   const { selectedPetId, selectedPet } = usePetSelector();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { getSpeciesEmoji } from '../models/Pet';
import { getAllPets, type Pet } from '../services/petService';
import haptics from '../utils/haptics';

const STORAGE_KEY = '@selected_pet_id';

// ─── Context ──────────────────────────────────────────────────────────────────

interface PetSelectorState {
  pets: Pet[];
  selectedPetId: string | null;
  selectedPet: Pet | null;
  loading: boolean;
  setSelectedPetId: (id: string) => void;
  reload: () => Promise<void>;
}

const PetSelectorContext = createContext<PetSelectorState | null>(null);

export function PetSelectorProvider({ children }: { children: React.ReactNode }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allPets, stored] = await Promise.all([
        getAllPets(),
        AsyncStorage.getItem(STORAGE_KEY),
      ]);
      setPets(allPets);
      // Default to stored pet if valid, otherwise first pet
      const defaultId =
        allPets.find((p) => p.id === stored)?.id ?? allPets[0]?.id ?? null;
      setSelectedPetIdState(defaultId);
    } catch {
      // Non-fatal — leave empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setSelectedPetId = useCallback((id: string) => {
    setSelectedPetIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const selectedPet = useMemo(
    () => pets.find((p) => p.id === selectedPetId) ?? null,
    [pets, selectedPetId],
  );

  const value = useMemo<PetSelectorState>(
    () => ({ pets, selectedPetId, selectedPet, loading, setSelectedPetId, reload: load }),
    [pets, selectedPetId, selectedPet, loading, setSelectedPetId, load],
  );

  return <PetSelectorContext.Provider value={value}>{children}</PetSelectorContext.Provider>;
}

export function usePetSelector(): PetSelectorState {
  const ctx = useContext(PetSelectorContext);
  if (!ctx) throw new Error('usePetSelector must be used within PetSelectorProvider');
  return ctx;
}

// ─── Visual component ─────────────────────────────────────────────────────────

interface GlobalPetSelectorProps {
  /** Optional override: called when a pet is selected (in addition to context update) */
  onSelect?: (pet: Pet) => void;
}

const GlobalPetSelector: React.FC<GlobalPetSelectorProps> = ({ onSelect }) => {
  const { colors } = useTheme();
  const { pets, selectedPetId, setSelectedPetId, loading } = usePetSelector();

  const handleSelect = useCallback(
    (pet: Pet) => {
      setSelectedPetId(pet.id);
      void haptics.selection();
      onSelect?.(pet);
    },
    [setSelectedPetId, onSelect],
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
      </View>
    );
  }

  if (pets.length === 0) {
    return null; // Nothing to show if user has no pets yet
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        accessibilityRole="tablist"
        accessibilityLabel="Select pet"
      >
        {pets.map((pet) => {
          const isSelected = pet.id === selectedPetId;
          return (
            <TouchableOpacity
              key={pet.id}
              style={[
                styles.petChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.background,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleSelect(pet)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={pet.name}
            >
              {pet.photoUrl ? (
                <Image
                  source={{ uri: pet.photoUrl }}
                  style={styles.avatar}
                  accessibilityLabel={`${pet.name} photo`}
                />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : colors.primaryMuted }]}>
                  <Text style={styles.avatarEmoji}>
                    {getSpeciesEmoji(pet.species)}
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.petName,
                  { color: isSelected ? '#fff' : colors.text },
                ]}
                numberOfLines={1}
              >
                {pet.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
    maxWidth: 130,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 13,
  },
  petName: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
});

export default GlobalPetSelector;
