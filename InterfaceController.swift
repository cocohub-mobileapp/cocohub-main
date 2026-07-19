import WatchConnectivity

class InterfaceController: WKInterfaceController, WCSessionDelegate {
    @IBOutlet weak var petNameLabel: WKInterfaceLabel!
    @IBOutlet weak var healthScoreLabel: WKInterfaceLabel!
    @IBOutlet weak var nextDoseTimeLabel: WKInterfaceLabel!

    var session: WCSession?

    override func awake(withContext context: Any?) {
        super.awake(withContext: context)
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        if let petDict = message["pet"] as? [String: Any],
           let petName = petDict["name"] as? String,
           let healthScore = petDict["healthScore"] as? Int,
           let nextDoseTime = petDict["nextDoseTime"] as? Double {
            let pet = Pet(name: petName, healthScore: healthScore, nextDoseTime: Date(timeIntervalSince1970: nextDoseTime))
            updateUI(with: pet)
        }
    }

    private func updateUI(with pet: Pet) {
        petNameLabel.setText(pet.name)
        healthScoreLabel.setText("\(pet.healthScore)")
        nextDoseTimeLabel.setText(pet.nextDoseTime.formatted(date:.omitted, time:.shortened))
    }
}
