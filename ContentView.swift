import SwiftUI
import ClockKit

struct ContentView: View {
    @State private var pet: Pet?

    var body: some View {
        VStack {
            Text(pet?.name?? "Loading...")
                .font(.headline)
            Text("Health Score: \(pet?.healthScore?? 0)")
            Text("Next Dose: \(pet?.nextDoseTime.formatted(date:.omitted, time:.shortened)?? "")")
            Button(action: triggerSOS) {
                Text("SOS")
                    .bold()
                   .padding(Edge.Set.horizontal, 20)
                   .padding(Edge.Set.vertical, 10)
                   .background(Color.red)
                   .foregroundColor(.white)
                    .cornerRadius(8)
            }
        }
        .onAppear {
            fetchDataFromiOSApp()
        }
    }

    private func fetchDataFromiOSApp() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.activate()
            session.sendMessage(["request": "petData"], replyHandler: { (reply) in
                if let petDict = reply["pet"] as? [String: Any],
                   let petName = petDict["name"] as? String,
                   let healthScore = petDict["healthScore"] as? Int,
                   let nextDoseTime = petDict["nextDoseTime"] as? Double {
                    let pet = Pet(name: petName, healthScore: healthScore, nextDoseTime: Date(timeIntervalSince1970: nextDoseTime))
                    self.pet = pet
                }
            }, errorHandler: { (error) in
                print("Error: \(error)")
            })
        }
    }

    private func triggerSOS() {
        // Trigger the same emergency flow as the phone
        // This can be implemented using a custom URL scheme or other inter-app communication methods
    }
}

@main
struct PetChainWatchApp: App {
    @WKExtensionDelegate var extensionDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
