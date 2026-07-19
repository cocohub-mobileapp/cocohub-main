import WatchConnectivity

class AppDelegate: UIResponder, UIApplicationDelegate, WCSessionDelegate {
    var window: UIWindow?
    var session: WCSession?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
        return true
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Handle session activation
    }

    func sessionDidBecomeInactive(_ session: WCSession) {
        // Handle session becoming inactive
    }

    func sessionDidDeactivate(_ session: WCSession) {
        // Handle session deactivation
    }

    func sendPetData(toWatch pet: Pet) {
        if let session = session, session.isReachable {
            session.sendMessage(["pet": pet], replyHandler: nil, errorHandler: { error in
                print("Error sending message: \(error)")
            })
        }
    }
}
