import Foundation
import WatchConnectivity

class WatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()
    
    var petData: PetData? {
        didSet {
            NotificationCenter.default.post(name: .petDataUpdated, object: nil)
        }
    }
    
    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { }
    
    func session(_ session: WCSession, didReceiveMessageData messageData: Data) {
        do {
            let decoder = JSONDecoder()
            let data = try decoder.decode(PetData.self, from: messageData)
            petData = data
        } catch {
            print("Failed to decode PetData: \(error)")
        }
    }
    
    func sendSOS() {
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(["command": "SOS"], replyHandler: nil, errorHandler: { error in
                print("Failed to send SOS: \(error)")
            })
        }
    }
}

extension Notification.Name {
    static let petDataUpdated = Notification.Name("petDataUpdated")
}