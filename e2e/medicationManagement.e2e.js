describe('Medication Management Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should add a medication with all required fields', async () => {
    await expect(element(by.id('addMedicationButton'))).toBeVisible();
    await element(by.id('addMedicationButton')).tap();

    await element(by.id('medicationNameInput')).typeText('Aspirin');
    await element(by.id('medicationDosageInput')).typeText('500mg');
    await element(by.id('saveMedicationButton')).tap();

    await expect(element(by.text('Aspirin'))).toBeVisible();
  });

  it('should log a dose and verify it appears in the daily schedule', async () => {
    await element(by.id('logDoseButton')).tap();
    await element(by.id('confirmDoseButton')).tap();

    await expect(element(by.text('500mg'))).toBeVisible();
  });

  it('should delete a medication', async () => {
    await element(by.id('medicationItem')).atIndex(0).swipe('left');
    await element(by.id('deleteMedicationButton')).tap();

    await expect(element(by.text('Aspirin'))).not.toBeVisible();
  });

  it('should show a drug interaction warning when adding a conflicting medication', async () => {
    await element(by.id('addMedicationButton')).tap();
    await element(by.id('medicationNameInput')).typeText('Ibuprofen');
    await element(by.id('medicationDosageInput')).typeText('400mg');
    await element(by.id('saveMedicationButton')).tap();

    await expect(element(by.text('Drug Interaction Warning'))).toBeVisible();
  });
});