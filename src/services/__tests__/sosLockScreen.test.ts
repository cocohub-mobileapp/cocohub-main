/**
 * Structural acceptance for #50: SOS action ids and channel constants.
 */
import {
  SOS_ACTION_ID,
  SOS_CATEGORY_ID,
  SOS_CHANNEL_ID,
  SOS_NOTIFICATION_ID,
} from '../sosLockScreen';

describe('sosLockScreen constants (#50)', () => {
  it('exports stable identifiers for Android SOS notification', () => {
    expect(SOS_CHANNEL_ID).toBe('cocohub-sos-lockscreen');
    expect(SOS_CATEGORY_ID).toBe('sos_lockscreen');
    expect(SOS_ACTION_ID).toBe('TRIGGER_SOS');
    expect(SOS_NOTIFICATION_ID).toBe('cocohub-sos-persistent');
  });
});
