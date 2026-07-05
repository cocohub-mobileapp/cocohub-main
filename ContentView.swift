import SwiftUI

struct ContentView: View {
    @State private var petName: String = "Loading..."
    @State private var healthScore: Double = 0.0
    @State private var nextDoseTime: Date? = nil
    @State private var showingSOSAlert = false
    
    private let connectivityManager = WatchConnectivityManager.shared
    
    var body: some View {
        VStack(spacing: 10) {
            Text(petName)
                .font(.headline)
            
            HStack {
                Text("Health: \(Int(healthScore * 100))%")
                    .font(.body)
            }
            
            if let doseTime = nextDoseTime {
                Text("Next dose: \(doseTime, style: .time)")
                    .font(.caption)
            } else {
                Text("No upcoming dose")
                    .font(.caption)
            }
            
            Spacer()
            
            Button(action: {
                showingSOSAlert = true
            }) {
                Text("SOS")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.red)
                    .clipShape(Circle())
            }
            .alert("Trigger Emergency?", isPresented: $showingSOSAlert) {
                Button("Cancel", role: .cancel) { }
                Button("Send SOS", role: .destructive) {
                    connectivityManager.sendSOS()
                }
            } message: {
                Text("This will alert your emergency contacts.")
            }
        }
        .padding()
        .onReceive(NotificationCenter.default.publisher(for: .petDataUpdated)) { _ in
            updateUI()
        }
        .onAppear {
            updateUI()
        }
    }
    
    private func updateUI() {
        if let data = connectivityManager.petData {
            petName = data.name
            healthScore = data.healthScore
            nextDoseTime = data.nextDoseTime
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}