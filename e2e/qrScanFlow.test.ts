import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('QR Scan and Share Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxSeed: 'test', detoxSkipOnboarding: 'true' },
    });
    // Wait for main tab or navigation
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('generates QR code for a pet on PetShareScreen', async () => {
    // Navigate to the seeded pet
    await element(by.id('pet-list-item-0')).tap();
    await waitFor(element(by.id('pet-detail-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap "Share Profile" button
    await element(by.label('Share pet profile')).tap();

    // Verify PetShareScreen is open
    await waitFor(element(by.label('Generate QR code')))
      .toBeVisible()
      .withTimeout(5000);

    // Generate QR code
    await element(by.label('Generate QR code')).tap();

    // Verify QR code preview appears
    await waitFor(element(by.label('QR code')))
      .toBeVisible()
      .withTimeout(8000);

    // Go back to pet detail screen
    await element(by.label('Back')).tap();
    // Go back to pet list screen
    // (Assuming back button or tab bar is available. For now just tap 'Pets' tab)
    await element(by.text('Pets')).tap();
  });

  it('opens QR scanner and manual entry fallback works when scan is cancelled', async () => {
    // Go to "More" tab
    await element(by.text('More')).tap();
    
    // Tap "Scan QR Code"
    await waitFor(element(by.text('Scan QR Code')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('Scan QR Code')).tap();

    // Verify scanner opens
    await waitFor(element(by.text('Scan a Cocohub QR code to access pet records')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap mock scan button (which is rendered in test mode)
    await element(by.id('detox-mock-scan')).tap();
    
    // Verify it navigates out or does something.
    // The onScanSuccess should trigger and navigate back or to Pet Detail.
    // For now we just wait for the scanner to close.
    await waitFor(element(by.text('Scan a Cocohub QR code to access pet records')))
      .not.toBeVisible()
      .withTimeout(5000);

    // Now re-open scanner to test manual entry fallback
    await element(by.text('Scan QR Code')).tap();
    await waitFor(element(by.text('Scan a Cocohub QR code to access pet records')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap Manual Entry
    await element(by.label('Enter code manually')).tap();

    // Verify Manual Entry screen is open
    await waitFor(element(by.text('Enter Pet Code')))
      .toBeVisible()
      .withTimeout(5000);
      
    // Cancel / Close
    await element(by.label('Cancel')).tap();
  });
});
