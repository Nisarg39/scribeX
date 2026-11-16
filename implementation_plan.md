# Implementation Plan: Universal Share Ingestion, New/Existing Note Destination Picker & Media Playback Fixes

## 1. Architectural Overview
1. **Prevent OOM on WhatsApp Chat Exports:** Remove `.zip` unpacking and transcript expansion completely. Store exported WhatsApp `.zip` and `.txt` archives strictly in their original file format inside the app sandbox as an intact `FileBlock` attachment.
2. **Universal Individual Share Detection:** Remove the restrictive `isWhatsAppExportPayload` gate that rejected non-transcript shares. Support all inbound share types from WhatsApp and other apps via the system Share Sheet: individual images, videos, `.opus`/`.mp3`/`.m4a` audio voice notes, PDFs/documents, URLs, and shared text messages.
3. **"Save in New Note" vs "Add to Existing Note" Destination Prompt:** Whenever an export chat or individual file/message is shared to ScribeX, present a native destination sheet (`ShareDestinationModal`) allowing the user to either:
   - **Save in a New Note** (default primary option, with pre-filled title & folder selection), or
   - **Add to an Existing Note** (searchable list of active notes that appends the shared blocks to the chosen note and opens it).
4. **Fix Shared Media Rendering & Mobile Playback:** Fix `createBlockFromFile()` to store the persistent `file://` URI in `block.content` (so SQLite Markdown serialization preserves it) and fix mobile `VideoBlock` (HTML5 `<video>` instead of YouTube `<iframe>`) and `AudioBlock` (`.opus` playback, silent-mode audio session, and duration sync).

---

## 2. Implementation Steps

### Step 1: Native Android Share Sheet & Intact File Storage
- **Files:**
  - [`frontend/android/app/src/main/java/com/nashtech/scribex/share/ShareIntentModule.kt`](frontend/android/app/src/main/java/com/nashtech/scribex/share/ShareIntentModule.kt)
  - [`frontend/android/app/src/main/AndroidManifest.xml`](frontend/android/app/src/main/AndroidManifest.xml)
  - [`frontend/app.json`](frontend/app.json)
- **Changes:**
  - In `ShareIntentModule.kt`: Remove `.zip` entry extraction in `processUriIntoSandbox()` so `.zip` and `.txt` WhatsApp exports are copied directly into `filesDir/shared_media/` as a single intact file in their original format. Map `.opus` to `audio/ogg` / `audio/opus` and ensure accurate MIME fallback by file extension.
  - In `AndroidManifest.xml` & `app.json`: Ensure explicit `ACTION_SEND` and `ACTION_SEND_MULTIPLE` intent filters cover `image/*`, `video/*`, `audio/*`, `text/*`, `application/zip`, `application/pdf`, and `*/*`.

### Step 2: Universal Share Block Synthesizer & URI Preservation
- **Files:**
  - [`frontend/src/core/share/shareBlockSynthesizer.ts`](frontend/src/core/share/shareBlockSynthesizer.ts)
  - [`frontend/src/services/share/ShareIngestService.ts`](frontend/src/services/share/ShareIngestService.ts)
- **Changes:**
  - Update `synthesizeShareBlocks(payload)` to accept **any** valid share payload containing `files` and/or `text` (removing the strict WhatsApp-transcript-only rejection).
  - Convert `.zip` and `.txt` files (including WhatsApp chat exports) into intact `file` blocks (`FileBlock`) rather than parsing transcripts into inline `message_thread` blocks.
  - Fix `createBlockFromFile()` for `image`, `video`, `audio`, and `file` blocks to set `content: file.uri` (the persistent `file://` URI) and store `fileName` in `metadata.fileName` / `metadata.title` / `metadata.caption`.
  - Support shared text messages and URLs (`payload.text`) by synthesizing `bookmark` blocks for standalone links and `paragraph` blocks for shared message text.

### Step 3: "New Note vs Existing Note" Share Destination Modal
- **Files:**
  - [`frontend/src/components/share/ShareDestinationModal.tsx`](frontend/src/components/share/ShareDestinationModal.tsx) *(New)*
  - [`frontend/src/state/useNotesStore.tsx`](frontend/src/state/useNotesStore.tsx)
  - [`frontend/src/services/share/ShareIngestService.ts`](frontend/src/services/share/ShareIngestService.ts)
  - [`frontend/app/_layout.tsx`](frontend/app/_layout.tsx)
- **Changes:**
  - Add `appendBlocksToNote(noteId: string, newBlocks: ComposableBlock[]): Promise<NoteItem | null>` to `useNotesStore.tsx` so shared blocks can be appended to any existing note and persisted via `notesRepo.updateNote()` with `serializeBlocksToMarkdown()`.
  - Update `ShareIngestService` to notify the UI with a pending `SynthesizedNoteResult` when a share arrives (while keeping direct `ingestSharePayload` support for automated pipelines).
  - Create `ShareDestinationModal.tsx` and mount it in `RootContent` (`frontend/app/_layout.tsx`), giving the user a clean choice between **"Save in New Note"** (default active tab/action with editable title) and **"Add to Existing Note"** (searchable list of existing notes), navigating to the target note immediately after confirmation.

### Step 4: Mobile Local Video & `.opus` Audio Playback Fixes
- **Files:**
  - [`frontend/src/components/editor/blocks/VideoBlock.tsx`](frontend/src/components/editor/blocks/VideoBlock.tsx)
  - [`frontend/src/components/editor/blocks/AudioBlock.tsx`](frontend/src/components/editor/blocks/AudioBlock.tsx)
- **Changes:**
  - In `VideoBlock.tsx`: Recognize `file://` and `.mp4`/`.mov`/`.webm`/`.3gp`/`.mkv` URLs as direct videos (`type: 'direct'`), sync `videoUrl` state when `url` prop updates, and render an HTML5 `<video controls playsinline preload="metadata">` inside `WebView` with `allowFileAccess={true}` and `allowUniversalAccessFromFileURLs={true}` on mobile.
  - In `AudioBlock.tsx`: Call `setAudioModeAsync({ playsInSilentMode: true })` before native playback, sync `currentDuration` from `status.duration`, reset finished tracks via `seekTo(0)`, and provide an external player/share fallback button via `expo-sharing`.

---

## Recommended Execution

| Command | Fit | Reasoning |
| :--- | :--- | :--- |
| `/plan` | **Best Fit** | Covers native Android intent handling, universal share block synthesis, a new `ShareDestinationModal` connected to `useNotesStore`, and mobile video/audio player fixes. Reviewing and approving the structured plan ensures clean end-to-end execution. |
| `/boost` | Medium | Useful if additional multi-pass stress testing is desired, though our scoped verification scripts cover all AST and share flows. |
| `/teamwork` / `/swarm` | Low | Changes share tight TypeScript contracts across `ShareIngestService`, `useNotesStore`, and `_layout.tsx`. |
| `/compact` | Medium | Recommended after implementation and APK build if conversation context grows. |
