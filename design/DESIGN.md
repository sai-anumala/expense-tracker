---
name: Kinetic Ledger
colors:
  surface: '#f7f9ff'
  surface-dim: '#d5dae4'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4fe'
  surface-container: '#e9eef8'
  surface-container-high: '#e3e8f2'
  surface-container-highest: '#dde3ec'
  on-surface: '#161c23'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#2b3138'
  inverse-on-surface: '#ecf1fb'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c49'
  primary: '#006947'
  on-primary: '#ffffff'
  primary-container: '#00855b'
  on-primary-container: '#f5fff6'
  inverse-primary: '#69dba8'
  secondary: '#af301d'
  on-secondary: '#ffffff'
  secondary-container: '#fe684f'
  on-secondary-container: '#670700'
  tertiary: '#8a4c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ae6100'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#86f8c2'
  primary-fixed-dim: '#69dba8'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#ffdad4'
  secondary-fixed-dim: '#ffb4a6'
  on-secondary-fixed: '#3f0300'
  on-secondary-fixed-variant: '#8d1607'
  tertiary-fixed: '#ffdcc1'
  tertiary-fixed-dim: '#ffb778'
  on-tertiary-fixed: '#2e1500'
  on-tertiary-fixed-variant: '#6c3a00'
  background: '#f7f9ff'
  on-background: '#161c23'
  surface-variant: '#dde3ec'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-numeric-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  label-numeric-md:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  label-numeric-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system delivers a serene, distraction-free financial tracking experience built for everyday clarity and deliberate money management. Grounded in a modern fintech minimalist philosophy, the interface pairs the exactitude of modern ledger accounting with the approachable softness of contemporary consumer applications. 

The aesthetic conveys institutional security without the bureaucratic rigidity, fostering reassurance, financial autonomy, and effortless scanability. Surfaces remain light and breathable, relying on disciplined spatial pacing rather than heavy decorative elements. Visual weight is reserved strictly for meaningful signals: monetary totals, directional flows, and actionable categorization.

## Colors

The palette balances clinical precision with organic vitality, avoiding the sterile coldness of legacy banking tools.

- **Primary (`#0D9668`)**: A vibrant botanical emerald green signifying positive balance, net wealth gains, savings milestones, and compliant budget thresholds. It operates as the principal affirmative signpost.
- **Secondary (`#E0533C`)**: A balanced, high-legibility coral red deployed for expense deductions, deficit flags, and critical balance alerts without inducing undue panic.
- **Tertiary (`#E58517`)**: An assertive amber gold used for scheduled outflows, pending authorizations, budget exhaustion warnings (80–99%), and custom alert tags.
- **Neutral (`#1E242B`)**: A deep slate charcoal anchoring all structural text, icons, and prominent headers, avoiding the harsh glare of pure `#000000`.
- **Canvas & Surface Base**: The background environment is built on a soft porcelain foundation (`#F8FAFC`), supported by elevated surfaces in pure `#FFFFFF` and muted slate delineators (`#E2E8F0`).

### Category Palette Guidance
Category indicators utilize dedicated tints anchored by matching low-opacity backgrounds:
- **Groceries & Living**: Mint (`#059669` on `#ECFDF5`)
- **Dining & Leisure**: Sunset Coral (`#E0533C` on `#FFF1F0`)
- **Transport & Commute**: Sky Cyan (`#0284C7` on `#F0F9FF`)
- **Subscriptions & Utilities**: Indigo (`#4F46E5` on `#EEF2FF`)
- **Investments & Income**: Emerald (`#0D9668` on `#ECFDF5`)

## Typography

The typographic system pairs the razor-sharp geometric neutrality of **Hanken Grotesk** with the structural clarity of **JetBrains Mono** for data columns and monetary amounts.

- **Primary Voice (Hanken Grotesk)**: Drives all editorial balance statements, account names, category headings, and microcopy. Its generous x-height and precise apertures maintain extreme legibility on OLED mobile displays without visual fatigue.
- **Ledger Voice (JetBrains Mono)**: Reserved strictly for numerical financial quantities, timestamps, transaction tallies, and percentage differentials. Monospaced tabular alignment guarantees that decimal columns remain visually plumb regardless of digit widths.
- **Hierarchy Rules**: Transaction values over 24px must use `label-numeric-lg`. All date dividers and category group badges use `label-caps` in uppercase styling.

## Layout & Spacing

The layout is built around a mobile-first 4-column dynamic grid bounded by a uniform outer margin of `1.25rem` (20px) to maximize thumb reach and prevent accidental edge tapping.

- **Vertical Rhythm**: Spacing is paced in standard multiples of 4px. Structural groupings (such as separate calendar days in an activity feed) use `space-xl` (24px). Spacing between a list item's internal avatar, title, and trailing total uses `space-md` (12px).
- **Mobile Container**: Content conforms strictly to a maximum mobile viewport width of 480px, maintaining an edge safe-area inset at both the top navigation bar and bottom floating action dock.
- **Section Stack**: Feed items are nested within self-contained card collections bounded by `space-sm` (8px) internal row padding and `space-lg` (16px) perimeter card padding.

## Elevation & Depth

Visual hierarchy employs a multi-tiered surface system that blends low-contrast containment strokes with soft, colored ambient shadows to keep card surfaces crisp against the porcelain canvas.

- **Canvas Tier (Base)**: The default background rests on `#F8FAFC`. It features zero shadow elevation and serves as the structural floor.
- **Surface Level 1 (Card & Module Deck)**: Resting cards utilize `#FFFFFF`, bound by a crisp 1px border of `#E2E8F0` and an ambient drop shadow: `0px 2px 8px -2px rgba(30, 36, 43, 0.04), 0px 1px 3px -1px rgba(30, 36, 43, 0.02)`.
- **Surface Level 2 (Selected Cards & Popovers)**: Active transaction drawers and focused summary cards rise above the deck with `0px 8px 24px -4px rgba(30, 36, 43, 0.08), 0px 2px 6px -1px rgba(30, 36, 43, 0.03)` and a soft border of `#CBD5E1`.
- **Surface Level 3 (Action Bars & Quick-Add Dock)**: Floating interaction layers, such as the bottom action dock, feature a subtle backdrop blur (`12px`) with an 85% translucent white base (`rgba(255, 255, 255, 0.85)`), finished with an ambient top-shadow: `0px -4px 16px rgba(30, 36, 43, 0.05)`.

## Shapes

The interface embraces a balanced curvature model (`roundedness: 2`) that softens financial data without compromising layout density.

- **Standard Elements (`0.5rem` / 8px)**: Input fields, list item selections, and category icons.
- **Container Surfaces (`1rem` / 16px)**: Primary account overview cards, budget cards, and transaction group containers (`rounded-lg`).
- **Sheets & Drawers (`1.5rem` / 24px)**: Bottom action sheets, transaction logging dialogs, and modal viewports (`rounded-xl`). Top corners only are curved when anchored to screen bottoms.
- **Special Elements (Full Pill)**: Category chips, contextual status badges, quick-filter buttons, and floating action buttons utilize complete rounded pills (`9999px`) to immediately distinguish actionable interactive tags from structural card containers.

## Components

### Buttons
- **Primary Action (Add Transaction / Transfer)**: Solid fill in `#1E242B` with crisp white text (`#FFFFFF`), 48px height, `0.75rem` radius, and bold font weight. Focus states show an emerald ring outline (`2px` solid `#0D9668`).
- **Secondary Action**: Background `#FFFFFF`, 1px solid `#E2E8F0`, deep slate text (`#1E242B`). On touch, shifts to `#F1F5F9`.
- **Destructive Action**: Subdued coral tint background (`#FEF2F2`) with `#E0533C` text, rising to solid `#E0533C` fill on confirmation state.

### Chips & Category Pills
- Height fixed at 28px or 32px with full pill curvature (`9999px`).
- Built from a paired color model: light tinted background (e.g., `#ECFDF5`) containing a 6px circular category dot and semi-bold text in the primary category shade (`#0D9668`).
- Filter chips toggle from a neutral slate-gray background (`#F1F5F9`) to an inverted active state (`#1E242B` with `#FFFFFF` text).

### Transaction Lists & Ledger Rows
- Minimum touch target: 56px height.
- **Structure**: Left-aligned 40px rounded icon container with category tint, followed by title and relative timestamp stacked vertically (`body-md` and `body-sm`). 
- **Trailing Amount**: Right-aligned `label-numeric-md`. Outflows are prefixed with a minus sign in `#1E242B` or `#E0533C`. Inflows are prefixed with a plus sign in vibrant emerald green (`#0D9668`).
- Divided by 1px subtle horizontal divider rules (`#F1F5F9`), terminating `1rem` prior to the trailing margin.

### Checkboxes & Segmented Controls
- **Radio / Check Indicators**: 20px boxes with 6px border radius. Unchecked state features an outline in `#CBD5E1`. Checked state animates to a solid `#0D9668` fill with an interior white checkmark.
- **Segmented Range Control (Day / Week / Month / Year)**: Enclosed within a `#F1F5F9` pill container; selected segment slides a `#FFFFFF` elevated pill with `0px 2px 4px rgba(30, 36, 43, 0.06)` beneath the active label.

### Input Fields (Expense Entry)
- **Monetary Keypad Input**: Displayed prominently using `display-lg` typography in JetBrains Mono. Clean baseline alignment with an automatic currency symbol prefix rendered at 60% opacity.
- **Form Text Fields**: 48px height with 1px border in `#E2E8F0`, background in `#FFFFFF`, shifting to a 1.5px `#0D9668` border upon focus. Helper text and field labels sit in `body-sm` slate above the input.

### Metric Cards & Budget Bars
- **Hero Balance Card**: White surface with a 1px slate-gray stroke (`#E2E8F0`). Shows total net worth in `display-lg`, accompanied by a 24-hour differential badge (pill-shaped tag in green or coral).
- **Progress Trackers**: 6px height tracks with full rounded caps (`#F1F5F9`). Progress fills in `#0D9668` (0–79%), switching to `#E58517` (80–99%) and `#E0533C` (100%+ over budget).