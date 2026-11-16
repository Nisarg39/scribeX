import Foundation
import React

@objc(ScribeXShareIntent)
class ScribeXShareIntentModule: RCTEventEmitter {
  private static let appGroupId = "group.com.nashtech.scribex"
  private static let pendingJsonName = "pending_share.json"
  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["onSharePayloadReceived"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(getPendingSharePayload:rejecter:)
  func getPendingSharePayload(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let containerUrl = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: ScribeXShareIntentModule.appGroupId
    ) else {
      resolve(nil)
      return
    }

    let pendingUrl = containerUrl.appendingPathComponent(ScribeXShareIntentModule.pendingJsonName)
    guard FileManager.default.fileExists(atPath: pendingUrl.path) else {
      resolve(nil)
      return
    }

    do {
      let data = try Data(contentsOf: pendingUrl)
      guard var payload = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
        resolve(nil)
        return
      }

      // Copy intact files from App Group container into the app's persistent Documents/shared_media/ folder
      if let rawFiles = payload["files"] as? [[String: Any]] {
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let mediaDir = documentsDir.appendingPathComponent("shared_media", isDirectory: true)
        if !FileManager.default.fileExists(atPath: mediaDir.path) {
          try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        }

        var persistedFiles: [[String: Any]] = []
        for item in rawFiles {
          var updated = item
          if let uriString = item["uri"] as? String, let srcUrl = URL(string: uriString) {
            let fileName = (item["fileName"] as? String) ?? srcUrl.lastPathComponent
            let sanitized = fileName.replacingOccurrences(of: "[^a-zA-Z0-9._-]", with: "_", options: .regularExpression)
            let destUrl = mediaDir.appendingPathComponent("\(Int(Date().timeIntervalSince1970 * 1000))_\(sanitized)")
            if FileManager.default.fileExists(atPath: srcUrl.path) {
              try? FileManager.default.copyItem(at: srcUrl, to: destUrl)
              try? FileManager.default.removeItem(at: srcUrl)
              updated["uri"] = destUrl.absoluteString
            }
          }
          persistedFiles.append(updated)
        }
        payload["files"] = persistedFiles
      }

      try? FileManager.default.removeItem(at: pendingUrl)
      resolve(payload)
    } catch {
      resolve(nil)
    }
  }

  @objc(clearPendingSharePayload:rejecter:)
  func clearPendingSharePayload(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let containerUrl = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: ScribeXShareIntentModule.appGroupId
    ) {
      let pendingUrl = containerUrl.appendingPathComponent(ScribeXShareIntentModule.pendingJsonName)
      try? FileManager.default.removeItem(at: pendingUrl)
    }
    resolve(true)
  }
}
