import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('Medication Management Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { detoxSeed: 'test', detoxSkipOnboarding: 'true' },
    });
    // Wait for main tab or navigation
    await waitFor(element(by.text('Medications')))
      .toBeVisible()
      .withTimeout(10000);
    // Ensure we start from Medications tab if it's a bottom tab
    await element(by.text('Medications')).tap();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('adds a medication with all required fields', async () => {
    // Tap the "+ Add" or "Add medication" button
    try {
      await element(by.text('+ Add')).tap();
    } catch {
      await element(by.text('Add medication')).tap();
    }

    // Step 0: Basic information
    await waitFor(element(by.text('Add Medication')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.label('Medication name')).typeText('Amoxicillin');
    await element(by.label('Dosage (e.g. 5mg)')).typeText('250mg');
    await element(by.label('Pet ID')).typeText('pet-123');
    await element(by.label('Frequency (hours between doses)')).replaceText('8');
    
    // Hide keyboard if needed (tap somewhere else)
    await element(by.text('Add Medication')).tap();
    await element(by.label('Go to next step')).tap();

    // Step 1: Medication details
    await waitFor(element(by.label('Instructions')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.label('Instructions')).typeText('Take with food');
    await element(by.text('Add Medication')).tap(); // dismiss keyboard
    await element(by.label('Go to next step')).tap();

    // Step 2: Provider information
    await waitFor(element(by.label('Prescriber name')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.label('Prescriber name')).typeText('Dr. Smith');
    await element(by.text('Add Medication')).tap(); // dismiss keyboard
    await element(by.label('Go to next step')).tap();

    // Step 3: Supply & notes
    await waitFor(element(by.label('Total pills')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.label('Total pills')).typeText('30');
    await element(by.label('Remaining pills')).typeText('30');
    await element(by.label('Current supply (doses on hand)')).typeText('30');
    
    await element(by.text('Add Medication')).tap(); // dismiss keyboard
    
    // Save medication
    await element(by.text('Save')).tap();

    // Verify it appears in the list
    await waitFor(element(by.text('Amoxicillin')))
      .toBeVisible()
      .withTimeout(8000);
    await detoxExpect(element(by.text('250mg · every 8h'))).toBeVisible();
  });

  it('logs a dose, verifies dose appears in daily schedule', async () => {
    // We are on the 'list' tab. Log a dose.
    await element(by.text('✓ Log Dose')).atIndex(0).tap();

    // Go to daily schedule tab
    await element(by.text('Daily')).tap();

    // Verify dose appears as taken
    await waitFor(element(by.text('✓')))
      .toBeVisible()
      .withTimeout(5000);
    
    await detoxExpect(element(by.text('Amoxicillin · 250mg')).atIndex(0)).toBeVisible();

    // Go back to list tab for next test
    await element(by.text('List')).tap();
  });

  it('shows drug interaction warning when adding a conflicting medication', async () => {
    await element(by.text('+ Add')).tap();

    // Try adding a conflicting drug (e.g. interacting with Amoxicillin)
    // Assuming 'Methotrexate' or 'Tetracycline' conflicts with Amoxicillin for this test scenario
    await waitFor(element(by.text('Add Medication')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.label('Medication name')).typeText('Doxycycline');
    await element(by.label('Dosage (e.g. 5mg)')).typeText('100mg');
    await element(by.label('Pet ID')).typeText('pet-123');
    
    await element(by.text('Add Medication')).tap(); // dismiss keyboard
    await element(by.label('Go to next step')).tap();
    await element(by.label('Go to next step')).tap();
    await element(by.label('Go to next step')).tap();
    
    // Save medication
    await element(by.text('Save')).tap();

    // Verify interaction warning appears
    await waitFor(element(by.text('⚠️ Drug Interaction Detected')))
      .toBeVisible()
      .withTimeout(5000);

    // Cancel out of the modal
    await element(by.text('Cancel')).tap();
  });

  it('deletes a medication', async () => {
    // We should be back on the list tab
    await element(by.text('Delete')).atIndex(0).tap();

    // Wait for the alert confirmation and tap 'Delete'
    await waitFor(element(by.text('Delete')).atIndex(1))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.text('Delete')).atIndex(1).tap();

    // Verify it was deleted
    await waitFor(element(by.text('Amoxicillin')))
      .not.toBeVisible()
      .withTimeout(5000);
  });
});
