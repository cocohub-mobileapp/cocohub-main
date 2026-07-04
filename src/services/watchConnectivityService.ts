import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';

import emergencyService from './emergencyService';
import { getHealthMetrics } from './healthMetricService';
import {
  getDoseLogs,
  getDoseStatus,
  getMedications,
  getUpcomingDoseTimes,
  isMedicationActive,
  type DoseLog,
  type Medication,
} from './medicationService';
import petService, { type Pet } from './petService';

const SELECTED_PET_ID_STORAGE_KEY = '@selected_pet_id';
const DEFAULT_HEALTH_SCORE = 75;

export interface WatchDoseSummary {
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledFor: string;
  displayTime: string;
}

export interface WatchPetSummary {
  petId: string;
  petName: string;
  petSpecies: string;
  healthScore: number;
  healthStatus: 'good' | 'watch' | 'urgent';
  nextDose: WatchDoseSummary | null;
  lastUpdated: string;
  emergencyMessage: string;
}

interface CocohubWatchConnectivityModule {
  activate?: () => Promise<boolean>;
  isWatchAvailable?: () => Promise<boolean>;
  updateApplicationContext?: (payload: WatchPetSummary) => Promise<boolean>;
}

const WatchConnectivityModule: CocohubWatchConnectivityModule | undefined =
  Platform.OS === 'ios' ? NativeModules.CocohubWatchConnectivity : undefined;

export function resolveActivePet(pets: Pet[], selectedPetId?: string | null): Pet | null {
  if (pets.length === 0) return null;
  return pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
}

export function getWatchHealthStatus(score: number): WatchPetSummary['healthStatus'] {
  if (score < 50) return 'urgent';
  if (score < 75) return 'watch';
  return 'good';
}

export function formatWatchDoseTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function selectNextDoseForPet(
  medications: Medication[],
  doseLogs: DoseLog[],
  petId: string,
  now = new Date(),
): WatchDoseSummary | null {
  const candidates = medications
    .filter((medication) => medication.petId === petId && isMedicationActive(medication, now))
    .flatMap((medication) =>
      getUpcomingDoseTimes(medication, 7, now)
        .filter(
          (scheduledFor) => getDoseStatus(medication.id, scheduledFor, doseLogs) === 'pending',
        )
        .map((scheduledFor) => ({ medication, scheduledFor })),
    )
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

  const next = candidates[0];
  if (!next) return null;

  return {
    medicationId: next.medication.id,
    medicationName: next.medication.name,
    dosage: next.medication.dosage,
    scheduledFor: next.scheduledFor.toISOString(),
    displayTime: formatWatchDoseTime(next.scheduledFor),
  };
}

async function calculatePetHealthScore(petId: string): Promise<number> {
  try {
    const metrics = await getHealthMetrics(petId);
    if (metrics.length === 0) return DEFAULT_HEALTH_SCORE;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMetrics = metrics.filter((metric) => new Date(metric.recordedAt) > sevenDaysAgo);
    if (recentMetrics.length === 0) return DEFAULT_HEALTH_SCORE;

    let score = 100;
    const activityValues = recentMetrics
      .map((metric) => {
        if (metric.activityLevel === 'low') return 1;
        if (metric.activityLevel === 'moderate') return 2;
        if (metric.activityLevel === 'high') return 3;
        return undefined;
      })
      .filter((value): value is 1 | 2 | 3 => value !== undefined);

    if (activityValues.length > 0) {
      const averageActivity =
        activityValues.reduce((sum, value) => sum + value, 0) / activityValues.length;
      if (averageActivity < 2) score -= 20;
      else if (averageActivity < 2.5) score -= 10;
    }

    const temperatures = recentMetrics
      .map((metric) => metric.temperatureC)
      .filter((value): value is number => value !== undefined);

    if (temperatures.length > 0) {
      const averageTemperature =
        temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length;
      if (averageTemperature < 36 || averageTemperature > 40) score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  } catch {
    return DEFAULT_HEALTH_SCORE;
  }
}

export async function buildWatchPetSummary(): Promise<WatchPetSummary | null> {
  const [pets, selectedPetId] = await Promise.all([
    petService.getAllPets(),
    AsyncStorage.getItem(SELECTED_PET_ID_STORAGE_KEY).catch(() => null),
  ]);
  const activePet = resolveActivePet(pets, selectedPetId);
  if (!activePet) return null;

  const [healthScore, medications, doseLogs] = await Promise.all([
    calculatePetHealthScore(activePet.id),
    getMedications(),
    getDoseLogs(),
  ]);

  return {
    petId: activePet.id,
    petName: activePet.name,
    petSpecies: activePet.species,
    healthScore,
    healthStatus: getWatchHealthStatus(healthScore),
    nextDose: selectNextDoseForPet(medications, doseLogs, activePet.id),
    lastUpdated: new Date().toISOString(),
    emergencyMessage: 'Pet emergency - need immediate help',
  };
}

export async function refreshWatchConnectivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !WatchConnectivityModule?.updateApplicationContext) return;

  const summary = await buildWatchPetSummary();
  if (!summary) return;

  await WatchConnectivityModule.updateApplicationContext(summary);
}

export async function isWatchConnectivityAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !WatchConnectivityModule?.isWatchAvailable) return false;
  try {
    return await WatchConnectivityModule.isWatchAvailable();
  } catch {
    return false;
  }
}

async function activateWatchConnectivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !WatchConnectivityModule?.activate) return;
  try {
    await WatchConnectivityModule.activate();
  } catch {
    // Watch support is optional. The phone app must keep working without it.
  }
}

function subscribeToWatchSOS(): EmitterSubscription | null {
  if (Platform.OS !== 'ios' || !WatchConnectivityModule) return null;

  const emitterModule = WatchConnectivityModule as CocohubWatchConnectivityModule & {
    addListener: (eventName: string) => void;
    removeListeners: (count: number) => void;
  };
  const emitter = new NativeEventEmitter(emitterModule);
  return emitter.addListener('CocohubWatchSOS', (event?: { message?: string }) => {
    void emergencyService.triggerSOS(event?.message ?? 'Pet emergency - need immediate help');
  });
}

export function initializeWatchConnectivityService(): () => void {
  void activateWatchConnectivity();
  void refreshWatchConnectivity();

  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void refreshWatchConnectivity();
  });

  const sosSubscription = subscribeToWatchSOS();

  return () => {
    appStateSubscription.remove();
    sosSubscription?.remove();
  };
}

export default {
  buildWatchPetSummary,
  initializeWatchConnectivityService,
  isWatchConnectivityAvailable,
  refreshWatchConnectivity,
};
