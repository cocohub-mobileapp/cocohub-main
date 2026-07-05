/**
 * Widget Service
 *
 * Handles iOS WidgetKit and Android App Widget data updates.
 * Supports sharing widget data through app groups (iOS) and shared preferences (Android).
 *
 * Features:
 * - Fetches today's medication schedule
 * - Fetches upcoming appointments
 * - Calculates pet health scores
 * - Updates widget data on app foreground
 * - Listens to notification events
 */

import * as Notifications from 'expo-notifications';
import { AppState, NativeModules, Platform } from 'react-native';

import { getUpcomingAppointments } from './appointmentService';
import { getHealthMetrics } from './healthMetricService';
import { getItem, setItem } from './localDB';
import { getMedications } from './medicationService';
import petService from './petService';
import { syncWatchCompanionData } from './watchCompanionService';
import type { Appointment } from '../models/Appointment';
import type { HealthMetricEntry } from '../models/HealthMetric';
import type { Medication } from '../models/Medication';
import type { Pet } from '../models/Pet';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MedicationScheduleItem {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  petName: string;
  petId: string;
  scheduledTime?: string;
  frequency: number; // hours between doses
  taken: boolean;
}

export interface UpcomingAppointmentItem {
  id: string;
  title: string;
  date: string;
  time: string;
  petName: string;
  petId: string;
  vetName?: string;
  durationMinutes?: number;
}

export interface PetHealthScore {
  petId: string;
  petName: string;
  petSpecies: string;
  healthScore: number; // 0-100
  lastUpdated: string;
}

export interface WidgetData {
  medications: MedicationScheduleItem[];
  appointments: UpcomingAppointmentItem[];
  healthScores: PetHealthScore[];
  lastUpdated: string;
  timestamp: number; // milliseconds since epoch
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WIDGET_DATA_KEY = 'cocohub_widget_data';
const WIDGET_PREFS_KEY = 'widget_preferences';
const WIDGET_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ─── Native Module Setup ───────────────────────────────────────────────────────

const CocohubWidgetModule = Platform.select({
  ios: () => NativeModules.CocohubWidget || {},
  android: () => NativeModules.CocohubWidgetModule || {},
  default: () => ({}),
})();

// ─── Health Score Calculation ────────────────────────────────────────────────

/**
 * Calculate health score for a pet based on recent health metrics
 * Returns a score from 0-100 where 100 is perfect health
 */
async function calculatePetHealthScore(petId: string): Promise<number> {
  try {
    const metrics = await getHealthMetrics(petId);
    if (metrics.length === 0) return 75; // default middle score

    // Get the most recent metrics (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentMetrics = metrics.filter((m) => new Date(m.recordedAt) > sevenDaysAgo);

    if (recentMetrics.length === 0) return 75;

    let score = 100;

    // Deduct points based on activity level (aim for high activity)
    const avgActivityLevel =
      recentMetrics.reduce((sum, m) => {
        if (m.activityLevel === 'low') return sum + 1;
        if (m.activityLevel === 'moderate') return sum + 2;
        return sum + 3; // high
      }, 0) / recentMetrics.length;

    if (avgActivityLevel < 2)
      score -= 20; // Low activity
    else if (avgActivityLevel < 2.5) score -= 10; // Moderate activity

    // Check temperature variance (should be normal 37-39°C for most pets)
    const temps = recentMetrics.map((m) => m.temperatureC).filter((t) => t !== undefined);
    if (temps.length > 0) {
      const avgTemp = temps.reduce((a, b) => (a || 0) + (b || 0), 0) / temps.length;
      if (avgTemp && (avgTemp < 36 || avgTemp > 40)) {
        score -= 15;
      }
    }

    // Clamp score between 0-100
    return Math.max(0, Math.min(100, score));
  } catch (error) {
    console.error('[WidgetService] Error calculating health score:', error);
    return 75;
  }
}

// ─── Get Today's Medications ────────────────────────────────────────────────

async function getTodaysMedicationSchedule(): Promise<MedicationScheduleItem[]> {
  try {
    const medications = await getMedications();
    const pets = await petService.getAllPets();

    if (!medications.length) return [];

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const scheduleItems: MedicationScheduleItem[] = [];

    for (const med of medications) {
      // Check if medication is active today
      const startDate = new Date(med.startDate);
      const endDate = med.endDate ? new Date(med.endDate) : null;

      if (startDate > today || (endDate && endDate < today)) {
        continue;
      }

      // Find pet for this medication
      const pet = pets.find((p) => p.id === med.petId);
      if (!pet) continue;

      // Get dose logs for today to check if taken
      const doseLogsRaw = await getItem(`dose_logs_${med.id}`);
      const doseLogs = JSON.parse(doseLogsRaw ?? '[]') as { scheduledFor?: string }[];
      const takenToday = doseLogs.some((log) => log.scheduledFor?.startsWith(todayString));

      scheduleItems.push({
        id: `${med.id}_today`,
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage,
        petName: pet.name,
        petId: pet.id,
        frequency: med.frequency,
        taken: takenToday,
      });
    }

    return scheduleItems;
  } catch (error) {
    console.error('[WidgetService] Error fetching medications:', error);
    return [];
  }
}

// ─── Get Upcoming Appointments ──────────────────────────────────────────────

async function getUpcomingAppointmentsForWidget(): Promise<UpcomingAppointmentItem[]> {
  try {
    const pets = await petService.getAllPets();
    const appointments: UpcomingAppointmentItem[] = [];

    for (const pet of pets) {
      const petAppointments = await getUpcomingAppointments(pet.id);

      // Take only the next 3 appointments
      const upcoming = petAppointments.slice(0, 3);

      for (const apt of upcoming) {
        appointments.push({
          id: apt.id,
          title: apt.title,
          date: apt.date,
          time: apt.time || '00:00',
          petName: pet.name,
          petId: pet.id,
          vetName: apt.vet?.name,
          durationMinutes: apt.durationMinutes,
        });
      }
    }

    // Sort by date and time
    appointments.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });

    return appointments.slice(0, 5); // Return max 5 upcoming appointments
  } catch (error) {
    console.error('[WidgetService] Error fetching appointments:', error);
    return [];
  }
}

// ─── Get All Pets Health Scores ─────────────────────────────────────────────

async function getAllPetsHealthScores(): Promise<PetHealthScore[]> {
  try {
    const pets = await petService.getAllPets();
    const healthScores: PetHealthScore[] = [];

    for (const pet of pets) {
      const score = await calculatePetHealthScore(pet.id);
      healthScores.push({
        petId: pet.id,
        petName: pet.name,
        petSpecies: pet.species,
        healthScore: score,
        lastUpdated: new Date().toISOString(),
      });
    }

    return healthScores;
  } catch (error) {
    console.error('[WidgetService] Error fetching health scores:', error);
    return [];
  }
}

// ─── Main Widget Data Fetch ────────────────────────────────────────────────

async function fetchWidgetData(): Promise<WidgetData> {
  try {
    const [medications, appointments, healthScores] = await Promise.all([
      getTodaysMedicationSchedule(),
      getUpcomingAppointmentsForWidget(),
      getAllPetsHealthScores(),
    ]);

    const widgetData: WidgetData = {
      medications,
      appointments,
      healthScores,
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now(),
    };

    return widgetData;
  } catch (error) {
    console.error('[WidgetService] Error fetching widget data:', error);
    return {
      medications: [],
      appointments: [],
      healthScores: [],
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now(),
    };
  }
}

// ─── Update Widget Display ─────────────────────────────────────────────────

/**
 * Update widget display with latest data
 * Communicates with native widget code
 */
async function updateWidgetDisplay(data: WidgetData): Promise<void> {
  try {
    const dataJson = JSON.stringify(data);

    // Store in app local storage for widget to read
    await setItem(WIDGET_DATA_KEY, dataJson);

    if (Platform.OS === 'ios' && CocohubWidgetModule.updateWidget) {
      // iOS: Use WidgetKit to update
      await CocohubWidgetModule.updateWidget(data);
    } else if (Platform.OS === 'android' && CocohubWidgetModule.updateWidget) {
      // Android: Use App Widget manager to update
      await CocohubWidgetModule.updateWidget(data);
    }

    await syncWatchCompanionData(data);

    console.log('[WidgetService] Widget display updated successfully');
  } catch (error) {
    console.error('[WidgetService] Error updating widget display:', error);
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Refresh widget data and update displays
 * Call this when app comes to foreground or after notification receipt
 */
export async function refreshWidgetData(): Promise<void> {
  try {
    const data = await fetchWidgetData();
    await updateWidgetDisplay(data);
  } catch (error) {
    console.error('[WidgetService] Error refreshing widget data:', error);
  }
}

/**
 * Initialize widget service
 * Sets up listeners for app state changes and notifications
 */
export function initializeWidgetService(): () => void {
  // Initial refresh on init
  void refreshWidgetData();

  // Listen for app foreground events
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void refreshWidgetData();
    }
  });

  // Listen for notifications and update widgets
  const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      // Update widget data when notification is received
      const notificationData = response.notification.request.content.data;
      if (
        notificationData.type === 'medication' ||
        notificationData.type === 'appointment' ||
        notificationData.type === 'health'
      ) {
        void refreshWidgetData();
      }
    },
  );

  // Return cleanup function
  return () => {
    subscription.remove();
    notificationSubscription.remove();
  };
}

/**
 * Get cached widget data
 */
export async function getWidgetDataFromCache(): Promise<WidgetData | null> {
  try {
    const cached = await getItem(WIDGET_DATA_KEY);
    if (cached) {
      return JSON.parse(cached) as WidgetData;
    }
    return null;
  } catch (error) {
    console.error('[WidgetService] Error reading cached widget data:', error);
    return null;
  }
}

/**
 * Deep link handler for widget taps
 * Constructs navigation params from widget deep link data
 */
export function handleWidgetDeepLink(
  linkType: 'medication' | 'appointment' | 'health',
  targetId: string,
): { route: string; params?: Record<string, any> } {
  switch (linkType) {
    case 'medication':
      return {
        route: 'MedicationDetail',
        params: { medicationId: targetId },
      };
    case 'appointment':
      return {
        route: 'AppointmentDetail',
        params: { appointmentId: targetId },
      };
    case 'health':
      return {
        route: 'PetHealthDetails',
        params: { petId: targetId },
      };
    default:
      return {
        route: 'Home',
      };
  }
}

/**
 * Manual update trigger (for testing or force refresh)
 */
export async function forceWidgetUpdate(): Promise<void> {
  console.log('[WidgetService] Force widget update triggered');
  await refreshWidgetData();
}

// ─── Native Module Stubs ──────────────────────────────────────────────────

/**
 * Get widget ready state from native side
 */
export async function isWidgetAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios' && CocohubWidgetModule.isWidgetKitAvailable) {
      return await CocohubWidgetModule.isWidgetKitAvailable();
    }
    if (Platform.OS === 'android' && CocohubWidgetModule.isWidgetAvailable) {
      return await CocohubWidgetModule.isWidgetAvailable();
    }
    return false;
  } catch (error) {
    console.error('[WidgetService] Error checking widget availability:', error);
    return false;
  }
}

export default {
  refreshWidgetData,
  initializeWidgetService,
  getWidgetDataFromCache,
  handleWidgetDeepLink,
  forceWidgetUpdate,
  isWidgetAvailable,
};
