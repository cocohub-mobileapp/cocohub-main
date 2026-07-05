jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import apiClient from '../apiClient';
import { joinTelemedicineConsultation, recordConsultationConsent } from '../telemedicineService';

const mockedApi = apiClient as unknown as {
  post: jest.Mock;
};

describe('telemedicineService consultation APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('joins a WebRTC consultation room through the consultations endpoint', async () => {
    const room = {
      consultationId: 'consult-1',
      roomToken: 'room-token',
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      userId: 'owner-1',
      userRole: 'owner' as const,
    };
    mockedApi.post.mockResolvedValueOnce({ data: { data: room } });

    await expect(joinTelemedicineConsultation('consult-1')).resolves.toEqual(room);
    expect(mockedApi.post).toHaveBeenCalledWith('/consultations/consult-1/join', {});
  });

  it('records consultation recording consent through the authenticated API client', async () => {
    const consent = {
      consultationId: 'consult-1',
      recordingConsent: {
        ownerId: 'owner-1',
        vetId: 'vet-1',
        ownerConsented: true,
        vetConsented: false,
      },
      recordingEnabled: false,
    };
    mockedApi.post.mockResolvedValueOnce({ data: { data: consent } });

    await expect(recordConsultationConsent('consult-1')).resolves.toEqual(consent);
    expect(mockedApi.post).toHaveBeenCalledWith('/consultations/consult-1/consent', {});
  });
});
