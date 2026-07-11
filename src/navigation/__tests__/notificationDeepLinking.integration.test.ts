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

jest.mock('../../services/localDB', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

import { extractDeepLinkParams } from '../../services/notificationService';

describe('Notification Deep Linking - Navigation Integration', () => {
  describe('Cold-start and background routing', () => {
    const cases = [
      {
        label: 'medication reminder',
        data: {
          type: 'medication',
          medicationId: 'med-123',
          category: 'medication',
        },
        expected: {
          route: 'Care',
          params: { initialTab: 'Medications', medicationId: 'med-123' },
        },
      },
      {
        label: 'appointment reminder',
        data: {
          type: 'appointment',
          appointmentId: 'apt-456',
          category: 'appointments',
        },
        expected: {
          route: 'Schedule',
          params: { appointmentId: 'apt-456' },
        },
      },
      {
        label: 'vaccination reminder',
        data: {
          type: 'vaccination',
          vaccinationId: 'vac-789',
          petId: 'pet-001',
          dueDate: '2026-07-15',
          category: 'health',
        },
        expected: {
          route: 'Care',
          params: {
            initialTab: 'Vaccinations',
            vaccinationId: 'vac-789',
            petId: 'pet-001',
            dueDate: '2026-07-15',
          },
        },
      },
      {
        label: 'SOS alert',
        data: {
          type: 'sos',
          sosId: 'sos-911-emergency',
          category: 'health',
        },
        expected: {
          route: 'More',
          params: {
            screen: 'Emergency',
            params: { sosId: 'sos-911-emergency' },
          },
        },
      },
      {
        label: 'health alert',
        data: {
          type: 'alert',
          alertId: 'alert-001',
          petId: 'pet-alert-001',
          category: 'health',
        },
        expected: {
          route: 'Care',
          params: {
            initialTab: 'Alerts',
            alertId: 'alert-001',
            petId: 'pet-alert-001',
          },
        },
      },
      {
        label: 'community reply',
        data: {
          type: 'community_reply',
          postId: 'post-001',
          commentId: 'comment-002',
        },
        expected: {
          route: 'More',
          params: {
            screen: 'Community',
            params: {
              postId: 'post-001',
              commentId: 'comment-002',
            },
          },
        },
      },
    ];

    cases.forEach(({ label, data, expected }) => {
      it(`maps ${label} to a route registered under Main`, () => {
        expect(extractDeepLinkParams(data)).toEqual(expected);
      });
    });
  });

  describe('Parameter passing', () => {
    it('preserves appointment context for Schedule', () => {
      const appointmentId = 'apt-with-context';
      const deepLink = extractDeepLinkParams({
        type: 'appointment',
        appointmentId,
        category: 'appointments',
      });

      expect(deepLink?.route).toBe('Schedule');
      expect(deepLink?.params).toHaveProperty('appointmentId', appointmentId);
    });

    it('passes vaccination context through the Care tab route params', () => {
      const deepLink = extractDeepLinkParams({
        type: 'vaccination',
        vaccinationId: 'vac-full-context',
        petId: 'pet-context-001',
        dueDate: '2026-06-30',
        category: 'health',
      });

      expect(deepLink?.route).toBe('Care');
      expect(deepLink?.params).toEqual({
        initialTab: 'Vaccinations',
        vaccinationId: 'vac-full-context',
        petId: 'pet-context-001',
        dueDate: '2026-06-30',
      });
    });

    it('excludes extra unrelated data from params', () => {
      const deepLink = extractDeepLinkParams({
        type: 'medication',
        medicationId: 'med-clean',
        randomField: 'should-not-appear',
        title: 'should-not-appear',
        body: 'should-not-appear',
      });

      expect(deepLink?.params).toEqual({
        initialTab: 'Medications',
        medicationId: 'med-clean',
      });
      expect(deepLink?.params).not.toHaveProperty('randomField');
      expect(deepLink?.params).not.toHaveProperty('title');
    });
  });

  describe('Fallback behavior', () => {
    it('falls back to the PetDetail screen inside the PetList tab', () => {
      const deepLink = extractDeepLinkParams({
        type: 'unknown',
        petId: 'pet-fallback-001',
      });

      expect(deepLink).toEqual({
        route: 'PetList',
        params: {
          screen: 'PetDetail',
          params: { petId: 'pet-fallback-001' },
        },
      });
    });

    it('returns null for completely unknown notification data', () => {
      expect(extractDeepLinkParams({ type: 'unknown-type' })).toBeNull();
      expect(extractDeepLinkParams({})).toBeNull();
    });
  });
});
