import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
  private let appGroupId = "group.com.nashtech.scribex"
  private let urlScheme = "scribex://share-ingest"

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    processExtensionContext()
  }

  private func processExtensionContext() {
    guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem],
          let containerUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      finishExtension()
      return
    }

    let batchId = "ios-share-\(Int(Date().timeIntervalSince1970 * 1000))"
    let stagingDir = containerUrl.appendingPathComponent("staging_\(batchId)", isDirectory: true)
    try? FileManager.default.createDirectory(at: stagingDir, withIntermediateDirectories: true)

    let group = DispatchGroup()
    var collectedTexts: [String] = []
    var collectedFiles: [[String: Any]] = []

    for item in extensionItems {
      if let attributed = item.attributedContentText?.string, !attributed.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        collectedTexts.append(attributed)
      }
      guard let attachments = item.attachments else { continue }

      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) ||
           provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) ||
           provider.hasItemConformingToTypeIdentifier(UTType.item.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.item.identifier, options: nil) { [weak self] data, _ in
            defer { group.leave() }
            guard let self = self else { return }

            if let fileUrl = data as? URL, fileUrl.isFileURL {
              // Copy file intact (.zip, .txt, .jpg, .mp4, .opus, .pdf) without unpacking archives
              let fileName = fileUrl.lastPathComponent
              let sanitized = fileName.replacingOccurrences(of: "[^a-zA-Z0-9._-]", with: "_", options: .regularExpression)
              let destUrl = stagingDir.appendingPathComponent(sanitized)
              do {
                if FileManager.default.fileExists(atPath: destUrl.path) {
                  try FileManager.default.removeItem(at: destUrl)
                }
                try FileManager.default.copyItem(at: fileUrl, to: destUrl)
                let attrs = try? FileManager.default.attributesOfItem(atPath: destUrl.path)
                let size = (attrs?[.size] as? NSNumber)?.doubleValue ?? 0
                let mime = self.mimeType(for: fileName)
                collectedFiles.append([
                  "uri": destUrl.absoluteString,
                  "fileName": fileName,
                  "mimeType": mime,
                  "fileSize": size
                ])
              } catch {}
            } else if let webUrl = data as? URL, !webUrl.isFileURL {
              collectedTexts.append(webUrl.absoluteString)
            } else if let text = data as? String {
              collectedTexts.append(text)
            } else if let rawData = data as? Data {
              let fileName = "shared_\(Int(Date().timeIntervalSince1970 * 1000)).bin"
              let destUrl = stagingDir.appendingPathComponent(fileName)
              try? rawData.write(to: destUrl)
              collectedFiles.append([
                "uri": destUrl.absoluteString,
                "fileName": fileName,
                "mimeType": "application/octet-stream",
                "fileSize": Double(rawData.count)
              ])
            }
          }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { data, _ in
            defer { group.leave() }
            if let url = data as? URL {
              collectedTexts.append(url.absoluteString)
            }
          }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { data, _ in
            defer { group.leave() }
            if let text = data as? String {
              collectedTexts.append(text)
            }
          }
        }
      }
    }

    group.notify(queue: .main) { [weak self] in
      guard let self = self else { return }
      let payload: [String: Any] = [
        "batchId": batchId,
        "text": collectedTexts.joined(separator: "\n\n"),
        "files": collectedFiles,
        "createdAt": ISO8601DateFormatter().string(from: Date())
      ]

      let pendingUrl = containerUrl.appendingPathComponent("pending_share.json")
      if let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: []) {
        try? jsonData.write(to: pendingUrl)
      }

      self.openHostApp(batchId: batchId)
    }
  }

  private func openHostApp(batchId: String) {
    guard let targetUrl = URL(string: "\(urlScheme)?batchId=\(batchId)") else {
      finishExtension()
      return
    }

    var responder: UIResponder? = self
    let selectorOpenURL = sel_registerName("openURL:")
    while responder != nil {
      if responder!.responds(to: selectorOpenURL) {
        responder!.perform(selectorOpenURL, with: targetUrl)
        break
      }
      responder = responder?.next
    }
    finishExtension()
  }

  private func finishExtension() {
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }

  private func mimeType(for fileName: String) -> String {
    let ext = (fileName as NSString).pathExtension.lowercased()
    switch ext {
    case "zip": return "application/zip"
    case "txt": return "text/plain"
    case "opus", "ogg": return "audio/ogg"
    case "mp3": return "audio/mpeg"
    case "m4a": return "audio/mp4"
    case "mp4": return "video/mp4"
    case "mov": return "video/quicktime"
    case "jpg", "jpeg": return "image/jpeg"
    case "png": return "image/png"
    case "webp": return "image/webp"
    case "pdf": return "application/pdf"
    default: return "application/octet-stream"
    }
  }
}
