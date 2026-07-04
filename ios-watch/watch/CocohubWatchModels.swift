import Foundation

struct WatchDoseSummary: Codable, Equatable {
    let medicationId: String
    let medicationName: String
    let dosage: String
    let scheduledFor: String
    let displayTime: String
}

struct WatchPetSummary: Codable, Equatable {
    let petId: String
    let petName: String
    let petSpecies: String
    let healthScore: Int
    let healthStatus: String
    let nextDose: WatchDoseSummary?
    let lastUpdated: String
    let emergencyMessage: String

    static let placeholder = WatchPetSummary(
        petId: "placeholder",
        petName: "Cocohub",
        petSpecies: "pet",
        healthScore: 75,
        healthStatus: "good",
        nextDose: nil,
        lastUpdated: ISO8601DateFormatter().string(from: Date()),
        emergencyMessage: "Pet emergency - need immediate help"
    )
}
