import Foundation

struct PetData: Codable {
    var name: String
    var healthScore: Double
    var nextDoseTime: Date?
    
    init(name: String, healthScore: Double, nextDoseTime: Date?) {
        self.name = name
        self.healthScore = healthScore
        self.nextDoseTime = nextDoseTime
    }
}