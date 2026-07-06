import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

async function createPetForQrFlow() {
  await element(by.id('add-pet-button')).tap();
  await waitFor(element(by.id('pet-form-screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('pet-name-input')).replaceText('QR Buddy');
  await element(by.id('pet-species-input')).replaceText('Dog');
  await element(by.id('pet-breed-input')).replaceText('Labrador');
  await element(by.id('pet-dob-input')).replaceText('2021-04-12');
  await element(by.id('pet-form-save-button')).tap();

  await waitFor(element(by.id('pet-list-screen')))
    .toBeVisible()
    .withTimeout(8000);
  await waitFor(element(by.text('QR Buddy')))
    .toBeVisible()
    .withTimeout(5000);
}

async function openQrScanner() {
  await device.openURL({ url: 'cocohub://scan' });
  await waitFor(element(by.id('qr-scanner-screen')))
    .toBeVisible()
    .withTimeout(10000);
}

describe('QR Scan and Share Flow', () => {
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

  it('generates a QR code for a pet profile on the share screen', async () => {
    await createPetForQrFlow();
    await element(by.text('QR Buddy')).tap();
    await waitFor(element(by.id('pet-detail-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('share-pet-profile-button')).tap();
    await waitFor(element(by.id('pet-share-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('qr-expiry-7d')).tap();
    await element(by.id('qr-one-time-use-toggle')).tap();
    await element(by.id('generate-qr-code-button')).tap();

    await waitFor(element(by.id('pet-share-qr-preview')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.id('pet-share-qr-image'))).toBeVisible();
    await detoxExpect(element(by.id('share-qr-code-button'))).toBeVisible();
    await detoxExpect(element(by.id('print-qr-code-button'))).toBeVisible();
    await detoxExpect(element(by.id('revoke-qr-code-button'))).toBeVisible();
  });

  it('opens manual entry from the QR scanner fallback', async () => {
    await openQrScanner();
    await element(by.id('qr-scanner-footer-manual-entry-button')).tap();

    await waitFor(element(by.id('manual-entry-screen')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('manual-entry-pet-id-input')).replaceText('pet-detox-manual');
    await detoxExpect(element(by.id('manual-entry-submit-button'))).toBeVisible();
    await element(by.id('manual-entry-close-button')).tap();
  });

  it('loads a pet profile after a mocked QR scan', async () => {
    await openQrScanner();
    await element(by.id('qr-scanner-mock-scan-button')).tap();

    await waitFor(element(by.id('pet-detail-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await detoxExpect(element(by.text('Detox QR Pet'))).toBeVisible();
  });
});
