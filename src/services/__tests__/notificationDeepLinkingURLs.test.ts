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

describe('Notification Deep Linking - URL-compatible routes', () => {
  it('builds navigation params for medication notification data', () => {
    expect(
      extractDeepLinkParams({
        type: 'medication',
        medicationId: 'med-123',
      }),
    ).toEqual({
      route: 'Care',
      params: { initialTab: 'Medications', medicationId: 'med-123' },
    });
  });

  it('builds navigation params for appointment notification data', () => {
    expect(
      extractDeepLinkParams({
        type: 'appointment',
        appointmentId: 'apt-456',
      }),
    ).toEqual({
      route: 'Schedule',
      params: { appointmentId: 'apt-456' },
    });
  });

  it('builds navigation params for vaccination notification data', () => {
    expect(
      extractDeepLinkParams({
        type: 'vaccination',
        vaccinationId: 'vac-789',
        petId: 'pet-001',
        dueDate: '2026-07-10',
      }),
    ).toEqual({
      route: 'Care',
      params: {
        initialTab: 'Vaccinations',
        vaccinationId: 'vac-789',
        petId: 'pet-001',
        dueDate: '2026-07-10',
      },
    });
  });

  it('builds navigation params for SOS notification data', () => {
    expect(
      extractDeepLinkParams({
        type: 'sos',
        sosId: 'sos-911',
      }),
    ).toEqual({
      route: 'More',
      params: {
        screen: 'Emergency',
        params: { sosId: 'sos-911' },
      },
    });
  });

  it('encodes special characters in URL query values', () => {
    const medicationId = 'med-001-with-special-chars-@-#-$';
    const encoded = encodeURIComponent(medicationId);

    expect(encoded).toBeTruthy();
    expect(encoded).not.toContain('@');
  });

  it('parses encoded query parameter values', () => {
    const id = 'med-with-special-@-#';
    const url = `cocohub://care?initialTab=Medications&medicationId=${encodeURIComponent(id)}`;
    const params = new URL(url).searchParams;

    expect(params.get('initialTab')).toBe('Medications');
    expect(params.get('medicationId')).toBe(id);
  });
});
