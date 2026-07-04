import SwiftUI

@main
struct CocohubWatchApp: App {
    @StateObject private var store = CocohubWatchStore()

    var body: some Scene {
        WindowGroup {
            CocohubWatchView()
                .environmentObject(store)
        }
    }
}

struct CocohubWatchView: View {
    @EnvironmentObject private var store: CocohubWatchStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                header
                healthGauge
                nextDose
                sosButton
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
        }
        .navigationTitle("Cocohub")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(store.summary.petName)
                .font(.headline)
                .lineLimit(1)

            Text(store.summary.petSpecies.capitalized)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var healthGauge: some View {
        Gauge(value: Double(store.summary.healthScore), in: 0...100) {
            Text("Health")
        } currentValueLabel: {
            Text("\(store.summary.healthScore)")
                .font(.title3.monospacedDigit())
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .tint(healthTint)
        .accessibilityLabel("Health score")
        .accessibilityValue("\(store.summary.healthScore) percent")
    }

    private var nextDose: some View {
        Group {
            if let dose = store.summary.nextDose {
                VStack(alignment: .leading, spacing: 3) {
                    Label("Next dose", systemImage: "pills.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(dose.displayTime)
                        .font(.title2.monospacedDigit())
                    Text("\(dose.medicationName) - \(dose.dosage)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            } else {
                Label("No doses due", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var sosButton: some View {
        VStack(spacing: 5) {
            Button(role: .destructive) {
                store.triggerSOS()
            } label: {
                Label("SOS", systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)

            if let status = store.sosStatus {
                Text(status)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityHint("Triggers the Cocohub emergency flow on iPhone")
    }

    private var healthTint: Color {
        switch store.summary.healthStatus {
        case "urgent": return .red
        case "watch": return .orange
        default: return .green
        }
    }
}

#Preview {
    CocohubWatchView()
        .environmentObject(CocohubWatchStore())
}
