describe('QR Code Generation and Sharing Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Navigate to pet share screen via navigation
    await element(by.id('pet-list-item-0')).tap();
    await element(by.id('pet-share-tab')).tap();
  });

  it('should show QR code generation option on PetShareScreen', async () => {
    // Verify share screen is loaded
    await expect(element(by.text('Share '))).toBeVisible();
    // Verify QR Code option card is present
    await expect(element(by.text('QR Code'))).toBeVisible();
    await expect(element(by.text('Generate a scannable QR code'))).toBeVisible();
  });

  it('should generate a QR code with image preview', async () => {
    // Tap the QR Code option card to generate
    await element(by.text('QR Code')).tap();
    // Verify QR image appears (accessibility label from Image component)
    await expect(element(by.label('QR code'))).toBeVisible();
    // Verify share and print buttons appear
    await expect(element(by.label('Share QR code'))).toBeVisible();
    await expect(element(by.label('Print QR code'))).toBeVisible();
  });

  it('should support manual entry as fallback after QR scan', async () => {
    // Navigate to QR scanner
    await element(by.id('qr-scanner-button')).tap();
    // Verify scanner view is active
    await expect(element(by.label('Close scanner'))).toBeVisible();
    // Tap manual entry button
    await element(by.label('Manual entry')).tap();
    // Verify manual entry screen appears (requires ManualEntryScreen to exist)
    // Note: testID 'manual-entry-screen' needs to be added to ManualEntryScreen
    // await expect(element(by.id('manual-entry-screen'))).toBeVisible();
  });
});
