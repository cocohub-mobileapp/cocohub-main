import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('Medication Management Flow (#47)', () => {
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

  it('navigates to medication screen', async () => {
    await element(by.id('medications-tab')).tap();
    await detoxExpect(element(by.id('medication-screen'))).toBeVisible();
  });

  it('adds a medication with all required fields', async () => {
    await element(by.id('add-medication-button')).tap();
    await detoxExpect(element(by.id('medication-modal'))).toBeVisible();

    await element(by.id('input-name')).typeText('Amoxicillin');
    await element(by.id('input-dosage')).typeText('250mg');
    await element(by.id('input-frequency')).typeText('12');
    await element(by.id('med-form-save-button')).tap();

    await waitFor(element(by.text('Amoxicillin')))
      .toBeVisible()
      .withTimeout(8000);
  });

  it('logs a dose and verifies it appears in the daily schedule', async () => {
    await element(by.id('log-dose-button')).atIndex(0).tap();
    // Daily schedule row indicates dose taken
    await detoxExpect(element(by.text('✓ Log Dose'))).toBeVisible();
  });

  it('shows drug interaction warning when adding a conflicting medication', async () => {
    await element(by.id('add-medication-button')).tap();
    await element(by.id('input-name')).typeText('Carprofen'); // Conflicting NSAID
    await element(by.id('input-dosage')).typeText('50mg');
    await element(by.id('input-frequency')).typeText('24');
    await element(by.id('med-form-save-button')).tap();

    // Interaction warning modal should appear
    await waitFor(element(by.id('drug-interaction-warning')))
      .toBeVisible()
      .withTimeout(5000);
    await detoxExpect(element(by.text('Drug Interaction Warning'))).toBeVisible();

    // Cancel modal
    await element(by.id('modal-cancel-button')).tap();
  });

  it('deletes a medication successfully', async () => {
    await element(by.id('delete-medication-button')).atIndex(0).tap();
    // Confirm delete in alert dialog
    await element(by.text('Delete')).tap();

    await waitFor(element(by.text('Amoxicillin')))
      .not.toBeVisible()
      .withTimeout(5000);
  });
});
