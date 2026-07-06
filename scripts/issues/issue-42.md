## Bounty: 20 XLM

Improve appointment conflict detection to handle real-world edge cases.

### Acceptance Criteria
- Overlapping appointments on same day flagged (not just exact same time)
- Buffer time between appointments configurable (default 30 minutes)
- Recurring appointment conflicts detected
- Unit tests cover all edge cases
- UI shows conflict warning before saving, not after

### Resources
- src/services/appointmentService.ts
- src/screens/AppointmentScreen.tsx

### Reward
20 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
