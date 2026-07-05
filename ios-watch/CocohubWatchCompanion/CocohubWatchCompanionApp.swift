import SwiftUI

@main
struct CocohubWatchCompanionApp: App {
    @StateObject private var store = WatchSessionStore()

    var body: some Scene {
        WindowGroup {
            PetHealthGlanceView(data: store.glanceData, syncText: store.lastSyncText)
        }
    }
}
