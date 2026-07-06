## Bounty: 15 XLM

After a successful sync, items remain in the offline queue and re-sync on the next cycle causing duplicate records.

### Steps to Reproduce
1. Go offline and create a medical record
2. Come back online - sync runs
3. Open Settings > Sync Status - queue still shows pending items
4. Sync runs again and creates a duplicate record on the backend

### Acceptance Criteria
- Queue cleared after server confirms receipt (not just after request is sent)
- Unit test added for the clear-on-success path
- No duplicate records created during sync

### Resources
- src/services/syncEngine.ts
- src/services/offlineQueue.ts

### Reward
15 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
