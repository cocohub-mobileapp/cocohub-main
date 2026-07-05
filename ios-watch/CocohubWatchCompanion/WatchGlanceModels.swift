import Foundation

struct WatchGlanceData: Codable {
    let activePet: WatchPet?
    let nextMedication: WatchMedication?
    let nextAppointment: WatchAppointment?
    let healthDeepLink: String?
    let emergencyDeepLink: String
    let generatedAt: String
}

struct WatchPet: Codable {
    let petId: String
    let petName: String
    let petSpecies: String?
    let healthScore: Int
}

struct WatchMedication: Codable, Identifiable {
    let id: String
    let medicationId: String
    let medicationName: String
    let dosage: String
    let petName: String
    let petId: String
    let scheduledTime: String?
    let deepLink: String
}

struct WatchAppointment: Codable, Identifiable {
    let id: String
    let title: String
    let date: String
    let time: String
    let petName: String
    let petId: String
    let deepLink: String
}

extension WatchGlanceData {
    static let placeholder = WatchGlanceData(
        activePet: WatchPet(petId: "pet-demo", petName: "Milo", petSpecies: "dog", healthScore: 88),
        nextMedication: WatchMedication(
            id: "med-demo-today",
            medicationId: "med-demo",
            medicationName: "Heartworm",
            dosage: "1 tab",
            petName: "Milo",
            petId: "pet-demo",
            scheduledTime: "18:00",
            deepLink: "cocohub://medications/med-demo"
        ),
        nextAppointment: WatchAppointment(
            id: "apt-demo",
            title: "Annual checkup",
            date: "2026-07-06",
            time: "10:30",
            petName: "Milo",
            petId: "pet-demo",
            deepLink: "cocohub://appointments/apt-demo"
        ),
        healthDeepLink: "cocohub://health/pet-demo",
        emergencyDeepLink: "cocohub://sos",
        generatedAt: ISO8601DateFormatter().string(from: Date())
    )
}
