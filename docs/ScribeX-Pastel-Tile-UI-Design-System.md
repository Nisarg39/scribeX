# ScribeX UI Design System --- Pastel Tile Notes

**Version:** 1.0\
**Platform:** Responsive web app / PWA\
**Modes:** Light and dark\
**Visual reference:** User-provided light and dark screenshots\
**Design direction:** Soft Minimalism with vivid pastel note tiles

> **Implementation rule:** Treat this document as the UI source of
> truth. Reproduce the reference's visual hierarchy, spacing, pastel
> note colors, rounded geometry, restrained controls, and high-contrast
> typography. Do not "improve" it by introducing generic dashboards,
> gradients, glassmorphism, excessive shadows, or a card-based SaaS
> aesthetic. The values below are reconstructed from screenshots; tune
> against the supplied images where pixel-level measurements are
> possible.

------------------------------------------------------------------------

## 1. Design intent

The interface is a calm, editorial notes workspace. The app chrome is
quiet and neutral; the notes themselves provide the color and
personality.

-   **Soft Minimalism:** few borders, restrained controls, generous
    whitespace.
-   **Colorful content, neutral frame:** pastel notes are the dominant
    visual element.
-   **Simple geometry:** rounded rectangles, circular action buttons,
    thin dividers.
-   **Typography first:** clear, readable sans-serif text; strong page
    title; restrained metadata.
-   **Dark mode is genuinely dark:** charcoal surfaces, white/soft-gray
    text, and the same pastel note palette. Do not merely invert the
    light theme.
-   **No decorative UI for its own sake:** every visible element should
    support finding, creating, organizing, or reading notes.

### Visual signature

1.  A clean navigation rail/sidebar.
2.  A large, prominent "Notes" page heading.
3.  A regular grid of large, colorful note tiles.
4.  Small, unobtrusive date labels near the bottom of tiles.
5.  Compact circular actions (create, edit, favorite) in black/charcoal.
6.  In dark mode, a deep charcoal canvas with pastel tiles and a focused
    note-reading view.

------------------------------------------------------------------------

## 2. Color tokens

Use CSS custom properties so all components consume semantic tokens.
Pastel values are starting points sampled visually from the reference,
not guaranteed source values.

### Light theme

  --------------------------------------------------------------------------
  Token                      Value                   Usage
  -------------------------- ----------------------- -----------------------
  `--color-app-bg`           `#E8ECF5`               Outer page/background
                                                     around the main
                                                     workspace, if visible

  `--color-surface`          `#FFFFFF`               Main notes workspace

  `--color-surface-raised`   `#FFFFFF`               Menus, popovers,
                                                     dialogs

  `--color-text-primary`     `#171717`               Headings and note text

  `--color-text-secondary`   `#626262`               Dates, supporting
                                                     labels

  `--color-text-muted`       `#929292`               Placeholder and
                                                     low-priority metadata

  `--color-border-subtle`    `#E8E8E8`               Sidebar divider and
                                                     necessary separators
                                                     only

  `--color-icon-bg`          `#111111`               Circular icon actions

  `--color-icon-fg`          `#FFFFFF`               Icons inside dark
                                                     actions

  `--note-apricot`           `#FFC96F`               Warm yellow/orange note

  `--note-coral`             `#FF9277`               Coral/salmon note

  `--note-lime`              `#E5F28B`               Pale lime note

  `--note-lavender`          `#B18AF3`               Lavender note

  `--note-cyan`              `#08C4E5`               Bright cyan note

  `--note-pink`              `#F5A4C6`               Optional additional
                                                     pastel

  `--note-sky`               `#8EDCEB`               Optional softer blue
                                                     note

  `--color-favorite`         `#FFD43B`               Star icon only
  --------------------------------------------------------------------------

### Dark theme

  --------------------------------------------------------------------------
  Token                      Value                   Usage
  -------------------------- ----------------------- -----------------------
  `--color-app-bg`           `#242424`               Main dark canvas

  `--color-surface`          `#242424`               Main content and editor

  `--color-surface-raised`   `#303030`               Search/action surfaces
                                                     and menus

  `--color-text-primary`     `#F7F7F7`               Headings and
                                                     note/editor text

  `--color-text-secondary`   `#B5B5B5`               Dates and supporting
                                                     labels

  `--color-text-muted`       `#858585`               Placeholder text

  `--color-border-subtle`    `#3A3A3A`               Dividers only where
                                                     needed

  `--color-icon-bg`          `#383838`               Circular/rounded icon
                                                     controls

  `--color-icon-fg`          `#FFFFFF`               Icons on controls

  `--note-apricot`           `#FFC96F`               Preserve note color

  `--note-coral`             `#FF9277`               Preserve note color

  `--note-lime`              `#E5F28B`               Preserve note color

  `--note-lavender`          `#B18AF3`               Preserve note color

  `--note-cyan`              `#08C4E5`               Preserve note color

  `--note-pink`              `#F5A4C6`               Optional additional
                                                     pastel

  `--note-sky`               `#8EDCEB`               Optional softer blue
                                                     note

  `--color-favorite`         `#FFD43B`               Star icon only
  --------------------------------------------------------------------------

**Important:** Keep note backgrounds colorful in both themes. Use dark
text (`#191919`) on pastel note tiles in both modes for legibility. Do
not darken the tiles in dark mode.

### Semantic usage rules

-   The note palette is a content system, not a status system. Never
    assign colors based on urgency or success unless the product
    explicitly adds that meaning.
-   Use note colors consistently between grid and editor.
-   Maintain readable contrast for text and controls. If a tile color is
    customized, choose text color based on contrast.
-   Avoid gradients, neon glows, blue-purple SaaS gradients, and
    translucent glass effects.

------------------------------------------------------------------------

## 3. Typography

Use a clean modern sans-serif. Preferred stack:

``` css
font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

If Inter is not bundled, use the platform system sans-serif. Do not mix
in a serif display face; the reference is modern and sans-serif.

  -----------------------------------------------------------------------------
  Role                       Size          Weight     Line height Notes
  --------------- --------------- --------------- --------------- -------------
  Page title            44--52 px        650--750      1.05--1.15 Large, bold
                  desktop; 34--40                                 "Notes"
                        px mobile                                 heading

  Note title/body       16--19 px        450--550       1.3--1.45 Main content
  preview                                                         on tiles

  Editor title          28--36 px        650--750      1.15--1.25 Strong
                  desktop; 24--30                                 reading
                        px mobile                                 hierarchy

  Editor body           16--18 px             400      1.55--1.75 Comfortable
                                                                  long-form
                                                                  reading

  Date/metadata         12--14 px        400--450             1.3 Muted,
                                                                  unobtrusive

  Sidebar brand         15--17 px             600             1.2 Compact

  Icon button           12--14 px             500             1.2 Avoid adding
  label (if                                                       labels to
  present)                                                        icon-only
                                                                  controls
                                                                  without need
  -----------------------------------------------------------------------------

### Typography rules

-   Use near-black text on light surfaces and off-white text on dark
    surfaces.
-   Keep note previews left-aligned; do not center text.
-   Preserve natural line wrapping; do not shrink text aggressively to
    force uniform tile content.
-   Note dates are secondary and should never compete with the note
    title.
-   Avoid excessive font-weight variation. Use a compact hierarchy.

------------------------------------------------------------------------

## 4. Layout and spacing

Use a 4 px base spacing unit. Prefer consistent rhythm over arbitrary
per-component values.

  Token            Value
  -------------- -------
  `--space-1`       4 px
  `--space-2`       8 px
  `--space-3`      12 px
  `--space-4`      16 px
  `--space-5`      20 px
  `--space-6`      24 px
  `--space-8`      32 px
  `--space-10`     40 px
  `--space-12`     48 px
  `--space-16`     64 px

### Desktop shell

-   Main workspace is a large white (light mode) or charcoal (dark mode)
    surface inside a pale outer canvas where the composition calls for
    it.
-   Use a fixed-width navigation rail/sidebar of approximately **96--112
    px** for the compact reference layout. If the product requires a
    wider sidebar, keep it quiet and visually separated by a thin
    divider.
-   The main content starts with a small search row near the top,
    followed by a large page title.
-   Use approximately **56--72 px** horizontal content padding on wide
    desktop screens, reducing to **24--32 px** at tablet widths.
-   Keep the sidebar divider thin and low contrast. Avoid a heavy shadow
    between sidebar and content.
-   Use a maximum content width only if needed to prevent tiles from
    becoming excessively wide; preserve the airy grid.

### Note grid

-   Desktop: 3--4 columns depending on viewport width.
-   Tablet: 2 columns.
-   Mobile: 2 columns when tiles remain readable; switch to 1 column on
    very narrow screens or when accessibility text sizing requires it.
-   Target tile width on desktop: approximately **220--260 px** in the
    reference-like compact grid.
-   Grid gap: **24--32 px** desktop; **12--16 px** mobile.
-   Tiles should align into a clean grid, but their content can vary
    naturally.
-   Use CSS Grid rather than manually positioned tiles.
-   The grid may use a masonry-like rhythm only if the reference content
    requires it; do not introduce irregular staggered placement by
    default.

### Responsive behavior

-   Desktop: sidebar/rail visible; search and heading aligned with the
    grid.
-   Tablet: reduce workspace padding and grid gaps; preserve the large
    heading.
-   Mobile: hide or collapse the desktop rail into a compact
    top/navigation control; prioritize the note grid and editor content.
-   Prevent horizontal scrolling at all breakpoints.
-   Preserve comfortable touch targets of at least **44 × 44 px** for
    interactive controls.

------------------------------------------------------------------------

## 5. Shape, borders, and elevation

  -----------------------------------------------------------------------
  Element                             Specification
  ----------------------------------- -----------------------------------
  Note tile                           16--20 px corner radius

  Main workspace shell                20--28 px radius if inset within an
                                      outer canvas

  Circular action                     40--44 px diameter

  Search field/control                10--14 px radius or visually
                                      minimal

  Popover/menu                        12--16 px radius

  Sidebar divider                     1 px, subtle

  Tile border                         None by default; use a very subtle
                                      border only if needed for
                                      separation

  Shadow                              Minimal or none; rely on color and
                                      whitespace
  -----------------------------------------------------------------------

### Shadow guidance

The reference relies on shape and color rather than dramatic elevation.

``` css
--shadow-none: none;
--shadow-subtle: 0 2px 8px rgba(0, 0, 0, 0.04);
--shadow-popover: 0 8px 24px rgba(0, 0, 0, 0.12);
```

Use the subtle shadow sparingly. Do not give every tile a visible drop
shadow. Avoid layered shadows, glowing borders, glass blur, and
neumorphism.

------------------------------------------------------------------------

## 6. Core components

### 6.1 Navigation rail / sidebar

**Purpose:** Brand and primary actions, with minimal visual weight.

-   Brand name sits near the top-left.
-   Add-note action is a dark circular button with a centered plus icon.
-   Use a clean vertical rhythm; do not fill the sidebar with numerous
    boxed navigation links.
-   Separate the rail from the workspace with a single 1 px divider.
-   Light mode: white sidebar.
-   Dark mode: same charcoal as the main canvas, with subtle separators.
-   Hover states should be quiet: slight surface change, no bounce or
    scale animation.

### 6.2 Search

-   Place near the top of the content area, before the page title.
-   Use a small search icon and muted placeholder.
-   Avoid a large outlined input unless the interaction requires a
    visible field.
-   Focus state: clear but restrained border/ring, never a bright
    glowing effect.
-   Search should not dominate the page.

### 6.3 Page heading

-   Large, bold, left-aligned "Notes" title.
-   Leave generous space between the search row, heading, and note grid.
-   Do not add a subtitle, stats, breadcrumbs, filters, or dashboard
    widgets unless required by the product.

### 6.4 Note tile

**The signature component of the interface.**

Structure: - Pastel background. - Note title or preview at the
upper-left. - Date near the bottom-left. - Optional favorite control
near the top-right. - Optional edit action near the bottom-right.

Rules: - Padding: **22--26 px** on desktop; **14--18 px** on mobile. -
Radius: **16--20 px**. - Use dark text on all pastel tile colors. - Keep
title and date separated using a flex column layout; metadata should sit
at the bottom when the tile has a defined minimum height. - Use a
consistent minimum height around **220--245 px** for a reference-like
desktop grid. Allow taller tiles when content length or responsive
layout needs it. - Clamp preview text only when the design requires a
tidy grid; retain the full note content in the editor. - The tile itself
should be clickable to open the note. Keep edit and favorite controls as
separate accessible actions. - Avoid putting every note inside an
additional white card. The colored tile **is** the card.

Suggested component structure:

``` text
NoteTile
├── NotePreview
├── MetadataRow
│   └── UpdatedDate
├── FavoriteButton (optional)
└── EditButton (optional)
```

### 6.5 Add-note button

-   Circular, near-black background in light mode.
-   Charcoal raised background in dark mode where needed for separation.
-   White plus icon, centered.
-   Diameter: **42--48 px**.
-   No gradient, no colored outer glow.
-   Hover: slight opacity/surface change.
-   Active: subtle press feedback, not a large scale animation.

### 6.6 Edit action

-   Small circular dark action button placed at the lower-right of the
    tile when shown.
-   Use a simple pencil/edit icon.
-   Keep the icon crisp and centered; use a 16--18 px icon inside a
    40--44 px target.
-   Provide an accessible name such as "Edit note".
-   On mobile, preserve the touch target even if the visual icon remains
    small.

### 6.7 Favorite action

-   Compact star icon, visually distinct but not oversized.
-   Use a yellow star on a dark circular surface, matching the
    reference.
-   Active and inactive states must be distinguishable without relying
    only on color; use filled versus outline star shapes or
    `aria-pressed`.
-   Do not add a large badge or label.

### 6.8 Note editor / reading view

-   The editor should feel like a focused reading surface, not a
    form-heavy admin panel.
-   Dark mode: charcoal background, off-white title/body, muted date.
-   Title is prominent and left-aligned; date sits below it.
-   Body uses generous line height and readable line length.
-   Top controls (back, search, edit) should be compact rounded icon
    buttons.
-   Avoid heavy editor borders, toolbars full of buttons, and
    unnecessary panels.
-   Keep the note's pastel identity visible where appropriate, but
    prioritize reading comfort.

### 6.9 Iconography

-   Use one consistent outline icon family (Lucide is suitable).
-   Default icon stroke: **1.8--2 px**.
-   Typical icon size: **18--22 px**.
-   Use solid dark circular backgrounds for key actions when matching
    the reference.
-   Avoid mixing emoji, filled icons, and multiple icon families in the
    same control system.

------------------------------------------------------------------------

## 7. Light and dark mode behavior

Theme changes should affect the application chrome and text, **not the
identity of note tiles**.

### Light mode

-   Workspace: white.
-   Surrounding canvas: very pale blue-gray if the inset-shell
    composition is used.
-   Sidebar: white with a faint divider.
-   Primary text: near-black.
-   Secondary metadata: medium gray.
-   Actions: black circles with white icons.
-   Note tiles: warm, vivid pastels.

### Dark mode

-   App and editor canvas: charcoal (`#242424` range), not pure black.
-   Primary text: soft white.
-   Metadata: medium gray.
-   Raised icon controls: slightly lighter charcoal (`#383838` range).
-   Note tiles: preserve the same vivid pastel palette as light mode.
-   Tile text: near-black for contrast.
-   Avoid pure-white panels in dark mode and avoid inverting pastel note
    colors.

### Theme implementation

Use semantic CSS variables and a single theme attribute, for example:

``` css
:root,
[data-theme="light"] {
  color-scheme: light;
  --color-app-bg: #E8ECF5;
  --color-surface: #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-text-primary: #171717;
  --color-text-secondary: #626262;
  --color-text-muted: #929292;
  --color-border-subtle: #E8E8E8;
  --color-icon-bg: #111111;
  --color-icon-fg: #FFFFFF;
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-app-bg: #242424;
  --color-surface: #242424;
  --color-surface-raised: #303030;
  --color-text-primary: #F7F7F7;
  --color-text-secondary: #B5B5B5;
  --color-text-muted: #858585;
  --color-border-subtle: #3A3A3A;
  --color-icon-bg: #383838;
  --color-icon-fg: #FFFFFF;
}

:root {
  --note-apricot: #FFC96F;
  --note-coral: #FF9277;
  --note-lime: #E5F28B;
  --note-lavender: #B18AF3;
  --note-cyan: #08C4E5;
  --note-pink: #F5A4C6;
  --note-sky: #8EDCEB;
  --color-favorite: #FFD43B;
}
```

Persist the user's selected theme if the application supports
persistence. If using system preference, respect `prefers-color-scheme`
until the user makes an explicit choice. Avoid a flash of the wrong
theme on initial render.

------------------------------------------------------------------------

## 8. Motion and interaction

Motion should be quiet, quick, and functional.

  -----------------------------------------------------------------------
  Interaction                         Behavior
  ----------------------------------- -----------------------------------
  Tile hover                          Slight surface lift or subtle
                                      shadow; no dramatic zoom

  Icon button hover                   Small contrast/surface change

  Button press                        Brief, subtle pressed state

  Opening note                        Fast transition or immediate
                                      navigation; preserve context

  Theme switch                        Smooth color transition,
                                      approximately 150--220 ms

  Favorite toggle                     Immediate state change; optional
                                      small scale feedback

  Search focus                        Clear focus ring, no glow animation
  -----------------------------------------------------------------------

Recommended tokens:

``` css
--motion-fast: 120ms;
--motion-standard: 180ms;
--motion-theme: 200ms;
--easing-standard: cubic-bezier(0.2, 0, 0, 1);
```

Do not animate every element on page load. Respect
`prefers-reduced-motion: reduce`.

------------------------------------------------------------------------

## 9. Accessibility requirements

-   Use semantic buttons for create, edit, favorite, search, and
    navigation actions.
-   Provide accessible names for icon-only controls.
-   Maintain visible keyboard focus indicators in both themes.
-   Ensure note text and metadata meet appropriate contrast targets;
    increase muted text contrast if needed.
-   Do not use note color alone to communicate priority, favorite
    status, or other meaning.
-   Make the entire note tile keyboard accessible without trapping the
    edit/favorite controls inside an inaccessible nested interaction.
-   Touch targets should be at least 44 × 44 px where practical.
-   Support zoom and larger system font settings without clipping note
    content.

------------------------------------------------------------------------

## 10. Implementation guidance (React / Next.js / Tailwind)

-   Define colors as CSS variables and map them to Tailwind semantic
    colors.
-   Keep note palette values as a finite token list; store a note's
    chosen palette token rather than arbitrary inline color strings
    where possible.
-   Build reusable primitives: `AppShell`, `Sidebar`, `SearchField`,
    `PageHeading`, `NoteGrid`, `NoteTile`, `IconButton`, `NoteEditor`,
    `FavoriteButton`.
-   Keep theme state centralized and apply it at the app root.
-   Use CSS Grid for note layout and Flexbox inside tiles.
-   Avoid component-specific one-off spacing values unless a screenshot
    proves they are needed.
-   Separate visual styling from note behavior. The tile should remain
    visually consistent whether the note is favorite, selected, or being
    edited.
-   Prefer lightweight transitions and avoid animation libraries for
    simple hover/press states.

### Example note tile CSS

``` css
.note-tile {
  position: relative;
  display: flex;
  min-height: 232px;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px;
  border: 0;
  border-radius: 18px;
  color: #191919;
  background: var(--note-color, var(--note-apricot));
  transition: box-shadow var(--motion-standard) var(--easing-standard);
}

.note-tile:hover {
  box-shadow: var(--shadow-subtle);
}

.note-tile__preview {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.38;
  overflow-wrap: anywhere;
}

.note-tile__date {
  margin-top: 24px;
  color: rgba(25, 25, 25, 0.68);
  font-size: 13px;
  line-height: 1.3;
}
```

### Example note grid CSS

``` css
.note-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
}

@media (max-width: 1100px) {
  .note-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }
}

@media (max-width: 560px) {
  .note-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .note-tile {
    min-height: 190px;
    padding: 16px;
    border-radius: 16px;
  }

  .note-tile__preview {
    font-size: 15px;
  }
}
```

Adjust the mobile column count based on real device widths and text
length. If two columns make note previews cramped, use one column rather
than making the type too small.

------------------------------------------------------------------------

## 11. Do / Don't checklist

### Do

-   Use large, colorful pastel note tiles as the main visual event.
-   Keep the surrounding UI quiet, white/charcoal, and spacious.
-   Use bold, left-aligned page headings.
-   Keep date labels small and muted.
-   Use circular, high-contrast action buttons.
-   Preserve the same pastel palette in light and dark mode.
-   Use simple rounded geometry and restrained hover feedback.
-   Match screenshot proportions before adding new features.

### Don't

-   Do not turn the interface into a generic SaaS dashboard.
-   Do not add gradients, glassmorphism, glowing borders, or oversized
    shadows.
-   Do not wrap each tile in another card or panel.
-   Do not add charts, metrics, tabs, filters, or decorative widgets
    that are not in the reference.
-   Do not use different pastel palettes for light and dark themes.
-   Do not use pure black as the entire dark-mode canvas unless the
    reference explicitly requires it.
-   Do not center note text or make dates visually prominent.
-   Do not use excessive animations or hover scaling.
-   Do not change typography, radius, or spacing independently across
    components.

------------------------------------------------------------------------

## 12. Visual QA checklist

Before considering the implementation complete, compare the running UI
against both reference images at the same viewport dimensions.

-   [ ] Main shell placement, scale, and corner radius are close to the
    reference.
-   [ ] Sidebar width and divider placement match.
-   [ ] Search row sits above the large page heading.
-   [ ] Heading size and whitespace feel similar.
-   [ ] Note grid columns, tile sizes, and gaps match.
-   [ ] Pastel colors are close to the supplied reference.
-   [ ] Note text starts at consistent insets and wraps naturally.
-   [ ] Dates align near the bottom of tiles and remain visually
    secondary.
-   [ ] Favorite and edit controls are compact and correctly positioned.
-   [ ] Light mode uses a clean white workspace and pale outer canvas
    where applicable.
-   [ ] Dark mode uses charcoal surfaces and preserves the pastel note
    colors.
-   [ ] Editor typography and spacing support comfortable reading.
-   [ ] Mobile layouts remain legible and controls remain tappable.
-   [ ] Keyboard focus, contrast, and reduced-motion behavior work
    correctly.

**Final instruction to the coding assistant:** First reproduce the
reference layout and styling faithfully. Do not invent a new design
direction. If a measurement is ambiguous, use the closest visual
estimate and keep the decision centralized in a token so it can be tuned
after screenshot comparison.
