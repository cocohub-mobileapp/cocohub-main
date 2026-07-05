/**
 * Watch companion service
 *
 * Builds the compact health glance payload used by the watchOS companion app and
 * sends it through the native iOS WatchConnectivity bridge when available.
 */

import { NativeModules, Platform } from 'react-native';

import type { WidgetData } from './widgetService';

export interface WatchCompanionGlanceData {
  activePet: {
    petId: string;
    petName: string;
    petSpecies?: string;
    healthScore: number;
  } | null;
  nextMedication: {
    id: string;
    medicationId: string;
    medicationName: string;
    dosage: string;
    petName: string;
    petId: string;
    scheduledTime?: string;
    deepLink: string;
  } | null;
  nextAppointment: {
    id: string;
    title: string;
    date: string;
    time: string;
    petName: string;
    petId: string;
    deepLink: string;
  } | null;
  healthDeepLink: string | null;
  emergencyDeepLink: string;
  generatedAt: string;
}

const CocohubWidgetModule = Platform.select({
  ios: () => NativeModules?.CocohubWidget || {},
  default: () => ({}),
})();

function appLink(path: string, id?: string): string {
  return id ? `cocohub://${path}/${encodeURIComponent(id)}` : `cocohub://${path}`;
}

export function buildWatchCompanionGlance(data: WidgetData): WatchCompanionGlanceData {
  const nextMedication = data.medications.find((med) => !med.taken) ?? data.medications[0] ?? null;
  const nextAppointment = data.appointments[0] ?? null;
  const activeHealth =
    data.healthScores.find((score) => score.petId === nextMedication?.petId) ??
    data.healthScores.find((score) => score.petId === nextAppointment?.petId) ??
    data.healthScores[0] ??
    null;

  return {
    activePet: activeHealth
      ? {
          petId: activeHealth.petId,
          petName: activeHealth.petName,
          petSpecies: activeHealth.petSpecies,
          healthScore: activeHealth.healthScore,
        }
      : null,
    nextMedication: nextMedication
      ? {
          id: nextMedication.id,
          medicationId: nextMedication.medicationId,
          medicationName: nextMedication.medicationName,
          dosage: nextMedication.dosage,
          petName: nextMedication.petName,
          petId: nextMedication.petId,
          scheduledTime: nextMedication.scheduledTime,
          deepLink: appLink('medications', nextMedication.medicationId),
        }
      : null,
    nextAppointment: nextAppointment
      ? {
          id: nextAppointment.id,
          title: nextAppointment.title,
          date: nextAppointment.date,
          time: nextAppointment.time,
          petName: nextAppointment.petName,
          petId: nextAppointment.petId,
          deepLink: appLink('appointments', nextAppointment.id),
        }
      : null,
    healthDeepLink: activeHealth ? appLink('health', activeHealth.petId) : null,
    emergencyDeepLink: appLink('sos'),
    generatedAt: data.lastUpdated,
  };
}

export async function syncWatchCompanionData(data: WidgetData): Promise<void> {
  if (Platform.OS !== 'ios' || !CocohubWidgetModule.updateWatchCompanion) {
    return;
  }

  const glance = buildWatchCompanionGlance(data);
  await CocohubWidgetModule.updateWatchCompanion(glance);
}

export async function isWatchCompanionAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !CocohubWidgetModule.isWatchCompanionAvailable) {
    return false;
  }

  return Boolean(await CocohubWidgetModule.isWatchCompanionAvailable());
}

export default {
  buildWatchCompanionGlance,
  syncWatchCompanionData,
  isWatchCompanionAvailable,
};
