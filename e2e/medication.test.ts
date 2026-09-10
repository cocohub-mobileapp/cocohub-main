import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('Medication Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxSeed: 'test', detoxSkipOnboarding: 'true' },
    });
    await waitFor(element(by.id('pet-list-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.text('Care')).tap();
    await waitFor(element(by.id('medication-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('adds a medication with all required fields', async () => {
    await element(by.id('add-medication-button')).tap();
    await waitFor(element(by.id('medication-form-modal')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('medication-name-input')).typeText('Carprofen');
    await element(by.id('medication-dosage-input')).typeText('25mg');
    await element(by.id('medication-petId-input')).typeText('pet-1');
    await element(by.id('medication-frequency-input')).typeText('8');

    await element(by.id('medication-form-next')).tap();
    await element(by.id('medication-form-next')).tap();
    await element(by.id('medication-form-next')).tap();
    await element(by.id('medication-form-save')).tap();

    await waitFor(element(by.id('medication-card-Carprofen')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.text('Carprofen'))).toBeVisible();
  });

  it('logs a dose and verifies dose appears in daily schedule', async () => {
    await element(by.id('medication-log-dose-Carprofen')).tap();
    await element(by.id('medication-daily-tab')).tap();

    await waitFor(element(by.id('medication-schedule-slot-Carprofen')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.id('medication-dose-taken-Carprofen'))).toBeVisible();
  });

  it('shows drug interaction warning when adding conflicting medication', async () => {
    await element(by.id('medication-list-tab')).tap();
    await waitFor(element(by.id('medication-card-Carprofen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('add-medication-button')).tap();
    await waitFor(element(by.id('medication-form-modal')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('medication-name-input')).typeText('Prednisone');
    await element(by.id('medication-dosage-input')).typeText('5mg');
    await element(by.id('medication-petId-input')).typeText('pet-1');
    await element(by.id('medication-frequency-input')).typeText('12');

    await element(by.id('medication-form-next')).tap();
    await element(by.id('medication-form-next')).tap();
    await element(by.id('medication-form-next')).tap();
    await element(by.id('medication-form-save')).tap();

    await waitFor(element(by.id('medication-interaction-warning')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.id('medication-interaction-title'))).toBeVisible();
    await detoxExpect(element(by.text('Carprofen + Prednisone'))).toBeVisible();

    await element(by.id('medication-form-cancel')).tap();
  });

  it('deletes a medication', async () => {
    await waitFor(element(by.id('medication-card-Carprofen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('medication-delete-Carprofen')).tap();

    try {
      await element(by.text('Delete')).atIndex(1).tap();
    } catch {
      await element(by.text('Delete')).tap();
    }

    await waitFor(element(by.id('medication-card-Carprofen')))
      .not.toBeVisible()
      .withTimeout(8000);
  });
});
