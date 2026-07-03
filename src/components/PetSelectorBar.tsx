/**
 * PetSelectorBar — Issue #151/#82: Multiple pets support
 *
 * A horizontal scrollable bar that lets the user switch between their pets.
 * Renders at the top of any screen that needs per-pet context.
 */

import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { usePetContext } from '../context/PetContext';
import type { Pet } from '../services/petService';
import { useAppTheme } from '../theme';

interface Props {
  onAddPet?: () => void;
}

const PetSelectorBar: React.FC<Props> = ({ onAddPet }) => {
  const colors = useAppTheme();
  const { pets, activePet, loading, setActivePet } = usePetContext();

  if (loading && pets.length === 0) {
    return (
      <View
        style={[
          styles.loadingRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        accessibilityRole="tablist"
      >
        {pets.map((pet: Pet) => {
          const isActive = activePet?.id === pet.id;
          return (
            <TouchableOpacity
              key={pet.id}
              style={[
                styles.chip,
                { backgroundColor: colors.input, borderColor: colors.border },
                isActive && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
              onPress={() => setActivePet(pet)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Select ${pet.name}`}
            >
              <Text style={styles.chipEmoji}>
                {pet.species === 'dog'
                  ? '🐶'
                  : pet.species === 'cat'
                    ? '🐱'
                    : pet.species === 'bird'
                      ? '🐦'
                      : pet.species === 'rabbit'
                        ? '🐰'
                        : '🐾'}
              </Text>
              <Text
                style={[
                  styles.chipText,
                  { color: colors.secondaryText },
                  isActive && { color: colors.primary },
                ]}
              >
                {pet.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {onAddPet && (
          <TouchableOpacity
            style={[
              styles.addChip,
              { backgroundColor: colors.surface, borderColor: colors.primary },
            ]}
            onPress={onAddPet}
            accessibilityRole="button"
            accessibilityLabel="Add new pet"
          >
            <Text style={[styles.addChipText, { color: colors.primary }]}>+ Add</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
  },
  loadingRow: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, fontWeight: '500' },
  addChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  addChipText: { fontSize: 13, fontWeight: '600' },
});

export default PetSelectorBar;
