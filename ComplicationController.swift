import ClockKit

class ComplicationController: NSObject, CLKComplicationDataSource {
    @Published var pet: Pet?

    override init() {
        super.init()
        fetchDataFromiOSApp()
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

    func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
        let descriptors: [CLKComplicationDescriptor] = [
            CLKComplicationDescriptor(identifier: "complication", displayName: "Pet Chain", supportedFamilies: [.modularSmall,.circularSmall])
        ]
        handler(descriptors)
    }

    func getCurrentTimelineEntry(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void) {
        guard let pet = pet else {
            handler(nil)
            return
        }

        let template = CLKComplicationTemplateModularSmallStackText()
        template.line1ImageProvider = CLKImageProvider(onePieceImage: UIImage(named: "petchain_icon"))
        template.line1TextProvider = CLKSimpleTextProvider(text: "\(pet.healthScore)")
        template.line2TextProvider = CLKSimpleTextProvider(text: pet.nextDoseTime.formatted(date:.omitted, time:.shortened))

        let timelineEntry = CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template)
        handler(timelineEntry)
    }
}
