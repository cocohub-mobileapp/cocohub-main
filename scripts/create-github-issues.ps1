# create-github-issues.ps1
# Run this once to create all bounty issues on GitHub.
# Prerequisites: gh CLI installed and authenticated (gh auth login)
# Usage: .\scripts\create-github-issues.ps1

$repo = "cocohub-mobileapp/cocohub-main"

$issues = @(
  # LARGE bounties
  @{
    title  = "Soroban smart contract — on-chain pet record registry"
    body   = @"
## Bounty: 🔴 150 XLM

### Description
Implement a Soroban smart contract on the Stellar network that acts as an on-chain pet record registry with vet access control.

### Acceptance Criteria
- [ ] Soroban contract written in Rust deploys to Stellar testnet
- [ ] Contract stores pet record hashes (not PII) with owner and vet access roles
- [ ] Vet can be granted/revoked read access by the owner
- [ ] Frontend `blockchainService.ts` updated to call the contract via `soroban-client`
- [ ] E2E test on Stellar testnet passes
- [ ] Contract audited and documented

### Resources
- [Soroban docs](https://soroban.stellar.org)
- Existing: `src/services/blockchainService.ts`, `backend/src/routes/anchor.ts`

### Reward
150 XLM via [GrantFox](https://grantfox.xyz) smart escrow — released within 48h of merge.
"@
    labels = @("bounty", "bounty-large", "blockchain", "help wanted")
  },
  @{
    title  = "Wearable device sync — FitBark and Whistle API integration"
    body   = @"
## Bounty: 🔴 120 XLM

### Description
Connect Cocohub to FitBark and Whistle wearable APIs to automatically sync activity data and health metrics.

### Acceptance Criteria
- [ ] `wearableService.ts` (frontend) connects to FitBark OAuth and pulls daily activity
- [ ] `wearableService.ts` connects to Whistle REST API and pulls GPS + activity
- [ ] Data syncs to the health metrics timeline on the Health Dashboard
- [ ] Settings screen shows "Connected Devices" section
- [ ] Graceful error handling if API keys are absent

### Resources
- Existing stub: `src/services/wearableService.ts`
- FitBark API: https://www.fitbark.com/dev/
- Whistle API: contact partners@whistle.com

### Reward
120 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-large", "feature", "help wanted")
  },
  @{
    title  = "Telemedicine — WebRTC video consultation end-to-end flow"
    body   = @"
## Bounty: 🔴 100 XLM

### Description
Complete the telemedicine video consultation flow from booking to call end.

### Acceptance Criteria
- [ ] Pet owner books a video consult from `TelemedicineScreen`
- [ ] Vet receives a notification and can accept/decline
- [ ] WebRTC peer connection established via `VideoConsultationScreen`
- [ ] Call ends cleanly, consultation note is saved to the pet record
- [ ] Works on iOS, Android, and web
- [ ] Tested with two devices on the same WiFi network

### Resources
- Existing: `src/screens/TelemedicineScreen.tsx`, `src/screens/VideoConsultationScreen.tsx`
- Existing: `src/services/telemedicineService.ts`, `src/services/webrtcService.ts`
- Backend: `backend/server/routes/telemedicine.ts`

### Reward
100 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-large", "feature", "help wanted")
  },
  @{
    title  = "AI symptom checker — breed + symptom input to vet recommendation"
    body   = @"
## Bounty: 🔴 100 XLM

### Description
Build the backend ML prediction endpoint that powers the AI Symptom Checker screen.

### Acceptance Criteria
- [ ] `POST /api/predictions/symptoms` accepts `{ petId, species, breed, symptoms }` and returns urgency + probable conditions + recommended actions
- [ ] Uses a real classification model or LLM API (OpenAI, Anthropic, or HuggingFace)
- [ ] Frontend `SymptomCheckerScreen.tsx` calls the endpoint and renders results
- [ ] Urgency levels: `low`, `moderate`, `high`, `emergency`
- [ ] Response includes a disclaimer
- [ ] Rate-limited: max 10 requests/user/day on free tier

### Resources
- Existing frontend: `src/screens/SymptomCheckerScreen.tsx`
- Existing backend stub: `backend/src/services/mlPredictionService.ts`

### Reward
100 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-large", "AI", "help wanted")
  },
  @{
    title  = "Apple Watch companion app — SwiftUI health widget"
    body   = @"
## Bounty: 🔴 75 XLM

### Description
Build an Apple Watch companion app that shows the active pet's health score, next medication dose, and SOS shortcut.

### Acceptance Criteria
- [ ] SwiftUI Watch app shows: pet name, health score, next dose time
- [ ] Complication available in `Modular Small` and `Circular Small` sizes
- [ ] SOS button on Watch triggers the same emergency flow as the phone
- [ ] Data syncs from the iOS app via WatchConnectivity
- [ ] Works on watchOS 10+

### Resources
- Existing iOS widget: `ios-widget/PetChainWidget.swift`
- Existing Android widget: `android-widget/PetChainWidgetProvider.java`

### Reward
75 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-large", "iOS", "help wanted")
  },

  # MEDIUM bounties
  @{
    title  = "Dark mode — full app theming pass"
    body   = @"
## Bounty: 🟡 50 XLM

### Description
Audit every screen for dark mode correctness and fix all remaining hard-coded colors.

### Acceptance Criteria
- [ ] All screens pass visual dark mode review (no white backgrounds flashing, no unreadable text)
- [ ] All hard-coded color strings (`#fff`, `#1a1a1a`, etc.) replaced with `colors.*` from `ThemeContext`
- [ ] StatusBar style correct in both modes
- [ ] Storybook stories updated to include dark mode variant

### Resources
- Theme: `src/context/ThemeContext.tsx`, `src/theme/colors.ts`
- Settings already has a system/light/dark toggle

### Reward
50 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "UI", "help wanted", "good first issue")
  },
  @{
    title  = "French language translation (i18n)"
    body   = @"
## Bounty: 🟡 40 XLM

### Description
Translate all user-facing strings to French and add the `fr` locale to i18n.

### Acceptance Criteria
- [ ] `src/i18n/locales/fr.json` created with all keys from `en.json` translated
- [ ] French added to `LanguageSelector` component
- [ ] RTL not required (French is LTR)
- [ ] Native speaker review preferred — at minimum, machine-translate then proofread

### Resources
- Existing: `src/i18n/locales/en.json`, `src/i18n/locales/es.json`
- i18n setup: `src/i18n/index.ts`

### Reward
40 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "i18n", "help wanted", "good first issue")
  },
  @{
    title  = "Portuguese (BR) language translation (i18n)"
    body   = @"
## Bounty: 🟡 40 XLM

### Description
Translate all user-facing strings to Brazilian Portuguese and add the `pt-BR` locale.

### Acceptance Criteria
- [ ] `src/i18n/locales/pt-BR.json` with all keys from `en.json` translated
- [ ] Portuguese added to `LanguageSelector`
- [ ] Native or near-native speaker preferred

### Resources
- `src/i18n/locales/en.json`

### Reward
40 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "i18n", "help wanted", "good first issue")
  },
  @{
    title  = "Pet insurance claims — full submission flow end-to-end"
    body   = @"
## Bounty: 🟡 45 XLM

### Description
Complete the insurance claims flow so users can submit a claim directly from the app.

### Acceptance Criteria
- [ ] `InsuranceScreen` lets users: view policies, file a new claim with description + amount + photo attachments
- [ ] `claimsService.ts` POST to `/api/insurance/claims` works end-to-end
- [ ] Claim status timeline renders (submitted → under review → approved/denied)
- [ ] PDF export of claim summary works via `pdfService`
- [ ] Error states handled gracefully

### Resources
- Existing: `src/screens/InsuranceScreen.tsx`, `src/services/claimsService.ts`
- Backend: `backend/server/routes/insurance.ts`

### Reward
45 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "feature", "help wanted")
  },
  @{
    title  = "Stellar trustline UI — PETC / VETH / PAWP token management"
    body   = @"
## Bounty: 🟡 40 XLM

### Description
Build a complete trustline management screen for Cocohub's Stellar tokens.

### Acceptance Criteria
- [ ] `TrustlineScreen` shows PETC, VETH, PAWP balances
- [ ] Users can add/remove trustlines for each asset
- [ ] Token earned balance shown from backend
- [ ] Errors from Stellar Horizon handled gracefully with user-readable messages
- [ ] Testnet mode clearly indicated

### Resources
- Existing: `src/screens/TrustlineScreen.tsx`, `src/services/trustlineService.ts`
- Stellar docs: https://developers.stellar.org/docs/encyclopedia/liquidity-on-stellar-sdex-liquidity-pools

### Reward
40 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "blockchain", "help wanted")
  },
  @{
    title  = "Health metrics export to PDF — vet-ready report"
    body   = @"
## Bounty: 🟡 35 XLM

### Description
Generate a vet-ready PDF health report from the Health Dashboard.

### Acceptance Criteria
- [ ] Single-tap export from `PetHealthDashboardScreen`
- [ ] PDF includes: pet info header, health score, weight chart image, active medications, upcoming appointments, recent records
- [ ] Uses `pdfService.ts` + `pdfkit` on the backend
- [ ] PDF is shareable via iOS/Android share sheet
- [ ] Looks professional — clinic-ready formatting

### Resources
- Existing: `src/services/pdfService.ts`, `backend/src/services/pdfParserService.ts`
- `PetHealthDashboardScreen.tsx` already has a share handler stub

### Reward
35 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "feature", "help wanted")
  },
  @{
    title  = "Push notification deep-link routing — all notification types"
    body   = @"
## Bounty: 🟡 30 XLM

### Description
Ensure every notification type deep-links to the correct screen when tapped.

### Acceptance Criteria
- [ ] Medication reminder → `MedicationScreen` for the correct pet
- [ ] Appointment reminder → `AppointmentDetailScreen`
- [ ] Vaccination due → `VaccinationScreen`
- [ ] SOS alert → `EmergencyContactsScreen`
- [ ] Birthday notification → `PetDetailScreen`
- [ ] Cold-start (app not running) deep link works correctly
- [ ] Maestro E2E test added for at least one notification type

### Resources
- `src/navigation/AppNavigator.tsx` — `handleNotificationDeepLink`
- `src/services/notificationService.ts`

### Reward
30 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "notifications", "help wanted")
  },
  @{
    title  = "Detox E2E tests — medication flow"
    body   = @"
## Bounty: 🟡 25 XLM

### Description
Write Detox end-to-end tests covering the full medication management flow.

### Acceptance Criteria
- [ ] Test: add a medication with all required fields
- [ ] Test: log a dose → verify dose appears in daily schedule
- [ ] Test: delete a medication
- [ ] Test: drug interaction warning appears when adding a conflicting med
- [ ] Tests run in CI via `e2e-detox.yml` workflow

### Resources
- Existing Detox config: `.detoxrc.js`
- Existing Maestro flows: `.maestro/flows/`

### Reward
25 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "testing", "help wanted", "good first issue")
  },
  @{
    title  = "Detox E2E tests — QR scan and share flow"
    body   = @"
## Bounty: 🟡 25 XLM

### Description
Write Detox E2E tests for the QR code generation and sharing flow.

### Acceptance Criteria
- [ ] Test: QR code generates for a pet on `PetShareScreen`
- [ ] Test: QR scanner opens, mock scan returns valid data, pet profile loads
- [ ] Test: manual entry fallback works when QR scan is cancelled
- [ ] Tests run in CI

### Resources
- `src/screens/QRScannerScreen.tsx`, `src/screens/PetShareScreen.tsx`
- `.detoxrc.js`

### Reward
25 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "testing", "help wanted", "good first issue")
  },
  @{
    title  = "Appointment conflict detection — improve edge cases"
    body   = @"
## Bounty: 🟡 20 XLM

### Description
The appointment scheduler has basic conflict detection. Improve it to handle real-world edge cases.

### Acceptance Criteria
- [ ] Overlapping appointments on same day flagged (not just exact same time)
- [ ] Buffer time between appointments configurable (default 30 mins)
- [ ] Recurring appointment conflicts detected
- [ ] Unit tests cover all edge cases
- [ ] UI shows conflict warning before saving, not after

### Resources
- `src/services/appointmentService.ts`
- `src/screens/AppointmentScreen.tsx`

### Reward
20 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-medium", "bug", "help wanted")
  },

  # SMALL bounties
  @{
    title  = "Fix: SOS button not visible on Android lock screen"
    body   = @"
## Bounty: 🟢 15 XLM

### Description
On Android, the SOS button should be accessible from the lock screen as a notification action. Currently it only works when the app is open.

### Acceptance Criteria
- [ ] Android lock screen shows a persistent SOS notification when emergency contacts are configured
- [ ] Tapping the notification action triggers SOS without unlocking the phone
- [ ] Uses `expo-notifications` foreground service

### Resources
- `src/components/SOSButton.tsx`
- `src/services/emergencyService.ts`

### Reward
15 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "bug", "Android", "good first issue")
  },
  @{
    title  = "Fix: QR code scanner flash/torch toggle on iOS"
    body   = @"
## Bounty: 🟢 10 XLM

### Description
The torch toggle button on `QRScannerScreen` does not work on iOS (works on Android). Tapping it has no effect.

### Steps to reproduce
1. Open QR Scanner on iOS device
2. Tap the torch/flash icon
3. Expected: torch toggles on/off
4. Actual: nothing happens

### Resources
- `src/screens/QRScannerScreen.tsx`
- `expo-camera` docs: https://docs.expo.dev/versions/latest/sdk/camera/

### Reward
10 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "bug", "iOS", "good first issue")
  },
  @{
    title  = "Fix: Weight chart accessibility labels missing"
    body   = @"
## Bounty: 🟢 10 XLM

### Description
The WeightChart component fails WCAG 2.1 AA — data points have no accessible labels for screen readers.

### Acceptance Criteria
- [ ] Each data point has `accessibilityLabel` with date and weight value
- [ ] Chart has a summary `accessibilityLabel` e.g. "Weight chart for Buddy, 8 data points, latest 12.3 kg"
- [ ] VoiceOver (iOS) and TalkBack (Android) can navigate the chart

### Resources
- `src/components/WeightChart.tsx`
- `src/components/weightChartAccessibility.ts` (stub already exists)

### Reward
10 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "accessibility", "good first issue")
  },
  @{
    title  = "Fix: Offline sync queue not clearing on successful push"
    body   = @"
## Bounty: 🟢 15 XLM

### Description
After a successful sync, some items remain in the offline queue and re-sync unnecessarily on the next cycle, causing duplicate records on the backend.

### Steps to reproduce
1. Go offline, create a medical record
2. Come back online — sync runs
3. Open Settings → Sync Status — queue still shows items

### Acceptance Criteria
- [ ] Queue is cleared after successful server confirmation (not just after the request is sent)
- [ ] Unit test added for the clear-on-success path
- [ ] No duplicate records created on backend during sync

### Resources
- `src/services/syncEngine.ts`, `src/services/syncService.ts`
- `src/services/offlineQueue.ts`

### Reward
15 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "bug", "help wanted")
  },
  @{
    title  = "Docs: Backend API setup guide (Docker + Postgres)"
    body   = @"
## Bounty: 🟢 10 XLM

### Description
Write a clear, step-by-step guide for setting up the backend locally. Many contributors drop off during local setup.

### Acceptance Criteria
- [ ] New file: `docs/BACKEND-SETUP.md`
- [ ] Covers: prerequisites, Docker Compose, env variables, migrations, seeding, verifying it works
- [ ] Includes troubleshooting section for common errors
- [ ] Tested by someone who hasn't set it up before (mention this in the PR)

### Reward
10 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "documentation", "good first issue")
  },
  @{
    title  = "Docs: Stellar testnet setup for local development"
    body   = @"
## Bounty: 🟢 10 XLM

### Description
Write a guide for configuring Stellar testnet for local blockchain development.

### Acceptance Criteria
- [ ] New file: `docs/STELLAR-TESTNET.md`
- [ ] Covers: getting testnet XLM, setting env vars, running blockchain tests, Stellar Laboratory basics
- [ ] Explains difference between testnet and mainnet in the context of Cocohub
- [ ] Links to Stellar docs where appropriate

### Reward
10 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "documentation", "blockchain", "good first issue")
  },
  @{
    title  = "UI: Empty state screens with action CTAs for pets list and records"
    body   = @"
## Bounty: 🟢 10 XLM

### Description
The pets list and medical records list show a plain 'No records found' message. They should guide the user to their next action.

### Acceptance Criteria
- [ ] Pet list empty state: illustration/emoji + 'Add your first pet →' button
- [ ] Medical records empty state: 'Add a record' + 'Import from PDF' secondary action
- [ ] Medication empty state: 'Add medication' + 'Ask your vet' secondary action
- [ ] Uses the updated `EmptyState` component (already supports `secondaryText` + `onSecondaryPress`)

### Resources
- `src/components/EmptyState.tsx`
- `src/screens/PetListScreen.tsx`, `src/screens/MedicalRecordViewerScreen.tsx`

### Reward
10 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "UI", "good first issue")
  },
  @{
    title  = "UI: Loading skeleton for vet map screen"
    body   = @"
## Bounty: 🟢 8 XLM

### Description
`VetMapScreen` shows a blank screen while loading nearby clinics. Add a skeleton placeholder.

### Acceptance Criteria
- [ ] While clinics are loading, show 3 skeleton cards below the map
- [ ] Uses the existing `SkeletonCard` component
- [ ] Map itself shows a loading indicator or grayed-out state
- [ ] Transition is smooth — no flash of empty content

### Resources
- `src/screens/VetMapScreen.tsx`
- `src/components/SkeletonCard.tsx`

### Reward
8 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "UI", "good first issue")
  },
  @{
    title  = "Test: Unit tests for dosage calculator utility"
    body   = @"
## Bounty: 🟢 8 XLM

### Description
The dosage calculator has no unit tests. Add comprehensive coverage.

### Acceptance Criteria
- [ ] Tests for weight-based dosing (mg/kg calculations)
- [ ] Tests for species-specific dosing limits
- [ ] Tests for frequency conversion (daily → hourly intervals)
- [ ] Tests for edge cases: zero weight, unknown species, max dose exceeded
- [ ] Coverage ≥ 90% for the utility

### Resources
- `src/screens/DosageCalculatorScreen.tsx`
- `src/services/dosageApprovalService.ts`

### Reward
8 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "testing", "good first issue")
  },
  @{
    title  = "Test: Unit tests for Shamir secret sharing utility"
    body   = @"
## Bounty: 🟢 8 XLM

### Description
The key backup service uses Shamir secret sharing (`secrets.js-grempe`). Add unit tests.

### Acceptance Criteria
- [ ] Tests for split → reconstruct round-trip with 2-of-3 and 3-of-5 thresholds
- [ ] Tests for tampered share detection
- [ ] Tests for insufficient shares scenario
- [ ] Tests that secrets never appear in plaintext in logs

### Resources
- `src/services/keyBackupService.ts`
- `src/screens/KeyBackupScreen.tsx`

### Reward
8 XLM via [GrantFox](https://grantfox.xyz) — released within 48h of merge.
"@
    labels = @("bounty", "bounty-small", "testing", "security", "good first issue")
  }
)

Write-Host "Creating $($issues.Count) GitHub issues..." -ForegroundColor Cyan

foreach ($issue in $issues) {
  $labelArgs = ($issue.labels | ForEach-Object { "--label `"$_`"" }) -join " "
  $bodyFile = [System.IO.Path]::GetTempFileName()
  Set-Content -Path $bodyFile -Value $issue.body -Encoding UTF8

  $cmd = "gh issue create --repo `"$repo`" --title `"$($issue.title)`" --body-file `"$bodyFile`" $labelArgs"
  Write-Host "Creating: $($issue.title)" -ForegroundColor Yellow
  Invoke-Expression $cmd
  Remove-Item $bodyFile -Force
  Start-Sleep -Milliseconds 500  # avoid rate limiting
}

Write-Host "`nDone! All issues created." -ForegroundColor Green
Write-Host "View them at: https://github.com/$repo/issues" -ForegroundColor Cyan
