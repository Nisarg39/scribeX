# Implementation Plan: Scope ScribeX Exclusively to WhatsApp Export Chat Detection

## Problem & Objective
The user wants to remove the generic universal share sheet features (standalone text, single photos, maps URLs, vCards, etc.) and retain strictly the **WhatsApp Export Chat** detection pipeline (full conversation transcript parsing, multiline message folding, sender diarization, inline poll detection, and attached media linking).

---

## Technical Refactoring Steps

1. **Streamline AST Block Synthesizer (`frontend/src/core/share/shareBlockSynthesizer.ts`):**
   - Retain:
     - `isWhatsAppChatTranscript` detection.
     - Multi-message transcript parsing (bracketed and dash formats).
     - `message_thread` block synthesis with `'whatsapp'` channel.
     - Inline Poll conversion into `ChecklistBlock`.
     - Attached media mapping (`<attached: ...>` and `(file attached)` to rich media blocks).
   - Remove:
     - Generic standalone location parsing (`maps.google.com`).
     - Generic standalone vCard contact parsing (`.vcf`).
     - Generic standalone calendar invite parsing (`.ics`).
     - Generic standalone web/video bookmark creation.
     - Fallback single-line arbitrary text note creation.
   - Non-export payloads will be rejected or safely ignored.

2. **Refine Android Intent Filters (`frontend/android/app/src/main/AndroidManifest.xml`):**
   - Keep `ACTION_SEND` and `ACTION_SEND_MULTIPLE` tailored for chat export documents and archives (`text/plain`, `application/zip`, `*/*` for multi-stream media bundles).

3. **Update Test Harness (`scripts/test_inbound_share_pipeline.mjs`):**
   - Focus the test suite specifically on the 100% lossless WhatsApp Export Chat ingestion pipeline:
     - Multi-locale date/time bracketed headers.
     - Dash-separated headers.
     - Multiline message folding.
     - Attached media file matching.
     - Poll item parsing.
     - Batch deduplication.

4. **Verification Gate:**
   - `cd frontend && npx tsc --noEmit`
   - `cd frontend && npx tsx ../scripts/test_inbound_share_pipeline.mjs`
   - `npm --prefix frontend run test:all`

---

## Status: COMPLETE (Export Chat Scoped & Hardened)
All generic universal share sheet features have been removed. ScribeX is now exclusively focused on native **WhatsApp Export Chat** detection and ingestion:
* **Export Detection:** Hardened across bracketed (comma-optional) and dash (including en-dash/em-dash) timestamps, multiline folding, and international export filenames.
* **Strict Rejection:** Non-WhatsApp payloads (single text notes, standalone URLs, bookmarks, vCards, calendar events, arbitrary photos) are cleanly rejected.
* **Verified:** 29/29 pipeline tests passing, 0 TypeScript errors, all regression suites passing.
