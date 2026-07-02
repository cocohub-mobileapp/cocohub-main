## Bounty: 10 XLM

The torch/flash toggle on QRScannerScreen does not work on iOS.

### Steps to Reproduce
1. Open QR Scanner on an iOS device
2. Tap the torch/flash icon
3. Expected: torch toggles on and off
4. Actual: nothing happens

### Acceptance Criteria
- Torch toggles correctly on iOS 16+
- Torch still works on Android (do not regress)
- Unit test or manual test instructions added to PR

### Resources
- src/screens/QRScannerScreen.tsx
- expo-camera docs: https://docs.expo.dev/versions/latest/sdk/camera/

### Reward
10 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
