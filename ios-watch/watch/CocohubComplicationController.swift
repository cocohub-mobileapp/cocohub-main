import ClockKit
import Foundation

final class CocohubComplicationController: NSObject, CLKComplicationDataSource {
    private let defaultsKey = "cocohub_watch_payload"

    func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
        handler([
            CLKComplicationDescriptor(
                identifier: "cocohub-health",
                displayName: "Cocohub Health",
                supportedFamilies: [.modularSmall, .circularSmall]
            )
        ])
    }

    func handleSharedComplicationDescriptors(_ complicationDescriptors: [CLKComplicationDescriptor]) {}

    func getCurrentTimelineEntry(
        for complication: CLKComplication,
        withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void
    ) {
        guard let template = makeTemplate(for: complication.family) else {
            handler(nil)
            return
        }

        handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template))
    }

    func getLocalizableSampleTemplate(
        for complication: CLKComplication,
        withHandler handler: @escaping (CLKComplicationTemplate?) -> Void
    ) {
        handler(makeTemplate(for: complication.family, summary: .placeholder))
    }

    private func makeTemplate(
        for family: CLKComplicationFamily,
        summary: WatchPetSummary? = nil
    ) -> CLKComplicationTemplate? {
        let data = summary ?? loadSummary()
        let scoreText = "\(data.healthScore)%"

        switch family {
        case .modularSmall:
            return CLKComplicationTemplateModularSmallStackText(
                line1TextProvider: CLKSimpleTextProvider(text: data.petName),
                line2TextProvider: CLKSimpleTextProvider(text: scoreText)
            )
        case .circularSmall:
            return CLKComplicationTemplateCircularSmallRingText(
                textProvider: CLKSimpleTextProvider(text: "\(data.healthScore)"),
                fillFraction: Float(data.healthScore) / 100,
                ringStyle: .closed
            )
        default:
            return nil
        }
    }

    private func loadSummary() -> WatchPetSummary {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey),
              let cached = try? JSONDecoder().decode(WatchPetSummary.self, from: data) else {
            return .placeholder
        }
        return cached
    }
}
