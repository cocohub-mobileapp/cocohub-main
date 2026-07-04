import Foundation
import React
import WatchConnectivity

@objc(CocohubWatchConnectivity)
final class CocohubWatchConnectivity: RCTEventEmitter, WCSessionDelegate {
    private let appGroupId = "group.app.cocohub.mobile"
    private let payloadKey = "cocohub_watch_payload"
    private var hasListeners = false
    private var pendingSOS: [String: Any]?

    override static func requiresMainQueueSetup() -> Bool {
        false
    }

    override func supportedEvents() -> [String]! {
        ["CocohubWatchSOS"]
    }

    override func startObserving() {
        hasListeners = true
        if let pendingSOS {
            sendEvent(withName: "CocohubWatchSOS", body: pendingSOS)
            self.pendingSOS = nil
        }
    }

    override func stopObserving() {
        hasListeners = false
    }

    @objc
    func activate(_ resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        guard WCSession.isSupported() else {
            resolve(false)
            return
        }

        let session = WCSession.default
        session.delegate = self
        session.activate()
        resolve(true)
    }

    @objc
    func isWatchAvailable(_ resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        guard WCSession.isSupported() else {
            resolve(false)
            return
        }

        let session = WCSession.default
        resolve(session.isPaired && session.isWatchAppInstalled)
    }

    @objc
    func updateApplicationContext(
        _ payload: NSDictionary,
        withResolver resolve: @escaping RCTPromiseResolveBlock,
        withRejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            let context: [String: Any] = ["cocohubWatchPayload": payload]
            let jsonData = try JSONSerialization.data(withJSONObject: payload, options: [])

            if let defaults = UserDefaults(suiteName: appGroupId) {
                defaults.set(jsonData, forKey: payloadKey)
                defaults.synchronize()
            }

            guard WCSession.isSupported() else {
                resolve(false)
                return
            }

            let session = WCSession.default
            session.delegate = self
            if session.activationState == .notActivated {
                session.activate()
            }

            try session.updateApplicationContext(context)

            if session.isReachable {
                session.sendMessage(context, replyHandler: nil, errorHandler: nil)
            }

            resolve(true)
        } catch {
            reject("E_WATCH_SYNC_FAILED", "Failed to sync Apple Watch payload", error)
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard message["action"] as? String == "sos" else { return }

        let body: [String: Any] = [
            "message": message["message"] as? String ?? "Pet emergency - need immediate help",
            "timestamp": message["timestamp"] ?? Date().timeIntervalSince1970
        ]

        DispatchQueue.main.async {
            if self.hasListeners {
                self.sendEvent(withName: "CocohubWatchSOS", body: body)
            } else {
                self.pendingSOS = body
            }
        }
    }
}
