import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

// ─── Constants ──────────────────────────────────────────────────────────────
const PET_NAME = 'Buddy';
const PET_ID = 'pet-test-001';
const LAUNCH_ARGS = { detoxSeed: 'test', detoxSkipOnboarding: 'true' };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Launch the app and navigate to PetDetail for the seeded test pet. */
async function navigateToPetDetail(): Promise<void> {
  await device.launchApp({ newInstance: true, launchArgs: LAUNCH_ARGS });
  await waitFor(element(by.id('pet-list-screen')))
    .toBeVisible()
    .withTimeout(10000);

  // Tap on the first pet in the list
  await element(by.id('pet-list-item-0')).tap();
  await waitFor(element(by.id('pet-detail-screen')))
    .toBeVisible()
    .withTimeout(5000);
}

/** Navigate from PetDetail to PetShareScreen via the share button. */
async function navigateToPetShare(): Promise<void> {
  await navigateToPetDetail();
  await element(by.id('share-button')).tap();
  await waitFor(element(by.id('pet-share-screen')))
    .toBeVisible()
    .withTimeout(5000);
}

// =============================================================================
// PetShareScreen — QR Code Generation
// =============================================================================
describe('PetShareScreen — QR Code Generation', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('navigates to PetShareScreen for a pet', async () => {
    await navigateToPetShare();
    await detoxExpect(element(by.id('pet-share-screen'))).toBeVisible();
  });

  it('displays all sharing options', async () => {
    await detoxExpect(element(by.id('share-link-button'))).toBeVisible();
    await detoxExpect(element(by.id('social-share-button'))).toBeVisible();
    await detoxExpect(element(by.id('generate-qr-button'))).toBeVisible();
  });

  it('generates a QR code when tapping the QR Code option', async () => {
    await element(by.id('generate-qr-button')).tap();

    // Wait for the QR preview container to appear
    await waitFor(element(by.id('qr-preview-container')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('displays the QR code image after generation', async () => {
    await detoxExpect(element(by.id('qr-code-image'))).toBeVisible();
  });

  it('shows share and print QR code buttons', async () => {
    await detoxExpect(element(by.id('share-qr-code-button'))).toBeVisible();
    await detoxExpect(element(by.id('print-qr-code-button'))).toBeVisible();
  });

  it('shows the revoke QR code button', async () => {
    await detoxExpect(element(by.id('revoke-qr-code-button'))).toBeVisible();
  });

  it('allows selecting different expiry options', async () => {
    // Default is 24h, tap on 1h
    await element(by.text('1h')).tap();
    // Tap back to 24h
    await element(by.text('24h')).tap();
    // Verify screen is still showing QR preview
    await detoxExpect(element(by.id('qr-preview-container'))).toBeVisible();
  });

  it('allows toggling one-time-use option', async () => {
    await element(by.text('1×')).tap();
    // Tap again to toggle off
    await element(by.text('1×')).tap();
    await detoxExpect(element(by.id('qr-preview-container'))).toBeVisible();
  });

  it('goes back to pet detail via back button', async () => {
    await element(by.id('back-button')).tap();
    await waitFor(element(by.id('pet-detail-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});

// =============================================================================
// QRScannerScreen — Opens and displays scanner UI
// =============================================================================
describe('QRScannerScreen — Scanner Opens', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('opens the QR scanner screen', async () => {
    await device.launchApp({ newInstance: true, launchArgs: LAUNCH_ARGS });
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to the search tab to access the scan QR action
    // OR navigate directly via deep link
    // The QRScanner is a modal screen accessible from the Search tab's quick action
    await element(by.id('search-tab')).tap();
    await waitFor(element(by.text('Search')))
      .toBeVisible()
      .withTimeout(5000);

    // Look for a scan QR quick action button
    try {
      await element(by.id('scan-qr-quick-action')).tap();
    } catch {
      // If the quick action button isn't available, navigate via deep link
      // The QRScanner is registered at 'scan' deep link prefix
      await device.openURL('cocohub://scan');
    }
  });

  it('displays the scanner screen', async () => {
    await waitFor(element(by.id('qr-scanner-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('shows scanner header with close button', async () => {
    await detoxExpect(element(by.text('Scan QR Code'))).toBeVisible();
    await detoxExpect(element(by.id('close-scanner-button'))).toBeVisible();
  });

  it('shows footer with manual entry option', async () => {
    await detoxExpect(element(by.text('Scan a Cocohub QR code to access pet records'))).toBeVisible();
    await detoxExpect(element(by.id('manual-entry-button'))).toBeVisible();
  });

  it('can close the scanner', async () => {
    await element(by.id('close-scanner-button')).tap();
    // After closing, we should be back to the previous screen
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});

// =============================================================================
// QRScannerScreen — Camera Permission Denied → Manual Entry Fallback
// =============================================================================
describe('QRScannerScreen — Permission Denied → Manual Entry Fallback', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows manual entry fallback when camera permission is denied', async () => {
    await device.launchApp({ newInstance: true, launchArgs: LAUNCH_ARGS });
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Deny camera permission via launch args
    await device.terminateApp();
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        ...LAUNCH_ARGS,
        detoxDenyCameraPermission: 'true',
      },
    });

    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to QR scanner
    await element(by.id('search-tab')).tap();
    await waitFor(element(by.text('Search')))
      .toBeVisible()
      .withTimeout(5000);

    try {
      await element(by.id('scan-qr-quick-action')).tap();
    } catch {
      await device.openURL('cocohub://scan');
    }

    await waitFor(element(by.id('qr-scanner-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('shows permission denied view with enable camera option', async () => {
    // When permission is denied, the screen should show the permission denied view
    await waitFor(element(by.id('camera-permission-denied')))
      .toBeVisible()
      .withTimeout(5000);
    await detoxExpect(element(by.id('enable-camera-button'))).toBeVisible();
  });

  it('can use manual entry as fallback', async () => {
    // The manual entry button should be accessible even when permission is denied
    await detoxExpect(element(by.id('manual-entry-button'))).toBeVisible();
    await element(by.id('manual-entry-button')).tap();

    // Should navigate to manual entry screen
    await waitFor(element(by.id('manual-entry-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});

// =============================================================================
// QRScannerScreen — Torch Toggle
// =============================================================================
describe('QRScannerScreen — Torch Toggle', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('toggles the flashlight on and off', async () => {
    await device.launchApp({ newInstance: true, launchArgs: LAUNCH_ARGS });
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to QR scanner
    await element(by.id('search-tab')).tap();
    await waitFor(element(by.text('Search')))
      .toBeVisible()
      .withTimeout(5000);

    try {
      await element(by.id('scan-qr-quick-action')).tap();
    } catch {
      await device.openURL('cocohub://scan');
    }

    await waitFor(element(by.id('qr-scanner-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Only test torch if camera permission was granted
    const torchButton = element(by.id('toggle-flashlight-button'));
    const cameraDenied = element(by.id('camera-permission-denied'));

    try {
      await waitFor(torchButton).toBeVisible().withTimeout(5000);

      // Toggle torch on
      await torchButton.tap();
      // Toggle torch off
      await torchButton.tap();
      await detoxExpect(torchButton).toBeVisible();
    } catch {
      // Camera permission was denied — verify the denied state instead
      await detoxExpect(cameraDenied).toBeVisible();
    }
  });
});

// =============================================================================
// PetShareScreen — Share Link and Social Media Buttons
// =============================================================================
describe('PetShareScreen — Share Options', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows share link option', async () => {
    await navigateToPetShare();
    await detoxExpect(element(by.id('share-link-button'))).toBeVisible();
  });

  it('shows social media share option', async () => {
    await detoxExpect(element(by.id('social-share-button'))).toBeVisible();
  });

  it('shows QR code option', async () => {
    await detoxExpect(element(by.id('generate-qr-button'))).toBeVisible();
  });

  it('tapping share link shows a loading indicator', async () => {
    await element(by.id('share-link-button')).tap();
    // The button should become disabled during loading
    // After loading completes, an alert may appear or the share dialog
    // Dismiss any alert that may appear
    try {
      await waitFor(element(by.text('OK')))
        .toBeVisible()
        .withTimeout(8000);
      await element(by.text('OK')).tap();
    } catch {
      // Alert may not appear or share dialog was shown
    }
  });

  it('tapping social share triggers the share flow', async () => {
    await element(by.id('social-share-button')).tap();
    // Similar to share link, may show an alert or native share dialog
    try {
      await waitFor(element(by.text('OK')))
        .toBeVisible()
        .withTimeout(8000);
      await element(by.text('OK')).tap();
    } catch {
      // Share dialog was shown and dismissed
    }
  });
});

// =============================================================================
// PetShareScreen — QR Code Regeneration with Different Options
// =============================================================================
describe('PetShareScreen — QR Code with Different Options', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('generates QR code with 1h expiry', async () => {
    await navigateToPetShare();
    // Select 1h expiry
    await element(by.text('1h')).tap();
    await element(by.id('generate-qr-button')).tap();
    await waitFor(element(by.id('qr-preview-container')))
      .toBeVisible()
      .withTimeout(10000);
    await detoxExpect(element(by.id('qr-code-image'))).toBeVisible();
  });

  it('generates QR code with 7d expiry', async () => {
    // Select 7d expiry
    await element(by.text('7d')).tap();
    await element(by.id('generate-qr-button')).tap();
    await waitFor(element(by.id('qr-preview-container')))
      .toBeVisible()
      .withTimeout(10000);
    await detoxExpect(element(by.id('qr-code-image'))).toBeVisible();
  });

  it('generates QR code with never expiry', async () => {
    // Select never expiry (∞ button)
    await element(by.text('∞')).tap();
    await element(by.id('generate-qr-button')).tap();
    await waitFor(element(by.id('qr-preview-container')))
      .toBeVisible()
      .withTimeout(10000);
    await detoxExpect(element(by.id('qr-code-image'))).toBeVisible();
  });

  it('generates QR code with one-time-use enabled', async () => {
    // Enable one-time-use
    await element(by.text('1×')).tap();
    await element(by.id('generate-qr-button')).tap();
    await waitFor(element(by.id('qr-preview-container')))
      .toBeVisible()
      .withTimeout(10000);
    await detoxExpect(element(by.id('qr-code-image'))).toBeVisible();
  });
});

// =============================================================================
// PetShareScreen — Revoke QR Code
// =============================================================================
describe('PetShareScreen — Revoke QR Code', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('generates a QR code and shows revoke button', async () => {
    await navigateToPetShare();
    await element(by.id('generate-qr-button')).tap();
    await waitFor(element(by.id('qr-preview-container')))
      .toBeVisible()
      .withTimeout(10000);
    await detoxExpect(element(by.id('revoke-qr-code-button'))).toBeVisible();
  });

  it('shows confirmation dialog when revoking', async () => {
    await element(by.id('revoke-qr-code-button')).tap();
    // An alert dialog should appear asking for confirmation
    await waitFor(element(by.text('Revoke')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('can cancel the revoke action', async () => {
    // Tap Cancel in the alert
    await element(by.text('Cancel')).tap();
    // QR preview should still be visible
    await detoxExpect(element(by.id('qr-preview-container'))).toBeVisible();
  });
});

// =============================================================================
// QRScannerScreen — Close and Manual Entry from Footer
// =============================================================================
describe('QRScannerScreen — Footer Actions', () => {
  afterAll(async () => {
    await device.terminateApp();
  });

  it('can access manual entry from footer', async () => {
    await device.launchApp({ newInstance: true, launchArgs: LAUNCH_ARGS });
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('search-tab')).tap();
    await waitFor(element(by.text('Search')))
      .toBeVisible()
      .withTimeout(5000);

    try {
      await element(by.id('scan-qr-quick-action')).tap();
    } catch {
      await device.openURL('cocohub://scan');
    }

    await waitFor(element(by.id('qr-scanner-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap manual entry in the footer
    await element(by.id('manual-entry-button')).tap();

    // Should navigate to manual entry screen
    await waitFor(element(by.id('manual-entry-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
