//
//  PetChainWidgetModule.swift
//  PetChain
//
//  Native bridge to communicate widget data between React Native app and WidgetKit
//

import Foundation
import WidgetKit
import React
import WatchConnectivity

@objc(PetChainWidget)
class PetChainWidget: NSObject, WCSessionDelegate {
    
    // MARK: - Properties
    
    private let appGroupId = "group.app.petchain.mobile"
    private let dataKey = "petchain_widget_data"
    private let watchDataKey = "cocohub_watch_glance_data"
    
    // MARK: - React Native Module Setup
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override init() {
        super.init()
        activateWatchSessionIfAvailable()
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

    /**
     Update watchOS companion glance data and push it to the paired watch.
     */
    @objc
    func updateWatchCompanion(_ data: NSDictionary, withResolver resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])

                guard let defaults = UserDefaults(suiteName: self.appGroupId) else {
                    reject("E_NO_APP_GROUP", "App groups not configured", nil)
                    return
                }

                defaults.set(jsonData, forKey: self.watchDataKey)
                defaults.synchronize()

                self.activateWatchSessionIfAvailable()
                self.sendWatchPayload(jsonData)

                resolve(true)
            } catch {
                reject("E_WATCH_UPDATE_FAILED", "Failed to update watch companion data", error)
            }
        }
    }

    /**
     Report whether a paired, installed watch companion is reachable or available.
     */
    @objc
    func isWatchCompanionAvailable(_ resolve: @escaping RCTPromiseResolveBlock, withRejecter reject: @escaping RCTPromiseRejectBlock) {
        guard WCSession.isSupported() else {
            resolve(false)
            return
        }

        let session = WCSession.default
        activateWatchSessionIfAvailable()
        resolve(session.isPaired && session.isWatchAppInstalled)
    }

    // MARK: - WatchConnectivity

    private func activateWatchSessionIfAvailable() {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        if session.delegate == nil {
            session.delegate = self
        }
        session.activate()
    }

    private func sendWatchPayload(_ jsonData: Data) {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        let payload = ["glanceData": jsonData]

        if session.activationState == .activated && session.isReachable {
            session.sendMessageData(jsonData, replyHandler: nil, errorHandler: nil)
        }

        try? session.updateApplicationContext(payload)
        session.transferUserInfo(payload)
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}
