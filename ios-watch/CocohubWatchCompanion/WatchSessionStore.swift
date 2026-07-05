import Foundation
import WatchConnectivity

final class WatchSessionStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var glanceData: WatchGlanceData = .placeholder
    @Published private(set) var lastSyncText: String = "Waiting for iPhone"

    private let decoder = JSONDecoder()

    override init() {
        super.init()
        activate()
    }

    private func activate() {
        guard WCSession.isSupported() else {
            lastSyncText = "WatchConnectivity unavailable"
            return
        }

        let session = WCSession.default
        session.delegate = self
        session.activate()

        if let data = session.receivedApplicationContext["glanceData"] as? Data {
            apply(data)
        }
    }

    private func apply(_ data: Data) {
        do {
            glanceData = try decoder.decode(WatchGlanceData.self, from: data)
            lastSyncText = "Updated"
        } catch {
            lastSyncText = "Sync data unavailable"
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if error != nil {
            lastSyncText = "Sync failed"
        }
    }

    func session(_ session: WCSession, didReceiveMessageData messageData: Data) {
        DispatchQueue.main.async {
            self.apply(messageData)
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let data = userInfo["glanceData"] as? Data else {
            return
        }

        DispatchQueue.main.async {
            self.apply(data)
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        guard let data = applicationContext["glanceData"] as? Data else {
            return
        }

        DispatchQueue.main.async {
            self.apply(data)
        }
    }
}
