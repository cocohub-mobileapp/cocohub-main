/**
 * petBirthdayService.ts
 *
 * Schedules annual birthday notifications and age-based health milestone
 * reminders for each pet.
 *
 * Called from:
 *  - App.tsx on launch
 *  - After a pet is created or edited
 *
 * Uses expo-notifications scheduled local notifications.
 */

import * as Notifications from 'expo-notifications';

import type { Pet } from '../models/Pet';
import { getAllPets } from './petService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ageInYears(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 0;
  return (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Returns age-based health milestone messages for dogs/cats.
 * Returns null if no milestone applies this year.
 */
function getMilestoneMessage(pet: Pet): string | null {
  if (!pet.dateOfBirth) return null;
  const age = Math.floor(ageInYears(pet.dateOfBirth));

  // Universal milestones
  if (age === 1) return `${pet.name} turns 1! 🎉 Great time to schedule a general wellness check.`;
  if (age === 7 && (pet.species === 'dog' || pet.species === 'cat')) {
    return `${pet.name} enters senior years at 7. Consider a senior wellness panel with your vet.`;
  }
  if (age === 10) {
    return `${pet.name} is 10! Biannual vet visits are recommended for pets this age.`;
  }
  if (age % 5 === 0 && age > 0) {
    return `${pet.name}'s ${age}th birthday! Time for an annual check-up if not done yet.`;
  }
  return null;
}

/**
 * Computes the next birthday date for a pet starting from today.
 */
function nextBirthday(dateOfBirth: string): Date | null {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const now = new Date();
  const thisYearBirthday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate(), 9, 0, 0);

  if (thisYearBirthday > now) return thisYearBirthday;

  // Birthday already passed this year — schedule for next year
  return new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate(), 9, 0, 0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

const NOTIF_ID_PREFIX = 'pet_birthday_';
const MILESTONE_ID_PREFIX = 'pet_milestone_';

/**
 * Schedule (or reschedule) birthday + milestone notifications for all pets.
 * Safe to call multiple times — cancels existing before re-scheduling.
 */
export async function scheduleAllPetBirthdays(): Promise<void> {
  try {
    let pets: Pet[] = [];
    try {
      pets = await getAllPets();
    } catch {
      return; // No pets yet — skip
    }

    for (const pet of pets) {
      await schedulePetBirthday(pet);
    }
  } catch {
    // Non-critical — birthday reminders are best-effort
  }
}

/**
 * Schedule (or reschedule) birthday notification for a single pet.
 */
export async function schedulePetBirthday(pet: Pet): Promise<void> {
  if (!pet.dateOfBirth) return;

  const birthdayId = `${NOTIF_ID_PREFIX}${pet.id}`;
  const milestoneId = `${MILESTONE_ID_PREFIX}${pet.id}`;

  // Cancel existing notifications for this pet
  await Notifications.cancelScheduledNotificationAsync(birthdayId).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(milestoneId).catch(() => {});

  const birthday = nextBirthday(pet.dateOfBirth);
  if (!birthday) return;

  // Birthday notification
  await Notifications.scheduleNotificationAsync({
    identifier: birthdayId,
    content: {
      title: `🎂 Happy Birthday, ${pet.name}!`,
      body: `Today is ${pet.name}'s special day. Give them some extra love! 🐾`,
      data: { type: 'birthday', petId: pet.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: birthday,
    },
  }).catch(() => {});

  // Milestone notification (if applicable for the upcoming birthday age)
  const milestone = getMilestoneMessage(pet);
  if (milestone) {
    const milestoneDate = new Date(birthday.getTime() + 60 * 60 * 1000); // 1 hour after birthday notif
    await Notifications.scheduleNotificationAsync({
      identifier: milestoneId,
      content: {
        title: '🩺 Health milestone',
        body: milestone,
        data: { type: 'milestone', petId: pet.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: milestoneDate,
      },
    }).catch(() => {});
  }
}

/**
 * Cancel birthday notifications for a deleted pet.
 */
export async function cancelPetBirthday(petId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`${NOTIF_ID_PREFIX}${petId}`).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(`${MILESTONE_ID_PREFIX}${petId}`).catch(() => {});
}
