describe('QRScannerScreen', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToQRScannerScreen(); // Implement this function to navigate to the QRScannerScreen
  });

  it('should open the QR scanner and load the pet profile when a valid QR code is scanned', async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES' }
    });

    await expect(element(by.id('qr-scanner'))).toBeVisible();

    // Mock the QR code scanning
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES' },
      detoxCustomConfig: {
        mockScanResult: 'valid-pet-data' // Implement this mock in your app code
      }
    });

    await expect(element(by.id('pet-profile'))).toBeVisible();
  });

  it('should allow manual entry when QR scan is cancelled', async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES' }
    });

    await expect(element(by.id('qr-scanner'))).toBeVisible();

    // Simulate cancelling the QR scan
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES' },
      detoxCustomConfig: {
        mockScanResult: 'cancelled' // Implement this mock in your app code
      }
    });

    await expect(element(by.id('manual-entry-button'))).toBeVisible();
    await element(by.id('manual-entry-button')).tap();

    // Simulate manual entry
    await element(by.id('manual-entry-input')).typeText('pet-id-123');
    await element(by.id('submit-button')).tap();

    await expect(element(by.id('pet-profile'))).toBeVisible();
  });
});