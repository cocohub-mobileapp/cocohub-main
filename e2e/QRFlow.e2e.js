describe('QR Code Generation and Sharing Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Navigate to the pet list and select a pet to get to PetShareScreen
    await element(by.id('pet-list-item-0')).tap();
    await element(by.id('pet-share-tab')).tap();
  });

  it('should generate a QR code for a pet on PetShareScreen', async () => {
    // Verify QR code container is rendered
    await expect(element(by.id('qr-code-container'))).toBeVisible();
    // Verify QR code image is displayed
    await expect(element(by.id('qr-code-image'))).toBeVisible();
    // Verify share button is available
    await expect(element(by.id('share-qr-button'))).toBeVisible();
  });

  it('should open QR scanner, mock a successful scan, and load pet profile', async () => {
    // Navigate to QR scanner
    await element(by.id('qr-scanner-button')).tap();
    
    // Wait for scanner to be visible
    await expect(element(by.id('qr-scanner-view'))).toBeVisible();
    
    // Simulate a valid QR scan with pet data
    await device.mockCameraBarCodeScan({ data: 'pet-id-123', type: 'org.iso.QRCode' });
    
    // Verify pet profile loads after successful scan
    await expect(element(by.id('pet-profile-screen'))).toBeVisible();
    await expect(element(by.id('pet-name'))).toBeVisible();
  });

  it('should fall back to manual entry when QR scan is cancelled', async () => {
    // Navigate to QR scanner
    await element(by.id('qr-scanner-button')).tap();
    
    // Wait for scanner to be visible
    await expect(element(by.id('qr-scanner-view'))).toBeVisible();
    
    // Cancel/dismiss the scanner
    await device.cancelCameraBarCodeScan();
    
    // Verify manual entry option is available
    await expect(element(by.id('manual-entry-input'))).toBeVisible();
    
    // Enter a pet ID manually
    await element(by.id('manual-entry-input')).typeText('pet-manual-456');
    await element(by.id('manual-entry-submit')).tap();
    
    // Verify the pet profile loads via manual entry
    await expect(element(by.id('pet-profile-screen'))).toBeVisible();
  });
});
