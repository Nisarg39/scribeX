# ScribeX Implementation Plan — Fix Android Crash in Diagram & Whiteboard Block (`DiagramBlock.tsx`)

> **Status:** Awaiting User Approval  
> **Branch:** `feat/backend-integration`

## Root Cause Analysis

When adding or rendering a `diagram` ("Diagram & Whiteboard") block on Android, [DiagramBlock.tsx](frontend/src/components/editor/blocks/DiagramBlock.tsx) uses `react-native-svg` `15.15.4` features that are only safe on Web and crash on Android:
1. **`<Marker orient="auto-start-reverse">` + `markerEnd="url(#arrow)"`** (lines 328–340, 363): `DiagramBlock.tsx` is the only component in the codebase using `<Marker>`. `auto-start-reverse` / `RNSVGMarker` throws a native exception in `react-native-svg` on Android.
2. **`strokeDasharray="4,3"`** (line 362): Comma-separated string instead of numeric array `[4, 3]`.
3. **`<Svg width="100%" height="100%">`** (lines 323–327) inside `<ScrollView horizontal>` without `style={{ flexGrow: 0, flexShrink: 0 }}` (line 314).

## Proposed Changes

1. **[frontend/src/components/editor/blocks/DiagramBlock.tsx](frontend/src/components/editor/blocks/DiagramBlock.tsx):**
   - Remove `<Defs>`, `<Marker>`, and `markerEnd="url(#arrow)"`; render each edge's arrowhead directly as a `<Path>` triangle at `(endX, endY)` (handling both left-to-right and right-to-left directions).
   - Change `strokeDasharray="4,3"` to `strokeDasharray={[4, 3]}`.
   - Pass explicit numeric `width={canvasWidth}` and `height={nodeLayout.totalHeight}` to `<Svg>` (where `canvasWidth = Math.max(nodeLayout.totalWidth, 500)`).
   - Add `style={{ flexGrow: 0, flexShrink: 0 }}` to `<ScrollView horizontal>` per React Native Flex Safety rules.
2. **Verify & Rebuild:**
   - Run `cd frontend && npx tsc --noEmit`.
   - Run `npm --prefix frontend run audit:all` (editor blocks & AST audit).
   - Rebuild `frontend/android/app/build/outputs/apk/release/app-release.apk` via `./gradlew assembleRelease`.

## Recommended Execution

| Command | Fit | Reason |
| :--- | :--- | :--- |
| `/plan` | **Best Fit** | Single-file native SVG crash fix in `DiagramBlock.tsx` + typecheck/block audit + release APK rebuild. |
| `/grill-me` | Not Needed | Root cause is isolated to `DiagramBlock.tsx`. |
| `/swarm`, `/teamwork`, `/run-workflow` | Not Needed | Single component fix. |
| `/boost`, `/goal` | Not Needed | Bounded bugfix. |
| `/compact` | Not Needed | Context is manageable. |
