//
//  CocohubWidget.swift
//  CocohubWidget
//
//  iOS WidgetKit implementation for Cocohub home screen widgets
//  Shows today's medication schedule, upcoming appointments, and pet health scores
//

import WidgetKit
import SwiftUI
import Foundation

private enum CocohubWidgetConfig {
    static let appGroupId = "group.app.cocohub.mobile"
    static let dataKey = "cocohub_widget_data"
}

// MARK: - Data Models

struct MedicationItem: Codable {
    let id: String
    let medicationId: String
    let medicationName: String
    let dosage: String
    let petName: String
    let petId: String
    let scheduledTime: String?
    let frequency: Int
    let taken: Bool
}

struct AppointmentItem: Codable {
    let id: String
    let title: String
    let date: String
    let time: String
    let petName: String
    let petId: String
    let vetName: String?
    let durationMinutes: Int?
}

struct HealthScore: Codable {
    let petId: String
    let petName: String
    let petSpecies: String
    let healthScore: Int
    let lastUpdated: String
}

struct WidgetDataModel: Codable {
    let medications: [MedicationItem]
    let appointments: [AppointmentItem]
    let healthScores: [HealthScore]
    let lastUpdated: String
    let timestamp: Int
}

// MARK: - Widget Provider

struct PetChainWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> PetChainWidgetEntry {
        PetChainWidgetEntry(date: Date(), widgetData: nil, error: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (PetChainWidgetEntry) -> Void) {
        let entry = PetChainWidgetEntry(date: Date(), widgetData: loadWidgetData(), error: nil)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PetChainWidgetEntry>) -> Void) {
        let widgetData = loadWidgetData()
        let entry = PetChainWidgetEntry(date: Date(), widgetData: widgetData, error: nil)
        
        // Update widget every 15 minutes
        let calendar = Calendar.current
        let nextRefresh = calendar.date(byAdding: .minute, value: 15, to: Date())!
        
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }
    
    private func loadWidgetData() -> WidgetDataModel? {
        guard let appGroupDefaults = UserDefaults(suiteName: CocohubWidgetConfig.appGroupId) else {
            return nil
        }
        
        guard let data = appGroupDefaults.data(forKey: CocohubWidgetConfig.dataKey) else {
            return nil
        }
        
        let decoder = JSONDecoder()
        return try? decoder.decode(WidgetDataModel.self, from: data)
    }
}

struct PetChainWidgetEntry: TimelineEntry {
    let date: Date
    let widgetData: WidgetDataModel?
    let error: String?
}

// MARK: - Widget Views

struct PetChainSmallWidget: View {
    let entry: PetChainWidgetProvider.Entry
    @Environment(\.widgetFamily) var widgetFamily
    
    var body: some View {
        ZStack {
            Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor.black : UIColor.white })
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Cocohub")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.blue)
                
                if let data = entry.widgetData {
                    VStack(alignment: .leading, spacing: 4) {
                        // Show next medication
                        if let nextMed = data.medications.first(where: { !$0.taken }) {
                            Label {
                                Text(nextMed.medicationName)
                                    .font(.system(size: 10, weight: .semibold))
                                    .lineLimit(1)
                            } icon: {
                                Image(systemName: "pill.circle.fill")
                                    .foregroundColor(.orange)
                            }
                        }
                        
                        // Show next appointment
                        if let nextApt = data.appointments.first {
                            Label {
                                Text(nextApt.title)
                                    .font(.system(size: 10, weight: .semibold))
                                    .lineLimit(1)
                            } icon: {
                                Image(systemName: "calendar.circle.fill")
                                    .foregroundColor(.blue)
                            }
                        }
                        
                        // Show health score
                        if let healthScore = data.healthScores.first {
                            Label {
                                Text("\(healthScore.healthScore)% Health")
                                    .font(.system(size: 10, weight: .semibold))
                            } icon: {
                                Image(systemName: "heart.circle.fill")
                                    .foregroundColor(.red)
                            }
                        }
                    }
                } else {
                    Text("No data")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
            }
            .padding(12)
        }
        .widgetBackground(backgroundView: Color.clear)
    }
}

struct PetChainMediumWidget: View {
    let entry: PetChainWidgetProvider.Entry
    
    var body: some View {
        ZStack {
            Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor.black : UIColor.white })
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Cocohub Daily")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.blue)
                
                if let data = entry.widgetData {
                    HStack(spacing: 16) {
                        // Medications
                        VStack(alignment: .leading, spacing: 4) {
                            Label("Medications", systemImage: "pill.circle.fill")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.orange)
                            
                            ForEach(data.medications.prefix(2), id: \.id) { med in
                                HStack {
                                    Image(systemName: med.taken ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 10))
                                        .foregroundColor(med.taken ? .green : .gray)
                                    Text(med.medicationName)
                                        .font(.system(size: 10))
                                        .lineLimit(1)
                                }
                            }
                        }
                        
                        Divider()
                        
                        // Appointments
                        VStack(alignment: .leading, spacing: 4) {
                            Label("Appointments", systemImage: "calendar.circle.fill")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.blue)
                            
                            ForEach(data.appointments.prefix(2), id: \.id) { apt in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(apt.title)
                                        .font(.system(size: 9, weight: .semibold))
                                        .lineLimit(1)
                                    Text(apt.date)
                                        .font(.system(size: 8))
                                        .foregroundColor(.gray)
                                }
                            }
                        }
                    }
                    .padding(.top, 4)
                } else {
                    Text("Loading...")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
            }
            .padding(12)
        }
        .widgetBackground(backgroundView: Color.clear)
    }
}

struct PetChainLargeWidget: View {
    let entry: PetChainWidgetProvider.Entry
    
    var body: some View {
        ZStack {
            Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor.black : UIColor.white })
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Cocohub Health Overview")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.blue)
                
                if let data = entry.widgetData {
                    VStack(alignment: .leading, spacing: 10) {
                        // Pet Health Scores
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Pet Health Status", systemImage: "heart.circle.fill")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.red)
                            
                            ForEach(data.healthScores, id: \.petId) { score in
                                HStack {
                                    Text(score.petName)
                                        .font(.system(size: 11, weight: .medium))
                                        .frame(maxWidth: 80, alignment: .leading)
                                    
                                    GeometryReader { geometry in
                                        ZStack(alignment: .leading) {
                                            Color.gray.opacity(0.2)
                                            Color.green
                                                .frame(width: geometry.size.width * CGFloat(score.healthScore) / 100)
                                        }
                                        .cornerRadius(4)
                                    }
                                    .frame(height: 6)
                                    
                                    Text("\(score.healthScore)%")
                                        .font(.system(size: 10, weight: .semibold))
                                        .frame(width: 35, alignment: .trailing)
                                }
                            }
                        }
                        
                        Divider()
                        
                        // Today's Medications
                        VStack(alignment: .leading, spacing: 4) {
                            Label("Today's Medications", systemImage: "pill.circle.fill")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.orange)
                            
                            ForEach(data.medications, id: \.id) { med in
                                HStack(spacing: 8) {
                                    Image(systemName: med.taken ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(med.taken ? .green : .yellow)
                                    
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(med.medicationName)
                                            .font(.system(size: 10, weight: .semibold))
                                        Text("\(med.petName) - \(med.dosage)")
                                            .font(.system(size: 9))
                                            .foregroundColor(.gray)
                                    }
                                    
                                    Spacer()
                                }
                            }
                        }
                    }
                    .padding(.top, 4)
                } else {
                    Text("Loading pet data...")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                }
            }
            .padding(12)
        }
        .widgetBackground(backgroundView: Color.clear)
    }
}

// MARK: - Widget Bundle

@main
struct CocohubWidgetBundle: WidgetBundle {
    var body: some Widget {
        CocohubWidget()
    }
}

struct CocohubWidget: Widget {
    let kind: String = "com.cocohub.widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PetChainWidgetProvider()) { entry in
            PetChainWidgetEntryView(entry: entry)
                .containerBackground(.fill, for: .widget)
        }
        .configurationDisplayName("Cocohub Health")
        .description("View your pet's health, medications, and appointments.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct PetChainWidgetEntryView: View {
    @Environment(\.widgetFamily) var widgetFamily
    var entry: PetChainWidgetProvider.Entry
    
    @ViewBuilder
    var body: some View {
        switch widgetFamily {
        case .systemSmall:
            PetChainSmallWidget(entry: entry)
        case .systemMedium:
            PetChainMediumWidget(entry: entry)
        case .systemLarge:
            PetChainLargeWidget(entry: entry)
        default:
            PetChainMediumWidget(entry: entry)
        }
    }
}

// MARK: - Preview

#Preview(as: .systemMedium) {
    CocohubWidget()
} timeline: {
    PetChainWidgetEntry(date: .now, widgetData: nil, error: nil)
}

// MARK: - Widget Background Modifier

extension View {
    @ViewBuilder
    func widgetBackground(backgroundView: some View) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) {
                backgroundView
            }
        } else {
            self.background(backgroundView)
        }
    }
}
