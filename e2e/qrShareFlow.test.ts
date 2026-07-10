import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

const TEST_TIMEOUT = 10000;

async function waitForPetList(): Promise<void> {
  await waitFor(element(by.id('pet-list-screen')))
    .toBeVisible()
    .withTimeout(TEST_TIMEOUT);
}

async function completeOnboardingIfNeeded(): Promise<void> {
  try {
    await waitForPetList();
    return;
  } catch {
    // App may start at onboarding/auth in a clean CI install. Complete the shortest happy path.
  }

  try {
    await waitFor(element(by.id('onboarding-screen')))
      .toBeVisible()
      .withTimeout(4000);
    await element(by.id('onboarding-next-button')).tap();
    await element(by.id('onboarding-next-button')).tap();
    await element(by.id('onboarding-get-started-button')).tap();
  } catch {
    // Already past onboarding.
  }

  try {
    await waitFor(element(by.id('register-screen')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('register-name-input')).replaceText('QR Flow Tester');
    await element(by.id('register-email-input')).replaceText(`qr-flow-${Date.now()}@cocohub.test`);
    await element(by.id('register-password-input')).replaceText('TestPass123!');
    await element(by.id('register-submit-button')).tap();
  } catch {
    // A seeded session may have skipped auth.
  }

  await waitForPetList();
}

async function createQrPet(): Promise<void> {
  await element(by.id('add-pet-button')).tap();
  await waitFor(element(by.id('pet-form-screen')))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.id('pet-name-input')).replaceText('QR Buddy');
  await element(by.id('pet-species-input')).replaceText('Dog');
  await element(by.id('pet-breed-input')).replaceText('Labrador');
  await element(by.id('pet-dob-input')).replaceText('2021-04-12');
  await element(by.id('pet-form-save-button')).tap();

  await waitForPetList();
  await waitFor(element(by.text('QR Buddy')))
    .toBeVisible()
    .withTimeout(TEST_TIMEOUT);
}

async function openRootQrScanner(): Promise<void> {
  await device.openURL({ url: 'cocohub://scan' });
  await waitFor(element(by.id('qr-scanner-screen')))
    .toBeVisible()
    .withTimeout(TEST_TIMEOUT);
}

describe('QR scan and share flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxSeed: 'test', detoxSkipOnboarding: 'true' },
      permissions: { camera: 'YES' },
    });
    await completeOnboardingIfNeeded();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('generates a QR code for a pet on PetShareScreen', async () => {
    await createQrPet();

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
      .withTimeout(TEST_TIMEOUT);
    await detoxExpect(element(by.id('pet-share-qr-image'))).toBeVisible();
    await detoxExpect(element(by.id('share-qr-code-button'))).toBeVisible();
    await detoxExpect(element(by.id('print-qr-code-button'))).toBeVisible();
    await detoxExpect(element(by.id('revoke-qr-code-button'))).toBeVisible();
  });

  it('opens manual entry fallback when scanning is cancelled', async () => {
    await openRootQrScanner();
    await element(by.id('qr-scanner-close-button')).tap();
    await waitForPetList();

    await openRootQrScanner();
    await element(by.id('qr-scanner-footer-manual-entry-button')).tap();

    await waitFor(element(by.id('manual-entry-screen')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('manual-entry-pet-id-input')).replaceText('pet-detox-manual');
    await detoxExpect(element(by.id('manual-entry-submit-button'))).toBeVisible();
    await element(by.id('manual-entry-clear-button')).tap();
    await element(by.id('manual-entry-close-button')).tap();
  });

  it('opens the QR scanner, performs a mock scan, and loads the scanned pet profile', async () => {
    await openRootQrScanner();
    await element(by.id('qr-scanner-mock-scan-button')).tap();

    await waitFor(element(by.id('pet-detail-screen')))
      .toBeVisible()
      .withTimeout(TEST_TIMEOUT);
    await detoxExpect(element(by.text('Detox QR Pet'))).toBeVisible();
  });
});
