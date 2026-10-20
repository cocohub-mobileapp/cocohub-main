//
//  CocohubWatchApp.swift
//  CocohubWatchApp
//
//  watchOS 10+ SwiftUI companion app and complications (#38)
//  Shows active pet's health score, next medication dose, and SOS emergency shortcut.
//

import SwiftUI
import WidgetKit
import WatchConnectivity

// MARK: - Data Models

struct WatchPetData: Codable {
    let petId: String
    let petName: String
    let healthScore: Int
    let nextDoseName: String?
    let nextDoseTime: String?
    let emergencyContactsCount: Int
    let lastUpdated: Date

    static let placeholder = WatchPetData(
        petId: "pet-demo",
        petName: "Milo",
        healthScore: 94,
        nextDoseName: "Amoxicillin",
        nextDoseTime: "14:00",
        emergencyContactsCount: 2,
        lastUpdated: Date()
    )
}

// MARK: - WatchConnectivity Session Manager

class WatchSessionManager: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = WatchSessionManager()

    @Published var petData: WatchPetData = .placeholder
    @Published var isSosTriggered = false
    @Published var sosStatusMessage: String?

    override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Activation complete
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            self.parseContext(applicationContext)
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            self.parseContext(message)
        }
    }

    private func parseContext(_ dict: [String: Any]) {
        guard let petName = dict["petName"] as? String,
              let healthScore = dict["healthScore"] as? Int else { return }

        let petId = dict["petId"] as? String ?? "active-pet"
        let nextDoseName = dict["nextDoseName"] as? String
        let nextDoseTime = dict["nextDoseTime"] as? String
        let contactsCount = dict["emergencyContactsCount"] as? Int ?? 1

        self.petData = WatchPetData(
            petId: petId,
            petName: petName,
            healthScore: healthScore,
            nextDoseName: nextDoseName,
            nextDoseTime: nextDoseTime,
            emergencyContactsCount: contactsCount,
            lastUpdated: Date()
        )
        WidgetCenter.shared.reloadAllTimelines()
    }

    func triggerSOS() {
        guard WCSession.default.isReachable else {
            self.sosStatusMessage = "Phone unreachable. Calling emergency contacts directly..."
            return
        }

        let payload: [String: Any] = [
            "action": "trigger_sos",
            "source": "apple_watch",
            "timestamp": Date().timeIntervalSince1970
        ]

        WCSession.default.sendMessage(payload, replyHandler: { reply in
            DispatchQueue.main.async {
                self.isSosTriggered = true
                self.sosStatusMessage = "SOS Dispatched! Contacts notified."
                WKInterfaceDevice.current().play(.success)
            }
        }, errorHandler: { error in
            DispatchQueue.main.async {
                self.sosStatusMessage = "SOS Failed: (error.localizedDescription)"
                WKInterfaceDevice.current().play(.failure)
            }
        })
    }
}

// MARK: - Main Watch App View (watchOS 10+)

struct CocohubWatchContentView: View {
    @ObservedObject var sessionManager = WatchSessionManager.shared
    @State private var showingSosConfirmation = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    // Header
                    HStack {
                        Image(systemName: "pawprint.fill")
                            .foregroundColor(.orange)
                        Text(sessionManager.petData.petName)
                            .font(.headline)
                            .fontWeight(.bold)
                    }

                    // Health Score Ring
                    VStack {
                        ZStack {
                            Circle()
                                .stroke(Color.gray.opacity(0.2), lineWidth: 8)
                            Circle()
                                .trim(from: 0, to: CGFloat(sessionManager.petData.healthScore) / 100.0)
                                .stroke(scoreColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                            VStack(spacing: 2) {
                                Text("\(sessionManager.petData.healthScore)")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                Text("HEALTH")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .frame(width: 80, height: 80)
                    }
                    .padding(.vertical, 4)

                    // Next Medication
                    if let med = sessionManager.petData.nextDoseName, let time = sessionManager.petData.nextDoseTime {
                        HStack {
                            Image(systemName: "pills.fill")
                                .foregroundColor(.teal)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(med)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                Text("Next dose at \(time)")
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                        .padding(8)
                        .background(Color.gray.opacity(0.15))
                        .cornerRadius(8)
                    }

                    // SOS Shortcut Button
                    Button(action: {
                        showingSosConfirmation = true
                        WKInterfaceDevice.current().play(.directionUp)
                    }) {
                        HStack {
                            Image(systemName: "exclamationmark.shield.fill")
                            Text("EMERGENCY SOS")
                                .fontWeight(.bold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                    .confirmationDialog("Send Emergency SOS?", isPresented: $showingSosConfirmation, titleVisibility: .visible) {
                        Button("Confirm SOS", role: .destructive) {
                            sessionManager.triggerSOS()
                        }
                        Button("Cancel", role: .cancel) {}
                    }

                    if let status = sessionManager.sosStatusMessage {
                        Text(status)
                            .font(.system(size: 9))
                            .foregroundColor(sessionManager.isSosTriggered ? .green : .red)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding()
            }
        }
    }

    private var scoreColor: Color {
        if sessionManager.petData.healthScore >= 80 { return .green }
        if sessionManager.petData.healthScore >= 60 { return .yellow }
        return .red
    }
}

// MARK: - WidgetKit Complications

struct CocohubWatchWidgetEntry: TimelineEntry {
    let date: Date
    let data: WatchPetData
}

struct CocohubWatchWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> CocohubWatchWidgetEntry {
        CocohubWatchWidgetEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (CocohubWatchWidgetEntry) -> Void) {
        completion(CocohubWatchWidgetEntry(date: Date(), data: WatchSessionManager.shared.petData))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CocohubWatchWidgetEntry>) -> Void) {
        let entry = CocohubWatchWidgetEntry(date: Date(), data: WatchSessionManager.shared.petData)
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60)))
        completion(timeline)
    }
}

struct CocohubWatchComplicationView: View {
    @Environment(\.widgetFamily) var family
    let entry: CocohubWatchWidgetEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            // Modular Small / Circular Small
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Image(systemName: "pawprint.fill")
                        .font(.system(size: 10))
                        .foregroundColor(.orange)
                    Text("\(entry.data.healthScore)")
                        .font(.system(size: 13, weight: .bold))
                }
            }
        case .accessoryRectangular:
            // Modular Rectangular
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(entry.data.petName)
                        .font(.headline)
                    Spacer()
                    Text("Score: \(entry.data.healthScore)")
                        .font(.caption2)
                        .foregroundColor(.orange)
                }
                if let med = entry.data.nextDoseName, let time = entry.data.nextDoseTime {
                    Text("💊 \(med) at \(time)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        default:
            Text("\(entry.data.healthScore)")
        }
    }
}

@main
struct CocohubWatchApp: App {
    var body: some Scene {
        WindowGroup {
            CocohubWatchContentView()
        }
    }
}
