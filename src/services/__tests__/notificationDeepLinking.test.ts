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

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

import { extractDeepLinkParams } from '../notificationService';

describe('Notification Deep Linking', () => {
  describe('extractDeepLinkParams', () => {
    it('routes medication reminders to the Care medications tab', () => {
      const result = extractDeepLinkParams({
        type: 'medication',
        medicationId: 'med-123',
        category: 'medication',
      });

      expect(result).toEqual({
        route: 'Care',
        params: { initialTab: 'Medications', medicationId: 'med-123' },
      });
    });

    it('routes medication reminders without an ID to the medication list', () => {
      const result = extractDeepLinkParams({
        type: 'medication',
        category: 'medication',
      });

      expect(result).toEqual({
        route: 'Care',
        params: { initialTab: 'Medications' },
      });
    });

    it('routes appointment reminders to Schedule', () => {
      const result = extractDeepLinkParams({
        type: 'appointment',
        appointmentId: 'apt-456',
        category: 'appointments',
      });

      expect(result).toEqual({
        route: 'Schedule',
        params: { appointmentId: 'apt-456' },
      });
    });

    it('routes vaccination reminders to the Care vaccinations tab with context', () => {
      const result = extractDeepLinkParams({
        type: 'vaccination',
        vaccinationId: 'vac-789',
        petId: 'pet-001',
        dueDate: '2026-06-15',
        category: 'health',
      });

      expect(result).toEqual({
        route: 'Care',
        params: {
          initialTab: 'Vaccinations',
          vaccinationId: 'vac-789',
          petId: 'pet-001',
          dueDate: '2026-06-15',
        },
      });
    });

    it('routes vaccination reminders without an ID to the vaccinations tab', () => {
      const result = extractDeepLinkParams({
        type: 'vaccination',
        petId: 'pet-001',
        category: 'health',
      });

      expect(result).toEqual({
        route: 'Care',
        params: { initialTab: 'Vaccinations' },
      });
    });

    it('routes SOS notifications to the Emergency screen inside More', () => {
      const result = extractDeepLinkParams({
        type: 'sos',
        sosId: 'sos-911',
        category: 'health',
      });

      expect(result).toEqual({
        route: 'More',
        params: {
          screen: 'Emergency',
          params: { sosId: 'sos-911' },
        },
      });
    });

    it('routes health alerts to the Care alerts tab before pet fallback', () => {
      const result = extractDeepLinkParams({
        type: 'health_alert',
        alertId: 'alert-123',
        petId: 'pet-123',
        category: 'health',
      });

      expect(result).toEqual({
        route: 'Care',
        params: {
          initialTab: 'Alerts',
          alertId: 'alert-123',
          petId: 'pet-123',
        },
      });
    });

    it('routes community replies to the Community screen inside More', () => {
      const result = extractDeepLinkParams({
        type: 'community_reply',
        postId: 'post-123',
        replyId: 'reply-456',
      });

      expect(result).toEqual({
        route: 'More',
        params: {
          screen: 'Community',
          params: {
            postId: 'post-123',
            replyId: 'reply-456',
          },
        },
      });
    });

    it('falls back to PetDetail inside the PetList tab when only petId is usable', () => {
      const result = extractDeepLinkParams({
        type: 'unknown',
        petId: 'pet-fallback-001',
      });

      expect(result).toEqual({
        route: 'PetList',
        params: {
          screen: 'PetDetail',
          params: { petId: 'pet-fallback-001' },
        },
      });
    });

    it('returns null for unknown notification data without a fallback', () => {
      expect(extractDeepLinkParams({ type: 'unknown' })).toBeNull();
      expect(extractDeepLinkParams({})).toBeNull();
    });

    it('does not pass unrelated notification fields into route params', () => {
      const result = extractDeepLinkParams({
        type: 'medication',
        medicationId: 'med-clean',
        randomField: 'ignore-me',
        title: 'ignore-me',
        body: 'ignore-me',
      });

      expect(result?.params).toEqual({
        initialTab: 'Medications',
        medicationId: 'med-clean',
      });
      expect(result?.params).not.toHaveProperty('randomField');
      expect(result?.params).not.toHaveProperty('title');
    });
  });
});
