import ClockKit

class ComplicationController: NSObject, CLKComplicationDataSource {
    
    private let connectivityManager = WatchConnectivityManager.shared
    
    // MARK: - Complication Configuration
    
    func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
        let descriptors = [
            CLKComplicationDescriptor(identifier: "ModularSmall", displayName: "Pet Health", supportedFamilies: [.modularSmall]),
            CLKComplicationDescriptor(identifier: "CircularSmall", displayName: "Pet Health", supportedFamilies: [.circularSmall])
        ]
        handler(descriptors)
    }
    
    func handleSharedComplicationDescriptors(_ complicationDescriptors: [CLKComplicationDescriptor]) {
        // No-op
    }
    
    // MARK: - Timeline Configuration
    
    func getTimelineEndDate(for complication: CLKComplication, withHandler handler: @escaping (Date?) -> Void) {
        handler(nil)
    }
    
    func getPrivacyBehavior(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationPrivacyBehavior) -> Void) {
        handler(.showOnLockScreen)
    }
    
    // MARK: - Timeline Population
    
    func getCurrentTimelineEntry(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void) {
        guard let petData = connectivityManager.petData else {
            handler(nil)
            return
        }
        
        var template: CLKComplicationTemplate?
        
        switch complication.family {
        case .modularSmall:
            template = modularSmallTemplate(for: petData)
        case .circularSmall:
            template = circularSmallTemplate(for: petData)
        default:
            break
        }
        
        if let template = template {
            let entry = CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template)
            handler(entry)
        } else {
            handler(nil)
        }
    }
    
    func getTimelineEntries(for complication: CLKComplication, after date: Date, limit: Int, withHandler handler: @escaping ([CLKComplicationTimelineEntry]?) -> Void) {
        handler(nil)
    }
    
    // MARK: - Templates
    
    private func modularSmallTemplate(for petData: PetData) -> CLKComplicationTemplate {
        let healthText = CLKSimpleTextProvider(text: "\(Int(petData.healthScore * 100))%")
        let nameText = CLKSimpleTextProvider(text: petData.name, shortText: String(petData.name.prefix(2)))
        let template = CLKComplicationTemplateModularSmallStackText(line1TextProvider: nameText, line2TextProvider: healthText)
        return template
    }
    
    private func circularSmallTemplate(for petData: PetData) -> CLKComplicationTemplate {
        let healthText = CLKSimpleTextProvider(text: "\(Int(petData.healthScore * 100))%")
        let template = CLKComplicationTemplateCircularSmallSimpleText(textProvider: healthText)
        return template
    }
}