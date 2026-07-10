import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { HeaderOfflineStatus, useOfflineStatus } from '../components/OfflineIndicator';
import { OptimizedImage } from '../components/OptimizedImage';
import PaywallModal from '../components/PaywallModal';
import PetAggregateView from '../components/PetAggregateView';
import PetSelectorBar from '../components/PetSelectorBar';
import PressableCard from '../components/PressableCard';
import { RetryError } from '../components/RetryError';
import { SkeletonCard } from '../components/SkeletonCard';
import SOSButton from '../components/SOSButton';
import { usePetContext } from '../context/PetContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useMinimumLoadingTime } from '../hooks/useMinimumLoadingTime';
import { useStaggeredAnimation } from '../hooks/useStaggeredAnimation';
import petService, { type Pet } from '../services/petService';
import subscriptionService, { type SubscriptionStatus } from '../services/subscriptionService';
import { useRetry } from '../utils/useRetry';

interface Props {
  onSelectPet: (pet: Pet) => void;
  onAddPet: () => void;
  onAdoptPet: () => void;
}

const PetListScreen: React.FC<Props> = ({ onSelectPet, onAddPet, onAdoptPet }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  const offlineStatus = useOfflineStatus();
  const { refreshPets } = usePetContext();
  const { colors } = useTheme();
  const { show: showToast } = useToast();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isPremium: false,
    plan: 'free',
    expiresAt: null,
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPets = useCallback(async () => {
    const data = await petService.getAllPets();
    setPets(data);
    return data;
  }, []);

  const [retryState, execute, reset] = useRetry(loadPets, {
    maxRetries: 3,
    autoRetry: false,
  });

  // Enforce minimum 300ms display for skeleton
  const displayLoading = useMinimumLoadingTime(retryState.loading, { minLoadingTime: 300 });

  useEffect(() => {
    void execute();
  }, [execute]);

  useEffect(() => {
    subscriptionService
      .fetchBackendStatus()
      .then(setSubscriptionStatus)
      .catch(() => {
        /* keep free default */
      });
  }, []);

  const getAnimStyle = useStaggeredAnimation(pets.length, { stagger: 40 });

  const hasData = pets.length > 0;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const result = await execute();
    void refreshPets();

    // If the refresh failed but we already had data on screen, don't let
    // the inline RetryError replace the list — surface a toast instead and
    // keep showing the cached pets.
    if (result === undefined && hasData) {
      showToast("Couldn't refresh — showing cached data", { variant: 'error' });
    }
    setIsRefreshing(false);
  }, [execute, refreshPets, hasData, showToast]);

  const handleAddPet = useCallback(() => {
    const atLimit =
      !subscriptionStatus.isPremium && pets.length >= subscriptionService.FREE_PET_LIMIT;
    if (atLimit) {
      setShowPaywall(true);
    } else {
      onAddPet();
    }
  }, [subscriptionStatus.isPremium, pets.length, onAddPet]);

  // card: padding 12 top + 12 bottom + avatar 56 + marginBottom 10 = 90
  const ITEM_HEIGHT = 90;
  const getItemLayout = useCallback(
    (_: ArrayLike<Pet> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Pet; index: number }) => (
      <Animated.View style={getAnimStyle(index)}>
        <PressableCard onPress={() => onSelectPet(item)} style={styles.card} elevation={1}>
          <View style={styles.cardInner}>
            {item.photoUrl || item.thumbnailUrl ? (
              <OptimizedImage
                uri={item.thumbnailUrl || item.photoUrl || ''}
                style={styles.avatar}
                accessibilityLabel={`${item.name} photo`}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarEmoji}>🐾</Text>
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={[styles.petName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.petMeta, { color: colors.secondaryText }]}>
                {item.species}
                {item.breed ? ` · ${item.breed}` : ''}
              </Text>
              {item.dateOfBirth && (
                <Text style={[styles.petMeta, { color: colors.secondaryText }]}>
                  Born: {new Date(item.dateOfBirth).toLocaleDateString()}
                </Text>
              )}
              {!offlineStatus?.isOnline ? <Text style={styles.cachedChip}>Cached</Text> : null}
            </View>
            <Text style={[styles.chevron, { color: colors.border }]}>›</Text>
          </View>
        </PressableCard>
      </Animated.View>
    ),
    [onSelectPet, offlineStatus?.isOnline, getAnimStyle, colors],
  );

  return (
    <View style={styles.container} testID="pet-list-screen">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Pets</Text>
          <HeaderOfflineStatus />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleAddPet}
          accessibilityRole="button"
          accessibilityLabel="Add pet"
          accessibilityHint="Adds a new pet"
          testID="add-pet-button"
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.adoptBtn}
          onPress={onAdoptPet}
          accessibilityRole="button"
          accessibilityLabel="Adopt pet"
          accessibilityHint="Browse shelter pets"
        >
          <Text style={styles.adoptBtnText}>Adopt</Text>
        </TouchableOpacity>
      </View>

      {/* Pet selector bar — Issue #151/#82 */}
      <PetSelectorBar onAddPet={handleAddPet} />

      {!offlineStatus?.isOnline ? (
        <View style={styles.cachedBanner}>
          <Text style={styles.cachedBannerText}>Showing cached pets while offline.</Text>
        </View>
      ) : null}

      {/* Aggregate view — Issue #151/#82 */}
      <PetAggregateView onSelectPet={onSelectPet} />

      {retryState.error && !hasData ? (
        <RetryError
          error={retryState.error}
          onRetry={() => {
            reset();
            void execute();
          }}
          retryCount={retryState.retryCount}
          maxRetries={3}
        />
      ) : displayLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentContainerStyle={[styles.list, !hasData && styles.emptyList]}
          ListEmptyComponent={
            <EmptyState
              icon="paw"
              title="Start your pet care hub"
              description="Create your first pet profile to track records, reminders, emergency details, and wellness history in one place."
              buttonText="Add your first pet"
              onPress={handleAddPet}
              secondaryText="Browse adoptable pets"
              onSecondaryPress={onAdoptPet}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}

      <SOSButton style={styles.floatingSOS} />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribed={(status) => {
          setSubscriptionStatus(status);
          setShowPaywall(false);
          onAddPet();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  adoptBtn: {
    marginLeft: 10,
    backgroundColor: '#12372a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adoptBtnText: { color: '#fff', fontWeight: '600' },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  emptyList: { flexGrow: 1 },
  cachedBanner: {
    backgroundColor: '#fff3e0',
    borderBottomWidth: 1,
    borderBottomColor: '#ffe0b2',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cachedBannerText: { color: '#a54900', fontSize: 12, fontWeight: '600' },
  card: {
    marginBottom: 10,
    padding: 12,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  petName: { fontSize: 16, fontWeight: '700' },
  petMeta: { fontSize: 13, marginTop: 2 },
  cachedChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: '#a54900',
    backgroundColor: '#fff3e0',
    borderColor: '#ed6c02',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chevron: { fontSize: 22 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
  floatingSOS: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    margin: 0,
    zIndex: 10,
  },
});

export default PetListScreen;
