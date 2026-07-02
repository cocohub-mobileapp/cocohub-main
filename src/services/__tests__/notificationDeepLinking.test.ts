/**
 * Notification Deep Linking Integration Tests
 *
 * Tests cover:
 * - Deep link extraction from notification data
 * - Mapping notification types to routes and params
 * - Cold-start and background handling
 * - All notification types (medication, appointment, vaccination, SOS)
 */

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

import { extractDeepLinkParams } from '../notificationService';

describe('Notification Deep Linking', () => {
  describe('extractDeepLinkParams', () => {
    describe('Medication Notifications', () => {
      it('extracts medication notification with ID', () => {
        const data = {
          type: 'medication',
          medicationId: 'med-123',
          category: 'medication',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Medications',
          params: { medicationId: 'med-123' },
        });
      });

      it('extracts medication notification without ID', () => {
        const data = {
          type: 'medication',
          category: 'medication',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Medications',
          params: {},
        });
      });
    });

    describe('Appointment Notifications', () => {
      it('extracts appointment notification with ID', () => {
        const data = {
          type: 'appointment',
          appointmentId: 'apt-456',
          category: 'appointments',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Appointments',
          params: { appointmentId: 'apt-456' },
        });
      });

      it('extracts appointment notification without ID', () => {
        const data = {
          type: 'appointment',
          category: 'appointments',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Appointments',
          params: {},
        });
      });
    });

    describe('Vaccination Notifications', () => {
      it('extracts vaccination notification with all params', () => {
        const data = {
          type: 'vaccination',
          vaccinationId: 'vac-789',
          petId: 'pet-001',
          dueDate: '2026-06-15',
          category: 'health',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Vaccinations',
          params: {
            vaccinationId: 'vac-789',
            petId: 'pet-001',
            dueDate: '2026-06-15',
          },
        });
      });

      it('extracts vaccination notification without petId or dueDate', () => {
        const data = {
          type: 'vaccination',
          vaccinationId: 'vac-789',
          category: 'health',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Vaccinations',
          params: { vaccinationId: 'vac-789' },
        });
      });

      it('extracts vaccination notification without ID', () => {
        const data = {
          type: 'vaccination',
          petId: 'pet-001',
          category: 'health',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Vaccinations',
          params: { petId: 'pet-001' },
        });
      });
    });

    describe('SOS/Emergency Notifications', () => {
      it('extracts SOS notification with ID', () => {
        const data = {
          type: 'sos',
          sosId: 'sos-911',
          category: 'health',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Emergency',
          params: { sosId: 'sos-911' },
        });
      });

      it('extracts SOS notification without ID', () => {
        const data = {
          type: 'sos',
          category: 'health',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Emergency',
          params: {},
        });
      });
    });

    describe('Pet-based fallback', () => {
      it('falls back to PetDetail with petId when available', () => {
        const data = {
          type: 'health',
          petId: 'pet-123',
          category: 'health',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'PetDetail',
          params: { petId: 'pet-123' },
        });
      });
    });

    describe('Health alert notifications', () => {
      it('routes pet-specific health alerts to the pet health dashboard', () => {
        const data = {
          type: 'health_alert',
          category: 'health',
          alertId: 'alert-123',
          petId: 'pet-123',
          riskLevel: 'high',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'PetHealthDashboard',
          params: {
            alertId: 'alert-123',
            petId: 'pet-123',
            riskLevel: 'high',
          },
        });
      });

      it('routes health alerts without pet context to the alerts list', () => {
        const data = {
          type: 'health_alert',
          category: 'health',
          alertId: 'alert-456',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'HealthAlerts',
          params: { alertId: 'alert-456' },
        });
      });
    });

    describe('Community notifications', () => {
      it('routes community replies with post and reply context', () => {
        const data = {
          type: 'community_reply',
          category: 'community',
          postId: 'post-123',
          commentId: 'comment-456',
          replyId: 'reply-789',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Community',
          params: {
            postId: 'post-123',
            commentId: 'comment-456',
            replyId: 'reply-789',
          },
        });
      });
    });

    describe('Type-based fallback', () => {
      it('falls back to Medications when type is medication but no ID', () => {
        const data = {
          type: 'medication',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Medications',
          params: {},
        });
      });

      it('falls back to Appointments when type is appointment but no ID', () => {
        const data = {
          type: 'appointment',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Appointments',
          params: {},
        });
      });

      it('falls back to Vaccinations when type is vaccination but no ID', () => {
        const data = {
          type: 'vaccination',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Vaccinations',
          params: {},
        });
      });

      it('falls back to Emergency when type is sos but no ID', () => {
        const data = {
          type: 'sos',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Emergency',
          params: {},
        });
      });
    });

    describe('Default handling', () => {
      it('returns null for unknown notification type with no fallback', () => {
        const data = {
          type: 'unknown',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toBeNull();
      });

      it('returns null for empty data', () => {
        const data = {};

        const result = extractDeepLinkParams(data);

        expect(result).toBeNull();
      });
    });

    describe('Complex real-world scenarios', () => {
      it('handles medication reminder with full notification data', () => {
        const data = {
          type: 'medication',
          category: 'medication',
          medicationId: 'penicillin-001',
          title: '💊 Medication Reminder',
          body: 'Time to give Penicillin (500mg)',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Medications',
          params: { medicationId: 'penicillin-001' },
        });
      });

      it('handles appointment reminder with full notification data', () => {
        const data = {
          type: 'appointment',
          category: 'appointments',
          appointmentId: 'vet-checkup-2026-06',
          title: '📅 Appointment Reminder',
          body: 'Vet checkup at Sunshine Vet Clinic in 60 min',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Appointments',
          params: { appointmentId: 'vet-checkup-2026-06' },
        });
      });

      it('handles vaccination alert with all context', () => {
        const data = {
          type: 'vaccination',
          category: 'health',
          vaccinationId: 'rabies-booster-fluffy',
          petId: 'fluffy-001',
          dueDate: '2026-07-10',
          leadDays: 7,
          title: 'Vaccination Reminder',
          body: 'Rabies Booster is due in 7 days',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Vaccinations',
          params: {
            vaccinationId: 'rabies-booster-fluffy',
            petId: 'fluffy-001',
            dueDate: '2026-07-10',
          },
        });
      });

      it('handles SOS/emergency alert', () => {
        const data = {
          type: 'sos',
          category: 'health',
          sosId: 'sos-2026-05-29-001',
          petId: 'pet-emergency-001',
          title: '🆘 Emergency Alert',
          body: 'SOS signal received',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Emergency',
          params: { sosId: 'sos-2026-05-29-001' },
        });
      });
    });

    describe('Edge cases', () => {
      it('handles null values in data', () => {
        const data = {
          type: 'medication',
          medicationId: null,
        };

        const result = extractDeepLinkParams(data);

        // Should fall back to type-based routing
        expect(result).toEqual({
          route: 'Medications',
          params: {},
        });
      });

      it('handles undefined values in data', () => {
        const data = {
          type: 'appointment',
          appointmentId: undefined,
        };

        const result = extractDeepLinkParams(data);

        // Should fall back to type-based routing
        expect(result).toEqual({
          route: 'Appointments',
          params: {},
        });
      });

      it('handles empty string IDs', () => {
        const data = {
          type: 'vaccination',
          vaccinationId: '',
        };

        const result = extractDeepLinkParams(data);

        // Empty string is falsy, should fall back to type-based routing
        expect(result).toEqual({
          route: 'Vaccinations',
          params: {},
        });
      });

      it('prioritizes explicit ID over petId fallback', () => {
        const data = {
          type: 'medication',
          medicationId: 'med-explicit',
          petId: 'pet-001',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Medications',
          params: { medicationId: 'med-explicit' },
        });
      });

      it('handles special characters in IDs', () => {
        const data = {
          type: 'medication',
          medicationId: 'med-001:special-chars-@-#',
        };

        const result = extractDeepLinkParams(data);

        expect(result).toEqual({
          route: 'Medications',
          params: { medicationId: 'med-001:special-chars-@-#' },
        });
      });
    });
  });
});
