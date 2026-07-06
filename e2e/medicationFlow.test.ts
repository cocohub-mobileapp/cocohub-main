import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

async function openMedicationForm() {
  await waitFor(element(by.id('add-medication-button')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id('add-medication-button')).tap();
  await waitFor(element(by.id('medication-form-modal')))
    .toBeVisible()
    .withTimeout(5000);
}

async function fillRequiredMedicationFields(name: string) {
  await element(by.id('medication-name-input')).replaceText(name);
  await element(by.id('medication-dosage-input')).replaceText('25mg');
  await element(by.id('medication-petId-input')).replaceText('pet-detox-001');
  await element(by.id('medication-frequency-input')).replaceText('8');
}

async function finishMedicationForm() {
  await element(by.id('medication-form-next-button')).tap();
  await element(by.id('medication-form-next-button')).tap();
  await element(by.id('medication-form-next-button')).tap();
  await element(by.id('medication-totalPills-input')).replaceText('30');
  await element(by.id('medication-remainingPills-input')).replaceText('30');
  await element(by.id('medication-currentSupply-input')).replaceText('30');
  await element(by.id('medication-form-save-button')).tap();
}

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
    await waitFor(element(by.id('care-tab-medications')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('adds a medication with all required fields', async () => {
    await openMedicationForm();
    await fillRequiredMedicationFields('Carprofen');
    await finishMedicationForm();

    await waitFor(element(by.id('medication-card-carprofen')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.text('Carprofen'))).toBeVisible();
  });

  it('logs a dose and shows it in the daily schedule', async () => {
    await element(by.id('medication-log-dose-carprofen')).tap();
    await element(by.id('medication-tab-daily')).tap();

    await waitFor(element(by.id('medication-schedule-row-carprofen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows a drug interaction warning for a risky combination', async () => {
    await element(by.id('medication-tab-list')).tap();
    await openMedicationForm();
    await fillRequiredMedicationFields('Prednisone');
    await finishMedicationForm();

    await waitFor(element(by.id('medication-interaction-warning')))
      .toBeVisible()
      .withTimeout(5000);
    await detoxExpect(element(by.text('Carprofen + Prednisone'))).toBeVisible();
    await element(by.id('medication-form-cancel-button')).tap();
  });

  it('deletes the medication', async () => {
    await waitFor(element(by.id('medication-card-carprofen')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('medication-delete-carprofen')).tap();
    await element(by.text('Delete')).atIndex(1).tap();

    await waitFor(element(by.id('medication-card-carprofen')))
      .not.toBeVisible()
      .withTimeout(5000);
  });
});
