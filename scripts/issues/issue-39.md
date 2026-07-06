## Bounty: 30 XLM

Ensure every notification type deep-links to the correct screen when tapped - including cold-start.

### Acceptance Criteria
- Medication reminder taps go to MedicationScreen for the correct pet
- Appointment reminder taps go to AppointmentDetailScreen
- Vaccination due taps go to VaccinationScreen
- SOS alert taps go to EmergencyContactsScreen
- Birthday notification taps go to PetDetailScreen
- Cold-start (app not running) deep link works correctly
- Maestro E2E test added for at least one notification type

### Resources
- src/navigation/AppNavigator.tsx (handleNotificationDeepLink)
- src/services/notificationService.ts

### Reward
30 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
