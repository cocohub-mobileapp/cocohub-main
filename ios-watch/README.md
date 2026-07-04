# Cocohub Apple Watch Companion

This folder contains the iOS phone bridge and watchOS companion sources for the Apple Watch bounty.

## Phone target

Add `ios-watch/phone/CocohubWatchConnectivityModule.swift` and `ios-watch/phone/CocohubWatchConnectivityModule.m` to the iOS app target. The React Native service calls this module as `NativeModules.CocohubWatchConnectivity`.

The phone module:

- activates `WCSession`
- sends the active pet summary through `updateApplicationContext`
- caches the last payload under `group.app.cocohub.mobile` / `cocohub_watch_payload`
- emits `CocohubWatchSOS` when the watch sends an SOS action

## Watch target

Create a watchOS 10+ Watch App target named `CocohubWatch`, then add all files from `ios-watch/watch/` to that target.

The watch app:

- displays the active pet name, species, health score, and next medication dose
- sends SOS actions to the iPhone through WatchConnectivity
- stores the latest payload in watch `UserDefaults`
- includes ClockKit complications for `.modularSmall` and `.circularSmall`

The companion payload is built by `src/services/watchConnectivityService.ts` from the same local pet, health metric, medication, and SOS services used by the phone app.
