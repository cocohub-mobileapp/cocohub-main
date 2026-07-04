//
//  CocohubWidgetModule.swift
//  Cocohub
//
//  Native bridge to communicate widget data between React Native app and WidgetKit
//

import Foundation
import WidgetKit
import React

@objc(CocohubWidget)
class CocohubWidget: NSObject {
    
    // MARK: - Properties
    
    private let appGroupId = "group.app.cocohub.mobile"
    private let dataKey = "cocohub_widget_data"
    
    // MARK: - React Native Module Setup
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    // MARK: - Public Methods
    
    /**
     Update widget with new data from the React Native app
     */
    @objc
    func updateWidget(_ data: NSDictionary, withResolver resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
                
                guard let defaults = UserDefaults(suiteName: self.appGroupId) else {
                    reject("E_NO_APP_GROUP", "App groups not configured", nil)
                    return
                }
                
                defaults.set(jsonData, forKey: self.dataKey)
                defaults.synchronize()
                
                // Notify WidgetKit to refresh the timeline
                if #available(iOS 14.0, *) {
                    WidgetCenter.shared.reloadAllTimelines()
                }
                
                resolve(true)
            } catch {
                reject("E_UPDATE_FAILED", "Failed to update widget data", error)
            }
        }
    }
    
    /**
     Check if WidgetKit is available on this device
     */
    @objc
    func isWidgetKitAvailable(_ resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 14.0, *) {
            resolve(true)
        } else {
            resolve(false)
        }
    }
    
    /**
     Get current widget data from shared storage
     */
    @objc
    func getWidgetData(_ resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            reject("E_NO_APP_GROUP", "App groups not configured", nil)
            return
        }
        
        guard let data = defaults.data(forKey: dataKey) else {
            resolve(NSNull())
            return
        }
        
        do {
            let json = try JSONSerialization.jsonObject(with: data, options: [])
            resolve(json)
        } catch {
            reject("E_PARSE_FAILED", "Failed to parse widget data", error)
        }
    }
    
    /**
     Clear widget data
     */
    @objc
    func clearWidgetData(_ resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            reject("E_NO_APP_GROUP", "App groups not configured", nil)
            return
        }
        
        defaults.removeObject(forKey: dataKey)
        defaults.synchronize()
        
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        
        resolve(true)
    }
}
