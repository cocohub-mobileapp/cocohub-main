/**
 * haptics.ts
 *
 * Thin wrapper around expo-haptics that degrades gracefully when haptics
 * are unavailable (web, older devices, simulator).
 *
 * Usage:
 *   import haptics from '../utils/haptics';
 *   haptics.light();      // tap feedback
 *   haptics.success();    // success confirmation
 *   haptics.warning();    // warning alert
 *   haptics.error();      // error / destructive action
 *   haptics.heavy();      // SOS / urgent action
 */

import { Platform } from 'react-native';

// Lazily require expo-haptics to avoid crashing on web or when module is absent
let Haptics: {
  impactAsync: (style: string) => Promise<void>;
  notificationAsync: (type: string) => Promise<void>;
  selectionAsync: () => Promise<void>;
  ImpactFeedbackStyle: { Light: string; Medium: string; Heavy: string };
  NotificationFeedbackType: { Success: string; Warning: string; Error: string };
} | null = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Haptics = require('expo-haptics');
  } catch {
    Haptics = null;
  }
}

async function safe(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Haptics are non-critical — swallow all errors
  }
}

const haptics = {
  /** Light tap — used for most button presses */
  light: () =>
    safe(async () => {
      if (Haptics)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }),

  /** Medium tap — used for selections and toggles */
  medium: () =>
    safe(async () => {
      if (Haptics)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }),

  /** Heavy tap — used for SOS, urgent actions */
  heavy: () =>
    safe(async () => {
      if (Haptics)
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }),

  /** Success notification pulse — dose logged, record saved, etc. */
  success: () =>
    safe(async () => {
      if (Haptics)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }),

  /** Warning pulse — drug interaction detected, low supply, etc. */
  warning: () =>
    safe(async () => {
      if (Haptics)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }),

  /** Error pulse — failed save, auth error, etc. */
  error: () =>
    safe(async () => {
      if (Haptics)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }),

  /** Selection click — tab change, pet selector tap */
  selection: () =>
    safe(async () => {
      if (Haptics)
        await Haptics.selectionAsync();
    }),
};

export default haptics;
