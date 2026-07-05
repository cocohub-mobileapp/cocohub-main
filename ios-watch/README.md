# Cocohub Watch Companion

This directory contains the watchOS 10+ SwiftUI companion app source for issue #5.

## Target wiring

Add a watchOS app target in Xcode named `CocohubWatchCompanion`, then include:

- `CocohubWatchCompanion/CocohubWatchCompanionApp.swift`
- `CocohubWatchCompanion/PetHealthGlanceView.swift`
- `CocohubWatchCompanion/WatchGlanceModels.swift`
- `CocohubWatchCompanion/WatchSessionStore.swift`
- `CocohubWatchCompanion/Info.plist`
- `CocohubWatchCompanion/CocohubWatchCompanion.entitlements`

Suggested target settings:

- Platform: `watchOS`
- Minimum deployment: `10.0`
- Bundle identifier: `app.cocohub.mobile.watchkitapp`
- Product type: watchOS app
- Entitlements file: `CocohubWatchCompanion.entitlements`
- Frameworks: `SwiftUI`, `WatchConnectivity`, `Foundation`

Enable WatchConnectivity for the iOS app target and the watch target. The iOS app sends the compact glance payload from `src/services/watchCompanionService.ts` through `PetChainWidgetModule.updateWatchCompanion`.

The repository is Expo-managed and does not currently commit a generated `ios/` Xcode project. During native prebuild or a bare iOS checkout, copy this directory into the generated `ios/` project and add the files above to the watch target. Keep the app-group entitlement aligned with the iOS app's `group.app.cocohub.mobile` value.

## Deep links

The watch app opens the iPhone app with these links:

- `cocohub://health/:petId`
- `cocohub://medications/:medicationId`
- `cocohub://appointments/:appointmentId`
- `cocohub://sos`

## Data shown

The watch glance displays the active pet name and health score, the next untaken medication, the next appointment, and an emergency SOS shortcut.
