describe('Medication Management Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Navigate to medication tab
    await element(by.id('medication-tab')).tap();
  });

  it('should show medication list with add button', async () => {
    // Verify medication screen is loaded
    await expect(element(by.id('medication-screen'))).toBeVisible();
    // Verify add button is present
    await expect(element(by.id('add-medication-button'))).toBeVisible();
  });

  it('should add a medication with all required fields', async () => {
    await element(by.id('add-medication-button')).tap();
    await expect(element(by.id('add-medication-form'))).toBeVisible();
    
    await element(by.id('medication-name-input')).typeText('Amoxicillin');
    await element(by.id('medication-dosage-input')).typeText('500mg');
    await element(by.id('medication-frequency-input')).typeText('Twice daily');
    await element(by.id('medication-start-date')).tap();
    await element(by.id('date-picker-confirm')).tap();
    
    await element(by.id('save-medication-button')).tap();
    
    // Verify medication appears in the list
    await expect(element(by.text('Amoxicillin'))).toBeVisible();
  });

  it('should log a dose for a medication', async () => {
    await element(by.text('Amoxicillin')).tap();
    await expect(element(by.id('medication-detail-screen'))).toBeVisible();
    
    await element(by.id('log-dose-button')).tap();
    await expect(element(by.id('dose-confirmation'))).toBeVisible();
    await element(by.id('confirm-dose-button')).tap();
  });

  it('should delete a medication with confirmation', async () => {
    await element(by.text('Amoxicillin')).tap();
    await element(by.id('delete-medication-button')).tap();
    
    await expect(element(by.id('delete-confirmation-dialog'))).toBeVisible();
    await element(by.id('confirm-delete-button')).tap();
    
    await expect(element(by.text('Amoxicillin'))).not.toBeVisible();
  });

  it('should show drug interaction warning for conflicting medications', async () => {
    // Add Warfarin
    await element(by.id('add-medication-button')).tap();
    await element(by.id('medication-name-input')).typeText('Warfarin');
    await element(by.id('medication-dosage-input')).typeText('5mg');
    await element(by.id('medication-frequency-input')).typeText('Once daily');
    await element(by.id('save-medication-button')).tap();
    
    // Add Aspirin (conflicts with Warfarin)
    await element(by.id('add-medication-button')).tap();
    await element(by.id('medication-name-input')).typeText('Aspirin');
    await element(by.id('medication-dosage-input')).typeText('100mg');
    await element(by.id('medication-frequency-input')).typeText('Once daily');
    await element(by.id('save-medication-button')).tap();
    
    // Verify interaction warning
    await expect(element(by.id('drug-interaction-warning'))).toBeVisible();
  });
});
