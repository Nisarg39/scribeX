# Implementation Plan: iOS Share Sheet Parity for WhatsApp Exports & Universal Media Shares (Zero-Device Verified)

## 1. Architectural Strategy (Dual-Path iOS Guarantee Without Physical Device Testing)
To ensure iOS has 100% identical Share Sheet behavior to Android (intact `.zip`/`.txt` WhatsApp chat exports, individual photos, videos, `.opus` voice notes, PDFs, URLs, and text messages, all prompting the **New Note vs Existing Note** modal) and works reliably without manual device debugging, we implement a **Dual-Path iOS Architecture**:

1. **Path A — iOS `Documents/Inbox` Direct File Handoff (`CFBundleDocumentTypes` + `Linking`):**
   - When exporting a chat from WhatsApp on iOS (`.zip` or `.txt`) or sharing any media/document file via `UIActivityViewController`, iOS natively lists apps matching `CFBundleDocumentTypes`.
   - By setting `LSSupportsOpeningDocumentsInPlace: false` in `app.json` and registering explicit UTIs (`com.pkware.zip-archive`, `public.zip-archive`, `public.plain-text`, `public.image`, `public.movie`, `public.audiovisual-content`, `public.audio`, `org.xiph.opus`, `com.adobe.pdf`, `public.data`, `public.content`), iOS automatically copies the shared file into ScribeX's readable `Documents/Inbox/` directory and opens ScribeX with a `file:///.../Documents/Inbox/...` URL via `Linking`.
   - `ShareIngestService.ts` intercepts incoming `file://` URLs from `Linking.getInitialURL()` and `Linking.addEventListener('url')`, moves the file from `Documents/Inbox/` into persistent `FileSystem.documentDirectory + 'shared_media/'`, constructs a `NormalizedSharePayload`, and opens `ShareDestinationModal` (**Save in New Note** vs **Add to Existing Note**).
   - *Advantage:* Works on 100% of iOS builds immediately without requiring multi-target Xcode Share Extension provisioning.

2. **Path B — iOS Share Extension + Native `ScribeXShareIntent` Bridge (`App Group` + `scribex://share-ingest`):**
   - For text-only shares, web links, and multi-item bundles on iOS, we provide the complete native iOS module and Share Extension:
     - `frontend/ios-native-share/ScribeXShareIntentModule.swift` & `.m`: Implements the `ScribeXShareIntent` React Native bridge (`getPendingSharePayload`, `clearPendingSharePayload`, `onSharePayloadReceived`) reading staged payloads from the `group.com.nashtech.scribex` App Group container and copying intact files into `Documents/shared_media/`.
     - `frontend/ios-native-share/ShareViewController.swift` & `ShareExtension-Info.plist`: Extracts shared text, URLs, and intact files/archives from `NSExtensionContext`, writes `pending_share.json` into the App Group container, and deep-links into `scribex://share-ingest?batchId=...`.
     - `frontend/plugins/withScribeXShare.js`: An automated Expo Config Plugin wired in `app.json` that configures iOS entitlements (`com.apple.security.application-groups`) and links the native iOS share files during `expo prebuild --platform ios`.

---

## 2. Implementation Steps

### Step 1: Harden iOS `CFBundleDocumentTypes` & Config Plugin in `app.json`
- **Files:**
  - [`frontend/app.json`](frontend/app.json)
  - [`frontend/plugins/withScribeXShare.js`](frontend/plugins/withScribeXShare.js) *(New)*
- **Changes:**
  - Set `"LSSupportsOpeningDocumentsInPlace": false` in `ios.infoPlist` so iOS copies shared files into `Documents/Inbox/` with full sandbox read permissions instead of passing restricted external security-scoped URLs.
  - Expand `CFBundleDocumentTypes` to explicitly include `public.image`, `public.jpeg`, `public.png`, `public.movie`, `public.mpeg-4`, `public.audiovisual-content`, `public.audio`, `public.mp3`, `org.xiph.opus`, `com.adobe.pdf`, `com.pkware.zip-archive`, `public.zip-archive`, `public.text`, `public.plain-text`, `public.data`, `public.content`, and `public.item`.
  - Create `frontend/plugins/withScribeXShare.js` and register it in `app.json` `plugins` to automatically inject the `group.com.nashtech.scribex` App Group entitlement and stage native iOS share bridge sources on `expo prebuild`.

### Step 2: Native iOS `ScribeXShareIntent` Module & Share Extension Sources
- **Files:**
  - [`frontend/ios-native-share/ScribeXShareIntentModule.swift`](frontend/ios-native-share/ScribeXShareIntentModule.swift) *(New)*
  - [`frontend/ios-native-share/ScribeXShareIntentModule.m`](frontend/ios-native-share/ScribeXShareIntentModule.m) *(New)*
  - [`frontend/ios-native-share/ShareViewController.swift`](frontend/ios-native-share/ShareViewController.swift) *(New)*
  - [`frontend/ios-native-share/ShareExtension-Info.plist`](frontend/ios-native-share/ShareExtension-Info.plist) *(New)*
- **Changes:**
  - Implement `ScribeXShareIntentModule` (`RCTEventEmitter`) exposing `getPendingSharePayload` and `clearPendingSharePayload`, reading from `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.nashtech.scribex")`, copying intact `.zip`, `.txt`, and media files to `Documents/shared_media/`, and returning the exact `NormalizedSharePayload` schema used on Android.
  - Implement `ShareViewController` to accept all `public.item`, `public.url`, and `public.text` attachments without unpacking `.zip` archives (preventing iOS Share Extension 120MB memory limit crashes) and trigger `scribex://share-ingest`.

### Step 3: iOS `file://` (`Documents/Inbox/`) & Deep-Link Ingestion in `ShareIngestService.ts`
- **File:** [`frontend/src/services/share/ShareIngestService.ts`](frontend/src/services/share/ShareIngestService.ts)
- **Changes:**
  - Add `ingestIosFileUrl(fileUrl: string)` to handle incoming `file://` URLs delivered by iOS `Linking` when a user shares a WhatsApp `.zip`/`.txt` export or media file via `CFBundleDocumentTypes`.
  - Decode the percent-encoded filename, copy the file from `Documents/Inbox/` into persistent `FileSystem.documentDirectory + 'shared_media/'`, remove the temporary `Inbox` copy, infer the accurate MIME type (`.zip`, `.txt`, `.opus`, `.mp4`, `.jpg`, `.png`, `.pdf`), and invoke `ingestSharePayload()` so `ShareDestinationModal` (**Save in New Note** vs **Add to Existing Note**) opens identically on iOS and Android.

### Step 4: Zero-Device iOS Parity Automated Test Suite
- **Files:**
  - [`scripts/test_inbound_share_pipeline.mjs`](scripts/test_inbound_share_pipeline.mjs)
  - [`.agents/project-map.json`](.agents/project-map.json)
- **Changes:**
  - Add an iOS Share Sheet Parity test suite (`Suite 7`) in `scripts/test_inbound_share_pipeline.mjs` that programmatically verifies:
    - `app.json` iOS `CFBundleDocumentTypes` UTI completeness and `LSSupportsOpeningDocumentsInPlace: false`.
    - iOS `file:///.../Documents/Inbox/` URL parsing, percent-decoding (`WhatsApp%20Chat%20with%20Alice.zip`), MIME mapping, and `NormalizedSharePayload` construction.
    - Verification of `ScribeXShareIntentModule.swift`, `ShareViewController.swift`, and `withScribeXShare.js` contracts.

---

## Recommended Execution

| Command | Fit | Reasoning |
| :--- | :--- | :--- |
| `/plan` | **Best Fit** | Reviews and approves the Dual-Path iOS Share Sheet architecture (`Documents/Inbox` `file://` ingestion + Native Share Extension & Config Plugin + Zero-Device Verification Suite) before generating the files. |
| `/boost` | Medium | Useful if extra static verification passes are needed, though `Suite 7` in `test_inbound_share_pipeline.mjs` will deterministically test every iOS contract. |
| `/teamwork` / `/swarm` | Low | Tightly coupled configuration between `app.json`, `withScribeXShare.js`, and `ShareIngestService.ts`. |
| `/compact` | Medium | Can be used after execution to compact conversation history. |
