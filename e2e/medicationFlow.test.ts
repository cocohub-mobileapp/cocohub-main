import { DetoxConstants, by, device, element, expect as detoxExpect, waitFor } from 'detox';

const MEDICATION_NAME = 'E2E Amoxicillin';
const MEDICATION_TEST_ID = 'e2e-amoxicillin';

async function openMedicationScreen() {
  await waitFor(element(by.id('pet-list-screen')))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.id('care-tab')).tap();

  await waitFor(element(by.id('medication-screen')))
    .toBeVisible()
    .withTimeout(10000);
}

async function tapMedicationFormButton(testID: string) {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .whileElement(by.id('medication-form-modal'))
    .scroll(250, 'down');
  await element(by.id(testID)).tap();
}

async function waitForDoseHistoryEntry() {
  await waitFor(element(by.id(`dose-history-entry-${MEDICATION_TEST_ID}`)))
    .toBeVisible()
    .whileElement(by.id('medication-list'))
    .scroll(200, 'down');
}

describe('Medication tracking flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
      launchArgs: {
        detoxSeed: 'medication-flow',
        detoxSkipOnboarding: 'true',
        detoxMockNotifications: 'true',
      },
    });

    await openMedicationScreen();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('adds a new medication with a daily schedule', async () => {
    await element(by.id('add-medication-button')).tap();

    await waitFor(element(by.id('medication-form-modal')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('medication-input-name')).typeText(MEDICATION_NAME);
    await element(by.id('medication-input-dosage')).typeText('10mg');
    await element(by.id('medication-input-petId')).typeText('detox-pet-1');
    await element(by.id('medication-input-frequency')).replaceText('24');

    await tapMedicationFormButton('medication-form-next-button');
    await tapMedicationFormButton('medication-form-next-button');
    await tapMedicationFormButton('medication-form-next-button');
    await tapMedicationFormButton('medication-form-save-button');

    await waitFor(element(by.id(`medication-card-${MEDICATION_TEST_ID}`)))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.id('medication-reminder-status'))).toBeVisible();
  });

  it('shows the medication schedule', async () => {
    await element(by.id('medication-daily-tab')).tap();

    await waitFor(element(by.id('medication-schedule-list')))
      .toBeVisible()
      .withTimeout(5000);
    await waitFor(element(by.id(`medication-schedule-dose-${MEDICATION_TEST_ID}`)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('marks a dose as taken', async () => {
    await element(by.id('medication-list-tab')).tap();
    await waitFor(element(by.id(`log-dose-button-${MEDICATION_TEST_ID}`)))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id(`log-dose-button-${MEDICATION_TEST_ID}`)).tap();

    await waitForDoseHistoryEntry();
    await detoxExpect(element(by.text('Taken'))).toBeVisible();
  });

  it('shows medication dose history', async () => {
    await waitFor(element(by.id('medication-history-list')))
      .toBeVisible()
      .whileElement(by.id('medication-list'))
      .scroll(200, 'down');
    await waitForDoseHistoryEntry();
  });

  it('handles a mocked dose reminder notification', async () => {
    await device.sendUserNotification({
      trigger: { type: DetoxConstants.userNotificationTriggers.push },
      title: 'Medication Reminder',
      body: `Time to give ${MEDICATION_NAME} (10mg)`,
      payload: {
        type: 'medication',
        category: 'medication',
        medicationId: 'detox-medication-1',
      },
    });

    await waitFor(element(by.id('medication-screen')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.id(`medication-card-${MEDICATION_TEST_ID}`))).toBeVisible();
  });
});
