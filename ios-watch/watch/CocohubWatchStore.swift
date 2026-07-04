import Foundation
import WatchConnectivity

@MainActor
final class CocohubWatchStore: NSObject, ObservableObject {
    @Published private(set) var summary: WatchPetSummary = .placeholder
    @Published private(set) var sosStatus: String?

    private let defaultsKey = "cocohub_watch_payload"

    override init() {
        super.init()
        loadCachedSummary()
        activateSession()
    }

    func triggerSOS() {
        sosStatus = "Sending SOS"

        let message: [String: Any] = [
            "action": "sos",
            "message": summary.emergencyMessage,
            "timestamp": Date().timeIntervalSince1970
        ]

        guard WCSession.isSupported(), WCSession.default.activationState == .activated else {
            sosStatus = "Open Cocohub on iPhone"
            return
        }

        WCSession.default.sendMessage(
            message,
            replyHandler: { [weak self] _ in
                Task { @MainActor in self?.sosStatus = "SOS sent" }
            },
            errorHandler: { [weak self] _ in
                Task { @MainActor in self?.sosStatus = "Open Cocohub on iPhone" }
            }
        )
    }

    private func activateSession() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()

        if let payload = session.receivedApplicationContext["cocohubWatchPayload"] {
            applyPayload(payload)
        }
    }

    private func loadCachedSummary() {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey),
              let cached = try? JSONDecoder().decode(WatchPetSummary.self, from: data) else {
            return
        }
        summary = cached
    }

    private func applyPayload(_ payload: Any) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let nextSummary = try? JSONDecoder().decode(WatchPetSummary.self, from: data) else {
            return
        }

        summary = nextSummary
        UserDefaults.standard.set(data, forKey: defaultsKey)
        sosStatus = nil
    }
}

extension CocohubWatchStore: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        guard let payload = applicationContext["cocohubWatchPayload"] else { return }
        Task { @MainActor in
            self.applyPayload(payload)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let payload = message["cocohubWatchPayload"] else { return }
        Task { @MainActor in
            self.applyPayload(payload)
        }
    }
}
