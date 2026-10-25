# ScribeX UI Design System — Pastel Tile Notes (Mobile-First Expo)

**Version:** 2.0 (Mobile-First React Native Expo Architecture)  
**Primary Target Platform:** iOS & Android (via React Native Expo)  
**Secondary Target Platform:** Web & Desktop (via React Native Web / Expo Router)  
**Visual Style:** Soft Minimalism with vivid pastel note tiles  
**Color Modes:** Light and Dark (True Charcoal Canvas)  
**Primary Breakpoint Philosophy:** **Mobile-First (375–430 pt)** $\rightarrow$ **Adaptive Tablet & Web Scaling**

> **Implementation Rule:** This document is the UI source of truth for all frontend engineering. All layout structures, component geometries, typography scales, touch targets, and interaction models are designed **mobile-first** for mobile screens (iOS & Android). When running the app on a laptop browser or simulator during development, **the interface decisions (touch targets, thumb zones, padding, tile heights, header scales) remain calibrated for mobile first**, scaling and adapting gracefully for wider desktop screens.

---

## 1. Design Intent & Mobile-First Principles

The interface is a calm, editorial personal notes workspace. The mobile app chrome is quiet and unobtrusive; the pastel note tiles provide personality and structure.

- **Mobile Ergonomics & Thumb Zone:** The primary interaction targets (Add Note button, Search, Note Tile taps, Edit actions) are positioned within comfortable single-hand thumb reach.
- **Colorful Content, Neutral Canvas:** The app frame is clean white (light) or deep charcoal (dark); pastel note tiles are the dominant visual focus.
- **Safe Area Native Integration:** All layouts natively respect device safe areas (`react-native-safe-area-context`), including notches, dynamic islands, and bottom home indicator bars.
- **True Charcoal Dark Mode:** Charcoal canvas (`#242424`), crisp off-white text, and identical vivid pastel note tiles with dark text for maximum legibility in both modes.
- **Zero Gimmicks:** No neon glows, no glassy blurs, no skeuomorphic textures, and no generic card dashboards. Rounded rectangles, circular actions, and restrained dividers define the geometry.

---

## 2. Platform & Breakpoint Strategy

Even when previewed or tested on a laptop browser, the layout begins with the mobile viewport as its baseline:

```
┌─────────────────────────────────┐
│ Mobile (Base: 375 – 430 pt)     │  → 2 Columns (or 1 on narrow <360pt)
│ - Full-width Safe Area          │  → Bottom Floating Action Button (FAB)
│ - 16–20 pt horizontal insets    │  → Native Stack Navigation / Modals
└─────────────────────────────────┘
                 │
                 ▼ (Scales gracefully when viewport expands)
┌─────────────────────────────────────────────────────────────┐
│ Tablet & Desktop Web (≥768 pt / ≥1024 pt)                   │
│ - 3 to 4 Columns                                            │
│ - Max container width: 1100–1200 pt                         │
│ - Bottom FAB or side rail navigation options                │
│ - Ambient canvas padding around central workspace           │
└─────────────────────────────────────────────────────────────┘
```

| Breakpoint Tier | Viewport Width | Note Columns | Horizontal Inset | Navigation Layout |
| :--- | :---: | :---: | :---: | :--- |
| **Mobile (Compact)** | `< 360 pt` | 1 Column | `14 pt` | Full-width header + bottom FAB |
| **Mobile (Standard)** | `360 – 430 pt` | **2 Columns** | **16–20 pt** | Large "Notes" title + search + bottom FAB |
| **Tablet / Foldable** | `431 – 768 pt` | 2–3 Columns | `24–32 pt` | Expanded header + bottom FAB / toolbar |
| **Desktop Web** | `> 768 pt` | 3–4 Columns | `32–56 pt` | Centered container + side rail or top bar |

---

## 3. Color Tokens (React Native & Cross-Platform)

Theme tokens are exported as a typed JavaScript object for React Native `StyleSheet` usage, as well as CSS variables for web compatibility.

### 3.1 Light Mode
| Token Name | Hex Value | React Native Usage |
| :--- | :---: | :--- |
| `colors.appBg` | `#E8ECF5` | Outer canvas background / ambient backdrop |
| `colors.surface` | `#FFFFFF` | Main workspace screen background |
| `colors.surfaceRaised` | `#FFFFFF` | Modals, bottom sheets, search input background |
| `colors.textPrimary` | `#171717` | Note title, page heading, editor text |
| `colors.textSecondary` | `#626262` | Dates, secondary labels |
| `colors.textMuted` | `#929292` | Search placeholder, subtle metadata |
| `colors.borderSubtle` | `#E8E8E8` | Thin dividers and item separators |
| `colors.iconBg` | `#111111` | High-contrast circular action button background |
| `colors.iconFg` | `#FFFFFF` | Icon color on dark action buttons |
| `colors.favorite` | `#FFD43B` | Star rating and favorite icon |

### 3.2 Dark Mode
| Token Name | Hex Value | React Native Usage |
| :--- | :---: | :--- |
| `colors.appBg` | `#242424` | Main screen background canvas |
| `colors.surface` | `#242424` | Main content and editor background |
| `colors.surfaceRaised` | `#303030` | Search bar background, popovers, bottom sheets |
| `colors.textPrimary` | `#F7F7F7` | Headings, editor body text |
| `colors.textSecondary` | `#B5B5B5` | Dates, secondary indicators |
| `colors.textMuted` | `#858585` | Placeholder text |
| `colors.borderSubtle` | `#3A3A3A` | Dividers and borders where necessary |
| `colors.iconBg` | `#383838` | Circular icon buttons |
| `colors.iconFg` | `#FFFFFF` | Icon color on controls |
| `colors.favorite` | `#FFD43B` | Star icon color |

### 3.3 Pastel Note Tile Palette (Identical in Light & Dark Mode)
Pastel backgrounds remain **vivid and bright in both light and dark mode**. The text on all pastel tiles is always dark (`#191919`) to guarantee optimal contrast:

| Note Color Token | Hex Value | Visual Description | Text Color On Tile |
| :--- | :---: | :--- | :---: |
| `notes.apricot` | `#FFC96F` | Warm apricot / sunny orange | `#191919` |
| `notes.coral` | `#FF9277` | Vibrant salmon / coral | `#191919` |
| `notes.lime` | `#E5F28B` | Pale electric lime | `#191919` |
| `notes.lavender` | `#B18AF3` | Soft modern lavender | `#191919` |
| `notes.cyan` | `#08C4E5` | Bright sky cyan | `#191919` |
| `notes.pink` | `#F5A4C6` | Soft rose pink | `#191919` |
| `notes.sky` | `#8EDCEB` | Calm pastel blue | `#191919` |

> [!IMPORTANT]
> **Never darken pastel note tiles in dark mode.** The striking contrast of bright pastel tiles against a deep charcoal canvas (`#242424`) is the signature aesthetic of ScribeX.

---

## 4. Typography Scale (Mobile-First)

React Native typography utilizes platform system fonts or bundled Inter. Font sizes and line heights are calibrated for mobile screens first:

```ts
const fontFamily = Platform.select({
  ios: 'System', // SF Pro
  android: 'Roboto',
  default: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});
```

| Text Role | Mobile Size | Line Height | Font Weight | Desktop Size | Usage |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Page Title** | **34–38 pt** | `40 pt` | `700` (Bold) | `44–48 pt` | Main "Notes" screen header |
| **Tile Title / Body** | **15–16 pt** | `21 pt` | `600` / `500` | `16–17 pt` | Note preview on pastel tiles |
| **Tile Date** | **12–13 pt** | `16 pt` | `400` (Regular) | `13 pt` | Lower-left date stamp on tiles |
| **Editor Title** | **26–28 pt** | `32 pt` | `700` (Bold) | `32–36 pt` | Focused reading & editing view |
| **Editor Body** | **16 pt** | `24 pt` | `400` (Regular) | `17 pt` | Comfortable long-form reading |
| **Search / Input** | **15–16 pt** | `20 pt` | `400` (Regular) | `15 pt` | Top search bar text |
| **Small Label** | **11–12 pt** | `15 pt` | `500` (Medium) | `12 pt` | Badges, group tags |

---

## 5. Spacing, Shapes & Touch Ergonomics

Built on a clean **4 pt base grid** matching React Native density standards:

```ts
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
};
```

### 5.1 Corner Radii
| Component | Corner Radius | Visual Effect |
| :--- | :---: | :--- |
| **Note Tile** | **18–20 pt** | Smooth, pebble-like friendly card |
| **Circular Actions (FAB / Edit)** | `50%` (or `24–28 pt`) | Pure circular buttons |
| **Search Input** | **12–14 pt** | Rounded minimal pill/box |
| **Modals / Bottom Sheets** | **24–28 pt** (Top corners) | Elegant native bottom sheet |
| **Tag / Group Badge** | **8–10 pt** | Compact rounded label |

### 5.2 Touch Targets & Native Ergonomics
- **Minimum Touchable Area:** All interactive buttons and icons have a touch target of at least **44 × 44 pt**.
- Use React Native `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` when visual icon size is compact (e.g. 18–22 pt icon).
- **Haptic Feedback:** Trigger light haptics (`expo-haptics`) upon tapping note tiles, toggling favorites, or pressing the FAB.

---

## 6. Core Mobile-First Component Specifications

### 6.1 Top Header & Search Row
- Sits immediately below the `SafeAreaView` top inset.
- Contains a compact, minimal search input with a muted search icon and placeholder ("Search notes...").
- Followed by a prominent, left-aligned, bold **"Notes"** page title (`34–38 pt`).
- Avoid cluttered header toolbars or excessive filter tabs.

### 6.2 The Signature Pastel Note Tile (`NoteTile`)
- **Structure:**
  - Full-surface pastel background (`notes.apricot`, `coral`, `lime`, `lavender`, `cyan`, etc.).
  - Top: Title or initial note excerpt in dark text (`#191919`), left-aligned, maximum 3–4 lines preview.
  - Optional Top-Right: Favorite star icon button (`40 × 40 pt` touchable area, dark circular background, yellow star `#FFD43B`).
  - Bottom-Left: Formatted creation/update date (e.g., "Oct 25, 2026") in translucent dark text (`rgba(25, 25, 25, 0.65)`).
  - Bottom-Right: Small circular dark edit button (`36 × 36 pt` visual, `44 × 44 pt` touch target with hitSlop) with a centered white pencil icon.
- **Mobile Dimensions:**
  - Width: Flexible within the 2-column grid (`~160–185 pt` on typical iPhone/Android screens).
  - Minimum Height: **190–210 pt**.
  - Padding: **16–18 pt**.
  - Corner Radius: **18–20 pt**.

### 6.3 Floating Action Button (`AddNoteFAB`)
- Positioned in the **bottom-right thumb zone**:
  - `bottom: 24 pt + safeAreaInsets.bottom`
  - `right: 20 pt`
- Circle diameter: **52–56 pt** on mobile.
- High-contrast solid dark surface (`#111111` in light mode, `#383838` in dark mode).
- Centered white plus icon (`24 pt` stroke width `2.2 pt`).
- Native elevation: `elevation: 4` (Android) / subtle shadow (iOS).
- Tap feedback: Instant scale down to `0.94` + light haptic pulse.

### 6.4 Note Grid (`NoteGrid`)
- Implemented with React Native `FlatList` or `FlashList` for optimal 60/120fps scrolling.
- `numColumns={2}` on mobile phones, with `columnWrapperStyle={{ gap: 14 }}` and `contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }}`.
- Adapts to 3 columns on tablet screens ($\ge 768\text{ pt}$) or single column on narrow screens.

### 6.5 Note Editor / Reading Screen
- Opened via modal slide or stack push navigation.
- Feels like a focused reading canvas, not a cluttered form.
- Light mode: Clean white canvas (`#FFFFFF`).
- Dark mode: Deep charcoal canvas (`#242424`) with soft-white text (`#F7F7F7`).
- Top Bar: Compact rounded back arrow, search/options icon, and subtle group indicator.
- Title: Prominent left-aligned headline (`26–30 pt`, bold).
- Body: Generous line height (`lineHeight: 25 pt`, font size `16 pt`) with comfortable left/right reading margins (`20 pt`).

---

## 7. React Native Implementation Guide (TypeScript / Expo)

### 7.1 Central Theme Definition (`theme.ts`)
```ts
// frontend/src/theme/tokens.ts
export const pastelPalette = {
  apricot: '#FFC96F',
  coral: '#FF9277',
  lime: '#E5F28B',
  lavender: '#B18AF3',
  cyan: '#08C4E5',
  pink: '#F5A4C6',
  sky: '#8EDCEB',
};

export const lightTheme = {
  mode: 'light' as const,
  appBg: '#E8ECF5',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  textPrimary: '#171717',
  textSecondary: '#626262',
  textMuted: '#929292',
  borderSubtle: '#E8E8E8',
  iconBg: '#111111',
  iconFg: '#FFFFFF',
  favorite: '#FFD43B',
  pastels: pastelPalette,
};

export const darkTheme = {
  mode: 'dark' as const,
  appBg: '#242424',
  surface: '#242424',
  surfaceRaised: '#303030',
  textPrimary: '#F7F7F7',
  textSecondary: '#B5B5B5',
  textMuted: '#858585',
  borderSubtle: '#3A3A3A',
  iconBg: '#383838',
  iconFg: '#FFFFFF',
  favorite: '#FFD43B',
  pastels: pastelPalette, // Note tiles remain the same vivid pastel in dark mode
};

export type Theme = typeof lightTheme;
```

### 7.2 Mobile-First Note Tile Component (`NoteTile.tsx`)
```tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Edit2, Star } from 'lucide-react-native';

interface NoteTileProps {
  title: string;
  previewText?: string;
  updatedAt: string;
  pastelColor: string;
  isFavorite?: boolean;
  onPress: () => void;
  onEditPress?: () => void;
  onFavoritePress?: () => void;
}

export const NoteTile: React.FC<NoteTileProps> = ({
  title,
  previewText,
  updatedAt,
  pastelColor,
  isFavorite,
  onPress,
  onEditPress,
  onFavoritePress,
}) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: pastelColor },
        pressed && styles.tilePressed,
      ]}
      onPress={handlePress}
    >
      {/* Top Row: Preview and optional favorite */}
      <View style={styles.topContainer}>
        <Text style={styles.titleText} numberOfLines={4}>
          {previewText || title}
        </Text>
        {isFavorite && (
          <View style={styles.favoriteBadge}>
            <Star size={14} color="#FFD43B" fill="#FFD43B" />
          </View>
        )}
      </View>

      {/* Bottom Row: Date and Edit Action */}
      <View style={styles.bottomRow}>
        <Text style={styles.dateText}>{updatedAt}</Text>
        {onEditPress && (
          <Pressable
            style={styles.editButton}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              onEditPress();
            }}
          >
            <Edit2 size={14} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 195,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  tilePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  topContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#191919',
    lineHeight: 21,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(25, 25, 25, 0.65)',
    fontWeight: '400',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

---

## 8. Visual QA & Mobile Screenshot Evaluation Checklist

When evaluating screenshots from the running Expo project (on device or simulated laptop web):

- [ ] **Mobile-First Priority:** Does the layout look like a polished, high-end iOS/Android native app?
- [ ] **2-Column Grid Rhythm:** Do tiles sit comfortably side by side without awkward text truncation or cramped margins?
- [ ] **Pastel Color Fidelity:** Are the pastel backgrounds vivid and distinct (apricot, coral, lime, lavender, cyan)?
- [ ] **Dark Mode Contrast:** Is the canvas true charcoal (`#242424`) with pastel tiles remaining colorful and text dark (`#191919`)?
- [ ] **Typography Hierarchy:** Is the "Notes" heading prominent, bold, and left-aligned?
- [ ] **Touch Target Integrity:** Are all action buttons (FAB, edit, favorite, search) easily tappable with at least 44 pt hit targets?
- [ ] **Safe Area Alignment:** Are top headers and bottom FABs clear of the device notch, status bar, and home indicator?
- [ ] **Web Adaptation:** When resized wider on laptop web, does the container stay centered with balanced padding rather than stretching note tiles into thin banners?
