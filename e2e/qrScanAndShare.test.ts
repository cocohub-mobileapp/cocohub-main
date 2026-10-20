import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('QR Code Generation, Sharing and Scanner E2E Flow (#48)', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxSeed: 'test', detoxSkipOnboarding: 'true' },
    });
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('generates a QR code for a pet on PetShareScreen', async () => {
    await element(by.id('pet-card-0')).tap();
    await waitFor(element(by.id('share-pet-profile-button')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('share-pet-profile-button')).tap();
    await detoxExpect(element(by.id('pet-share-screen'))).toBeVisible();

    await element(by.id('generate-qr-button')).tap();
    await waitFor(element(by.id('qr-code-image')))
      .toBeVisible()
      .withTimeout(8000);

    await detoxExpect(element(by.id('share-qr-button'))).toBeVisible();
  });

  it('opens QR scanner, processes valid scan and loads pet profile', async () => {
    await element(by.id('qr-scan-tab')).tap();
    await detoxExpect(element(by.id('qr-scanner-screen'))).toBeVisible();

    await device.sendUserNotification({
      trigger: { type: 'push' },
      payload: {
        type: 'qr_mock_scan',
        data: 'cocohub://pet/pet-123?token=valid-qr-token',
      },
    });

    await waitFor(element(by.id('pet-detail-screen')))
      .toBeVisible()
      .withTimeout(8000);
  });

  it('supports manual entry fallback when QR scan is cancelled', async () => {
    await element(by.id('qr-scan-tab')).tap();
    await detoxExpect(element(by.id('qr-scanner-screen'))).toBeVisible();

    await element(by.id('manual-entry-button')).tap();
    await detoxExpect(element(by.id('manual-entry-modal'))).toBeVisible();

    await element(by.id('manual-entry-cancel-button')).tap();
    await detoxExpect(element(by.id('manual-entry-modal'))).not.toBeVisible();
    await detoxExpect(element(by.id('qr-scanner-screen'))).toBeVisible();
  });
});
