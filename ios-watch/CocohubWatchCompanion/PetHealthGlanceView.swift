import SwiftUI

struct PetHealthGlanceView: View {
    let data: WatchGlanceData
    let syncText: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                header
                medicationSection
                appointmentSection
                emergencySection
                Text(syncText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
    }

    private var header: some View {
        Link(destination: url(data.healthDeepLink)) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .stroke(.green.opacity(0.25), lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: CGFloat((data.activePet?.healthScore ?? 0)) / 100)
                        .stroke(.green, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(data.activePet?.healthScore ?? 0)")
                        .font(.headline)
                        .monospacedDigit()
                }
                .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: 2) {
                    Text(data.activePet?.petName ?? "No pet selected")
                        .font(.headline)
                        .lineLimit(1)
                    Text("Health score")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    private var medicationSection: some View {
        Group {
            if let medication = data.nextMedication {
                Link(destination: url(medication.deepLink)) {
                    row(
                        title: medication.medicationName,
                        subtitle: "\(medication.petName) - \(medication.dosage)",
                        footnote: medication.scheduledTime ?? "Next dose",
                        systemImage: "pills.fill",
                        color: .orange
                    )
                }
                .buttonStyle(.plain)
            } else {
                row(
                    title: "No medication due",
                    subtitle: "All caught up",
                    footnote: "",
                    systemImage: "checkmark.circle.fill",
                    color: .green
                )
            }
        }
    }

    private var appointmentSection: some View {
        Group {
            if let appointment = data.nextAppointment {
                Link(destination: url(appointment.deepLink)) {
                    row(
                        title: appointment.title,
                        subtitle: appointment.petName,
                        footnote: "\(appointment.date) \(appointment.time)",
                        systemImage: "calendar",
                        color: .blue
                    )
                }
                .buttonStyle(.plain)
            } else {
                row(
                    title: "No appointments",
                    subtitle: "Nothing scheduled",
                    footnote: "",
                    systemImage: "calendar.badge.checkmark",
                    color: .blue
                )
            }
        }
    }

    private var emergencySection: some View {
        Link(destination: url(data.emergencyDeepLink)) {
            HStack {
                Image(systemName: "cross.case.fill")
                    .foregroundStyle(.red)
                Text("Emergency SOS")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(10)
            .background(.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private func row(
        title: String,
        subtitle: String,
        footnote: String,
        systemImage: String,
        color: Color
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: systemImage)
                .foregroundStyle(color)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if !footnote.isEmpty {
                    Text(footnote)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
    }

    private func url(_ value: String?) -> URL {
        URL(string: value ?? "cocohub://health") ?? URL(string: "cocohub://health")!
    }
}

#Preview {
    PetHealthGlanceView(data: .placeholder, syncText: "Updated")
}
