describe('Medication Management Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Navigate to medication screen
    await element(by.id('medication-tab')).tap();
  });

  it('should add a medication with all required fields', async () => {
    // Tap add medication button
    await element(by.id('add-medication-button')).tap();
    await expect(element(by.id('add-medication-form'))).toBeVisible();
    
    // Fill in required fields
    await element(by.id('medication-name-input')).typeText('Amoxicillin');
    await element(by.id('medication-dosage-input')).typeText('500mg');
    await element(by.id('medication-frequency-input')).typeText('Twice daily');
    await element(by.id('medication-start-date')).tap();
    // Select today's date
    await element(by.id('date-picker-confirm')).tap();
    
    // Submit the form
    await element(by.id('save-medication-button')).tap();
    
    // Verify medication appears in the list
    await expect(element(by.text('Amoxicillin'))).toBeVisible();
    await expect(element(by.text('500mg'))).toBeVisible();
  });

  it('should log a dose and verify it appears in daily schedule', async () => {
    // Find the medication and tap log dose
    await element(by.text('Amoxicillin')).tap();
    await expect(element(by.id('medication-detail-screen'))).toBeVisible();
    
    // Tap the log dose button
    await element(by.id('log-dose-button')).tap();
    await expect(element(by.id('dose-confirmation'))).toBeVisible();
    
    // Confirm the dose
    await element(by.id('confirm-dose-button')).tap();
    
    // Navigate to daily schedule
    await element(by.id('daily-schedule-tab')).tap();
    
    // Verify the logged dose appears
    await expect(element(by.text('Amoxicillin'))).toBeVisible();
    await expect(element(by.text('500mg'))).toBeVisible();
  });

  it('should delete a medication', async () => {
    // Find the medication
    await element(by.text('Amoxicillin')).tap();
    await expect(element(by.id('medication-detail-screen'))).toBeVisible();
    
    // Tap delete button
    await element(by.id('delete-medication-button')).tap();
    
    // Confirm deletion
    await expect(element(by.id('delete-confirmation-dialog'))).toBeVisible();
    await element(by.id('confirm-delete-button')).tap();
    
    // Verify medication is removed from list
    await expect(element(by.text('Amoxicillin'))).not.toBeVisible();
  });

  it('should show drug interaction warning when adding conflicting medication', async () => {
    // First, add a medication that has known interactions
    await element(by.id('add-medication-button')).tap();
    await element(by.id('medication-name-input')).typeText('Warfarin');
    await element(by.id('medication-dosage-input')).typeText('5mg');
    await element(by.id('medication-frequency-input')).typeText('Once daily');
    await element(by.id('save-medication-button')).tap();
    
    // Add a second medication that conflicts
    await element(by.id('add-medication-button')).tap();
    await element(by.id('medication-name-input')).typeText('Aspirin');
    await element(by.id('medication-dosage-input')).typeText('100mg');
    await element(by.id('medication-frequency-input')).typeText('Once daily');
    await element(by.id('save-medication-button')).tap();
    
    // Verify drug interaction warning appears
    await expect(element(by.id('drug-interaction-warning'))).toBeVisible();
    await expect(element(by.text('Warfarin'))).toBeVisible();
    await expect(element(by.text('Aspirin'))).toBeVisible();
  });
});
