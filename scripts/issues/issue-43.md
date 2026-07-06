## Bounty: 15 XLM

On Android the SOS button should be accessible from the lock screen as a notification action.

### Steps to Reproduce
1. Configure emergency contacts
2. Lock Android device
3. Expected: persistent SOS notification visible on lock screen
4. Actual: SOS only works when app is open

### Acceptance Criteria
- Android lock screen shows a persistent SOS notification when emergency contacts are configured
- Tapping the notification action triggers SOS without unlocking the phone
- Uses expo-notifications foreground service

### Resources
- src/components/SOSButton.tsx
- src/services/emergencyService.ts

### Reward
15 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
