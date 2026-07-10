import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import BreedInsightCard from '../components/BreedInsightCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { useTheme } from '../context/ThemeContext';
import type { Pet } from '../models/Pet';
import breedInsightsService, { type PetBreedInsights } from '../services/breedInsightsService';
import petService from '../services/petService';
import { formatLocalDate, formatRelativeTime } from '../utils/dateLocale';
import { formatWeight } from '../utils/localeValues';
import { getPhoto } from '../utils/petPhotoStore';
import { useSecureScreen } from '../utils/secureScreen';

interface Props {
  petId: string;
  onBack: () => void;
  onEdit: (pet: Pet) => void;
  onHealthDashboard: (petId: string, petName: string) => void;
  onShare?: (petId: string, petName: string) => void;
  onAuditHistory?: (petId: string, petName: string) => void;
  onViewProfile?: (petId: string, petName: string) => void;
}

const PetDetailScreen: React.FC<Props> = ({
  petId,
  onBack,
  onEdit,
  onHealthDashboard,
  onShare,
  onAuditHistory,
  onViewProfile,
}) => {
  useSecureScreen();

  const { colors } = useTheme();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [breedInsights, setBreedInsights] = useState<PetBreedInsights | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, uri] = await Promise.all([petService.getPetById(petId), getPhoto(petId)]);
      setPet(data);
      setPhoto(uri);
    } catch {
      Alert.alert('Error', 'Failed to load pet details.');
      onBack();
    } finally {
      setLoading(false);
    }
  }, [petId, onBack]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pet?.breed) {
      setBreedInsights(null);
      return;
    }

    void (async () => {
      try {
        const insights = await breedInsightsService.getBreedInsightsForPet({
          breed: pet.breed,
          species: pet.species,
          dateOfBirth: pet.dateOfBirth,
          weightKg: pet.weightKg,
        });
        setBreedInsights(insights);
      } catch {
        setBreedInsights(null);
      }
    })();
  }, [pet]);

  const handleDelete = () => {
    Alert.alert('Delete Pet', `Remove ${pet?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await petService.deletePet(petId);
            onBack();
          } catch {
            Alert.alert('Error', 'Failed to delete pet.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Loading…</Text>
          <View style={styles.editBtn} />
        </View>
        <View style={{ padding: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} height={72} />
          ))}
        </View>
      </View>
    );
  }

  if (!pet) return null;

  const fields: { label: string; value: string | undefined }[] = [
    { label: 'Species', value: pet.species },
    { label: 'Breed', value: pet.breed },
    { label: 'Weight', value: pet.weightKg ? formatWeight(pet.weightKg) : undefined },
    {
      label: 'Date of Birth',
      value: pet.dateOfBirth ? formatLocalDate(pet.dateOfBirth) : undefined,
    },
    { label: 'Microchip ID', value: pet.microchipId },
    { label: 'Added', value: formatRelativeTime(pet.createdAt) },
  ];

  return (
    <View style={styles.container} testID="pet-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <TouchableOpacity
          onPress={() => onEdit(pet)}
          style={styles.editBtn}
          accessibilityRole="button"
          accessibilityLabel="Edit pet"
          accessibilityHint="Opens edit form"
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.photoSection}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={styles.photo}
              accessible
              accessibilityLabel={`${pet.name} photo`}
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.photoEmoji}>🐾</Text>
            </View>
          )}
          <Text style={styles.petName}>{pet.name}</Text>
        </View>

        <View style={styles.detailsCard}>
          {fields
            .filter((f) => f.value)
            .map((f) => (
              <View key={f.label} style={styles.row}>
                <Text style={styles.rowLabel}>{f.label}</Text>
                <Text style={styles.rowValue}>{f.value}</Text>
              </View>
            ))}
        </View>

        {breedInsights ? (
          <BreedInsightCard
            petId={petId}
            breed={pet.breed}
            species={pet.species}
            weightKg={pet.weightKg}
            dateOfBirth={pet.dateOfBirth}
          />
        ) : null}

        <TouchableOpacity
          style={styles.healthBtn}
          onPress={() => onHealthDashboard(petId, pet.name)}
          accessibilityRole="button"
          accessibilityLabel="Health Dashboard"
          accessibilityHint="View health overview, upcoming appointments, and medications"
        >
          <Text style={styles.healthBtnText}>Health Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => onViewProfile && onViewProfile(petId, pet.name)}
          accessibilityRole="button"
          accessibilityLabel="View pet profile"
          accessibilityHint="View breed profile and personalized care recommendations"
        >
          <Text style={styles.profileBtnText}>View Breed Profile</Text>
        </TouchableOpacity>

        {onShare && (
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => onShare(petId, pet.name)}
            accessibilityRole="button"
            accessibilityLabel="Share pet profile"
            accessibilityHint={`Share ${pet.name}'s profile via link, social media, or QR code`}
            testID="share-pet-profile-button"
          >
            <Text style={styles.shareBtnText}>Share Profile</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete pet"
          accessibilityHint={`Deletes ${pet.name}`}
        >
          <Text style={styles.deleteBtnText}>Delete Pet</Text>
        </TouchableOpacity>
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
  editBtn: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: { color: '#4CAF50', fontWeight: '600' },
  profileBtn: {
    backgroundColor: '#ffb300',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  profileBtnText: { color: '#1a1a1a', fontWeight: '700' },
  content: { padding: 16 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photo: { width: 120, height: 120, borderRadius: 60, marginBottom: 10 },
  photoPlaceholder: {
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEmoji: { fontSize: 48 },
  petName: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  insightsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e8f5e9',
    marginBottom: 20,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1b5e20',
  },
  insightsSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    color: '#2e7d32',
    marginBottom: 4,
  },
  insightsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  insightsLine: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  insightsBullet: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    lineHeight: 20,
  },
  sectionSpacing: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 14, color: '#666' },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    maxWidth: '60%',
    textAlign: 'right',
  },
  healthBtn: {
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  healthBtnText: { color: '#1565c0', fontWeight: '700', fontSize: 15 },
  deleteBtn: {
    backgroundColor: '#fdecea',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#e53935', fontWeight: '700', fontSize: 15 },
  shareBtn: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareBtnText: { color: '#4CAF50', fontWeight: '700', fontSize: 15 },
});

export default PetDetailScreen;
