## Bounty: 8 XLM

The key backup service uses Shamir secret sharing but has no unit tests.

### Acceptance Criteria
- Tests for split and reconstruct round-trip with 2-of-3 and 3-of-5 thresholds
- Tests for tampered share detection
- Tests for insufficient shares scenario
- Tests that secrets never appear in plaintext in logs or error messages

### Resources
- src/services/keyBackupService.ts
- src/screens/KeyBackupScreen.tsx

### Reward
8 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
