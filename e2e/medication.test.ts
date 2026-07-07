import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

async function openMedicationScreen() {
  await waitFor(element(by.id('pet-list-screen')))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.text('Care')).tap();
  await waitFor(element(by.id('medication-screen')))
    .toBeVisible()
    .withTimeout(10000);
}

async function addMedication({
  name,
  dosage,
  petId,
  frequency = '8',
}: {
  name: string;
  dosage: string;
  petId: string;
  frequency?: string;
}) {
  await element(by.id('add-medication-button')).tap();
  await waitFor(element(by.id('medication-form-modal')))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.id('medication-name-input')).replaceText(name);
  await element(by.id('medication-dosage-input')).replaceText(dosage);
  await element(by.id('medication-petId-input')).replaceText(petId);
  await element(by.id('medication-frequency-input')).replaceText(frequency);

  await element(by.id('medication-form-next')).tap();
  await element(by.id('medication-form-next')).tap();
  await element(by.id('medication-form-next')).tap();
  await element(by.id('medication-form-save')).tap();
}

describe('Medication management flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxSeed: 'test', detoxSkipOnboarding: 'true' },
    });
    await openMedicationScreen();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('adds a medication with all required fields', async () => {
    await addMedication({
      name: 'Carprofen',
      dosage: '25mg',
      petId: 'pet-1',
      frequency: '8',
    });

    await waitFor(element(by.id('medication-card-Carprofen')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.text('Carprofen'))).toBeVisible();
  });

  it('logs a dose and shows it in the daily schedule', async () => {
    await element(by.id('medication-log-dose-Carprofen')).tap();
    await element(by.id('medication-daily-tab')).tap();

    await waitFor(element(by.id('medication-schedule-slot-Carprofen')))
      .toBeVisible()
      .withTimeout(8000);
  });

  it('shows a drug interaction warning for conflicting medication', async () => {
    await element(by.id('medication-list-tab')).tap();
    await addMedication({
      name: 'Prednisone',
      dosage: '5mg',
      petId: 'pet-1',
      frequency: '12',
    });

    await waitFor(element(by.id('medication-interaction-warning')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.text('Carprofen + Prednisone'))).toBeVisible();
    await element(by.id('medication-form-cancel')).tap();
  });

  it('deletes a medication', async () => {
    await waitFor(element(by.id('medication-card-Carprofen')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('medication-delete-Carprofen')).tap();
    await element(by.text('Delete')).tap();

    await waitFor(element(by.id('medication-card-Carprofen')))
      .not.toBeVisible()
      .withTimeout(8000);
  });
});
