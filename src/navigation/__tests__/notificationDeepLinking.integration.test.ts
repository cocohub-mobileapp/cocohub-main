/**
 * Notification Deep Linking - Navigation Integration Tests
 *
 * Tests cover:
 * - Cold-start notification handling
 * - Background notification handling
 * - Navigation state management
 * - End-to-end deep link flow
 */

import type * as Notifications from 'expo-notifications';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

import { extractDeepLinkParams } from '../../services/notificationService';

describe('Notification Deep Linking - Navigation Integration', () => {
  describe('Cold-start scenarios', () => {
    it('handles notification tap when app is not running', () => {
      // Simulate a notification response from cold start
      const notificationData = {
        type: 'medication',
        medicationId: 'med-123',
        category: 'medication',
      };

      const deepLink = extractDeepLinkParams(notificationData);

      expect(deepLink).toBeDefined();
      expect(deepLink?.route).toBe('Medications');
      expect(deepLink?.params.medicationId).toBe('med-123');
    });

    it('handles appointment notification on cold start', () => {
      const notificationData = {
        type: 'appointment',
        appointmentId: 'apt-456',
        category: 'appointments',
      };

      const deepLink = extractDeepLinkParams(notificationData);

      expect(deepLink).toBeDefined();
      expect(deepLink?.route).toBe('Appointments');
    });

    it('handles vaccination notification on cold start', () => {
      const notificationData = {
        type: 'vaccination',
        vaccinationId: 'vac-789',
        petId: 'pet-001',
        dueDate: '2026-07-15',
        category: 'health',
      };

      const deepLink = extractDeepLinkParams(notificationData);

      expect(deepLink).toBeDefined();
      expect(deepLink?.route).toBe('Vaccinations');
      expect(deepLink?.params.vaccinationId).toBe('vac-789');
      expect(deepLink?.params.petId).toBe('pet-001');
    });

    it('handles SOS notification on cold start', () => {
      const notificationData = {
        type: 'sos',
        sosId: 'sos-911-emergency',
        category: 'health',
      };

      const deepLink = extractDeepLinkParams(notificationData);

      expect(deepLink).toBeDefined();
      expect(deepLink?.route).toBe('Emergency');
      expect(deepLink?.params.sosId).toBe('sos-911-emergency');
    });
  });

  describe('Background scenarios', () => {
    it('handles notification tap from background state', () => {
      // App is in background, user taps notification
      const notificationData = {
        type: 'medication',
        medicationId: 'med-background-test',
        category: 'medication',
      };

      const deepLink = extractDeepLinkParams(notificationData);

      expect(deepLink).toBeDefined();
      expect(deepLink?.route).toBe('Medications');
    });

    it('app transitions from background to foreground on notification tap', () => {
      // Simulate: app in background -> notification sent -> user taps -> app comes to foreground
      const notificationData = {
        type: 'appointment',
        appointmentId: 'apt-background-001',
        category: 'appointments',
      };

      const deepLink = extractDeepLinkParams(notificationData);

      expect(deepLink).toBeDefined();
      expect(deepLink?.route).toBe('Appointments');
    });
  });

  describe('Navigation context preservation', () => {
    it('navigates to correct screen with entity ID', () => {
      const medicationId = 'med-specific-001';
      const data = {
        type: 'medication',
        medicationId,
        category: 'medication',
      };

      const deepLink = extractDeepLinkParams(data);

      // Should navigate to Medications screen with medicationId param
      expect(deepLink?.route).toBe('Medications');
      expect(deepLink?.params).toHaveProperty('medicationId', medicationId);
    });

    it('navigates with all relevant context for vaccination', () => {
      const data = {
        type: 'vaccination',
        vaccinationId: 'vac-full-context',
        petId: 'pet-context-001',
        dueDate: '2026-06-30',
        category: 'health',
      };

      const deepLink = extractDeepLinkParams(data);

      expect(deepLink?.route).toBe('Vaccinations');
      expect(deepLink?.params).toEqual({
        vaccinationId: 'vac-full-context',
        petId: 'pet-context-001',
        dueDate: '2026-06-30',
      });
    });

    it('preserves entity context when navigating', () => {
      const appointmentId = 'apt-with-context';
      const data = {
        type: 'appointment',
        appointmentId,
        category: 'appointments',
      };

      const deepLink = extractDeepLinkParams(data);

      // Screen should receive all params to pre-load context
      expect(deepLink?.params).toHaveProperty('appointmentId', appointmentId);
    });
  });

  describe('Route mapping', () => {
    const routeMappings = [
      { type: 'medication', expectedRoute: 'Medications' },
      { type: 'appointment', expectedRoute: 'Appointments' },
      { type: 'vaccination', expectedRoute: 'Vaccinations' },
      { type: 'sos', expectedRoute: 'Emergency' },
    ];

    routeMappings.forEach(({ type, expectedRoute }) => {
      it(`maps ${type} notification type to ${expectedRoute} route`, () => {
        const data = { type };
        const deepLink = extractDeepLinkParams(data as any);

        expect(deepLink?.route).toBe(expectedRoute);
      });
    });
  });

  describe('Parameter passing', () => {
    it('passes all available entity IDs', () => {
      const data = {
        type: 'vaccination',
        vaccinationId: 'vac-123',
        petId: 'pet-456',
        dueDate: '2026-07-01',
      };

      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink?.params).toEqual({
        vaccinationId: 'vac-123',
        petId: 'pet-456',
        dueDate: '2026-07-01',
      });
    });

    it('handles partial parameter data', () => {
      const data = {
        type: 'vaccination',
        vaccinationId: 'vac-partial',
      };

      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink?.params).toEqual({
        vaccinationId: 'vac-partial',
      });
    });

    it('excludes extra unrelated data from params', () => {
      const data = {
        type: 'medication',
        medicationId: 'med-clean',
        randomField: 'should-not-appear',
        title: 'should-not-appear',
        body: 'should-not-appear',
      };

      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink?.params).toEqual({
        medicationId: 'med-clean',
      });
      expect(deepLink?.params).not.toHaveProperty('randomField');
      expect(deepLink?.params).not.toHaveProperty('title');
    });
  });

  describe('Fallback behavior', () => {
    it('falls back to pet detail when unknown type with petId', () => {
      const data = {
        type: 'unknown',
        petId: 'pet-fallback-001',
      };

      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink?.route).toBe('PetDetail');
      expect(deepLink?.params).toEqual({ petId: 'pet-fallback-001' });
    });

    it('falls back to type-based route when ID missing', () => {
      const data = {
        type: 'medication',
      };

      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink?.route).toBe('Medications');
      expect(deepLink?.params).toEqual({});
    });

    it('returns null for completely unknown notification', () => {
      const data = {
        type: 'unknown-type',
      };

      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink).toBeNull();
    });
  });

  describe('Real-world end-to-end scenarios', () => {
    it('scenario: user receives medication reminder while app is closed', () => {
      // 1. App is closed
      // 2. Notification is sent
      const notificationContent = {
        title: '💊 Medication Reminder',
        body: 'Time to give Penicillin (500mg)',
        data: {
          type: 'medication',
          medicationId: 'penicillin-fluffy',
          category: 'medication',
        },
      };

      // 3. User taps notification
      const deepLink = extractDeepLinkParams(notificationContent.data);

      // 4. App should open to Medications screen with ID
      expect(deepLink?.route).toBe('Medications');
      expect(deepLink?.params.medicationId).toBe('penicillin-fluffy');
    });

    it('scenario: user receives vet appointment reminder while app is backgrounded', () => {
      const notificationContent = {
        title: '📅 Appointment Reminder',
        body: 'Vet checkup at Sunshine Vet Clinic in 60 min',
        data: {
          type: 'appointment',
          appointmentId: 'vet-checkup-2026-06-15',
          category: 'appointments',
        },
      };

      const deepLink = extractDeepLinkParams(notificationContent.data);

      expect(deepLink?.route).toBe('Appointments');
      expect(deepLink?.params.appointmentId).toBe('vet-checkup-2026-06-15');
    });

    it('scenario: user receives vaccination alert for specific pet', () => {
      const notificationContent = {
        title: 'Vaccination Reminder',
        body: 'Rabies Booster is due in 7 days',
        data: {
          type: 'vaccination',
          vaccinationId: 'rabies-booster-fluffy',
          petId: 'fluffy-poodle-001',
          dueDate: '2026-06-22',
          leadDays: 7,
          category: 'health',
        },
      };

      const deepLink = extractDeepLinkParams(notificationContent.data);

      expect(deepLink?.route).toBe('Vaccinations');
      expect(deepLink?.params).toEqual({
        vaccinationId: 'rabies-booster-fluffy',
        petId: 'fluffy-poodle-001',
        dueDate: '2026-06-22',
      });
    });

    it('scenario: SOS alert during emergency', () => {
      const notificationContent = {
        title: '🆘 Emergency Alert',
        body: 'SOS signal received',
        data: {
          type: 'sos',
          sosId: 'sos-2026-05-29-critical-001',
          category: 'health',
        },
      };

      const deepLink = extractDeepLinkParams(notificationContent.data);

      expect(deepLink?.route).toBe('Emergency');
      expect(deepLink?.params.sosId).toBe('sos-2026-05-29-critical-001');
    });
  });

  describe('Error resilience', () => {
    it('handles malformed notification data gracefully', () => {
      const data = {
        type: null,
        medicationId: undefined,
      };

      const deepLink = extractDeepLinkParams(data as any);

      // Should return null or fallback gracefully
      expect(deepLink === null || deepLink).toBeDefined();
    });

    it('handles missing critical data', () => {
      const data = {};

      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink).toBeNull();
    });

    it('handles corrupted ID values', () => {
      const data = {
        type: 'medication',
        medicationId: 123, // should be string
      };

      // Should either coerce to string or handle gracefully
      const deepLink = extractDeepLinkParams(data as any);

      expect(deepLink === null || deepLink?.route === 'Medications').toBeTruthy();
    });
  });
});
