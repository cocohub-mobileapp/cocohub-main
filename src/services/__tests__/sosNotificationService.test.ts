import * as Notifications from 'expo-notifications';

import sosNotificationService, { SOS_ACTION_IDENTIFIER } from '../sosNotificationService';

jest.mock('expo-notifications', () => require('../../__mocks__/expo-notifications'));

jest.mock('../emergencyService', () => ({
  getEmergencyContacts: jest.fn(() => Promise.resolve([{ id: 'c1', name: 'Vet' }])),
  triggerSOS: jest.fn(() => Promise.resolve({})),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: jest.fn() },
}));

import emergencyService from '../emergencyService';

describe('sosNotificationService (lock-screen SOS, issue #50)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    sosNotificationService.teardown();
  });

  it('requests permissions and registers an Android channel with public lock-screen visibility', async () => {
    await sosNotificationService.setup();

    expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'sos-emergency',
      expect.objectContaining({
        importance: Notifications.AndroidNotificationPriority.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      }),
    );
  });

  it('registers a notification category containing an SOS action', async () => {
    await sosNotificationService.setup();

    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
      'sos',
      expect.arrayContaining([
        expect.objectContaining({ identifier: SOS_ACTION_IDENTIFIER, buttonTitle: '🚨 SOS' }),
      ]),
    );
  });

  it('shows a persistent notification with the SOS category when contacts are configured', async () => {
    await sosNotificationService.refresh();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '🚨 SOS Emergency',
          categoryIdentifier: 'sos',
          sticky: true,
        }),
        trigger: null,
      }),
    );
  });

  it('does not show the notification when no contacts are configured', async () => {
    (emergencyService.getEmergencyContacts as jest.Mock).mockResolvedValueOnce([]);

    await sosNotificationService.refresh();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('fires SOS from the notification action without unlocking', async () => {
    await sosNotificationService.setup();

    const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
      .calls[0][0] as (response: unknown) => void;

    listener({ actionIdentifier: SOS_ACTION_IDENTIFIER });

    expect(emergencyService.triggerSOS).toHaveBeenCalledWith(
      'Pet emergency - need immediate help',
    );
  });

  it('fires SOS when the notification body is tapped (default action on the SOS category)', async () => {
    await sosNotificationService.setup();

    const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
      .calls[0][0] as (response: unknown) => void;

    listener({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: {
        request: { content: { categoryIdentifier: 'sos' } },
      },
    });

    expect(emergencyService.triggerSOS).toHaveBeenCalled();
  });

  it('does not fire SOS for unrelated notification actions', async () => {
    await sosNotificationService.setup();

    const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
      .calls[0][0] as (response: unknown) => void;

    listener({
      actionIdentifier: 'some-other-action',
      notification: { request: { content: { categoryIdentifier: 'other' } } },
    });

    expect(emergencyService.triggerSOS).not.toHaveBeenCalled();
  });

  it('removes the response listener on teardown', async () => {
    await sosNotificationService.setup();
    const { remove } = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
      .results[0].value as { remove: jest.Mock };

    sosNotificationService.teardown();

    expect(remove).toHaveBeenCalled();
  });
});
