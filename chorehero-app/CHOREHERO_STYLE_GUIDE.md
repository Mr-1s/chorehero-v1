# ChoreHero Design System v2

Source of truth for visual design. Derived from the ChoreHero logo (warm yellow "Chore" + deep teal "Hero") and the marketplace model (two roles: Customer and Pro/Hero).

---

## 1. Brand Foundation

### Essence
- **Trust + Speed + Transparency**
- A marketplace where strangers enter homes — design must reduce anxiety fast.

### Voice & Tone
- **Short.** Target ≤12 words per CTA, ≤22 per body line.
- **Action verbs first.** "Book", "Request", "See pros near you".
- **Never condescending.** No "oops" / "uh oh" / emojis in chrome.
- **Transparent about state.** Always show price, ETA, and next step.

---

## 2. Color Palette (logo-derived)

### Primary
```ts
teal:       '#26B7C9'  // Primary CTA, active states, links
tealDeep:   '#047B9B'  // Secondary / Hero role emphasis
tealSoft:   '#E6F9FB'  // Tinted surfaces (selected chip, row hover)
```

### Signal
```ts
yellow:     '#E6B200'  // "Chore" accent, highlights, urgency
yellowSoft: '#FFF6D6'  // Promo chip / toast surfaces
```

### Semantic
```ts
success: '#10B981'
warning: '#F59E0B'
error:   '#EF4444'
info:    '#3B82F6'
```

### Neutrals
```ts
bg:         '#FAFBFC'  // App background
surface:    '#FFFFFF'  // Cards, sheets
surfaceAlt: '#F4F6F8'  // Inset panels
border:     '#E5E7EB'
borderSoft: '#F1F5F9'
borderHard: '#D1D5DB'
overlay:    'rgba(15,23,42,0.55)'
```

### Text
```ts
text: {
  primary:   '#0F172A',
  secondary: '#475569',
  muted:     '#94A3B8',
  inverse:   '#FFFFFF',
}
```

### Dark Mode (phase 2 tokens)
```ts
darkBg:      '#0B1220'
darkSurface: '#111827'
darkBorder:  '#1F2937'
darkText:    '#E5E7EB'
```

### Usage Rules
- **Max 3 color families per screen.**
- **Yellow is accent only.** Never as a background block or page BG.
- **Teal vs TealDeep**: Customer UI uses `teal`. Pro/Hero UI uses `tealDeep`.
- **Contrast**: All body text ≥4.5:1. Large text ≥3:1.

### Approved AA color pairs
- `#0F172A` on `#FFFFFF` (primary body)
- `#FFFFFF` on `#26B7C9` (primary CTA)
- `#FFFFFF` on `#047B9B` (pro-role CTA)
- `#0F172A` on `#E6B200` (yellow accent button)
- `#FFFFFF` on `#EF4444` (destructive)

---

## 3. Role Theming

Two runtime themes, already wired via `HERO_THEME` + `CUSTOMER_THEME`:

| Token | Customer | Pro / Hero |
|---|---|---|
| `primary` | `#26B7C9` | `#047B9B` |
| `primaryMuted` | `#E6F9FB` | `#DCEFF6` |
| `accent` | `#E6B200` | `#E6B200` |
| `navSurface` | `#FFFFFF` | `#0F1E33` |
| `navTextActive` | `#0F172A` | `#FFFFFF` |

Switch themes via role, not route. Never mix both primaries on one screen.

---

## 4. Typography

### Stack (single, not mixed)
```ts
family: '-apple-system, SF Pro, Inter, Roboto, sans-serif'
```

### Scale
```ts
display:  32 / 700 / -0.5   // Hero moments only
h1:       24 / 700 / -0.3
h2:       20 / 600 / -0.2
title:    17 / 600 / -0.1
body:     15 / 400 /  0
bodySm:   13 / 400 /  0.1
caption:  11 / 500 /  0.3
button:   15 / 600 /  0.2
```
`size / weight / letterSpacing`

### Rules
- Never weight below 400 for body.
- Title case for buttons; sentence case for body.
- Line height: body 1.4, headings 1.2.

---

## 5. Spacing & Layout

### 4px grid
```ts
spacing: { 0:0, 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 7:28, 8:32, 10:40, 12:48 }
```

### Layout
- Screen horizontal padding: **20**
- Card padding: **16–20**
- Section gap: **24–32**
- List row min height: **56**
- Touch target min: **44 x 44**

### Radii
```ts
radii: { xs:6, sm:8, md:12, lg:16, xl:20, pill:999 }
```
- Inputs `md`, cards `md–lg`, sheets `xl`, chips `pill`.

### Elevation
```ts
e1: shadowOpacity:0.05, radius:4,  offsetY:1
e2: shadowOpacity:0.08, radius:8,  offsetY:2
e3: shadowOpacity:0.12, radius:16, offsetY:6
e4: shadowOpacity:0.18, radius:24, offsetY:10
```
Use `e2` for cards, `e3` for sheets, `e4` for modals.

---

## 6. Core Components

### Button
- **Primary** — filled `teal`, radius `md`, height 48, text white 600.
- **Secondary** — outline `teal` 1.5px, transparent bg.
- **Tertiary** — text-only `teal`, no bg.
- **Destructive** — filled `error`.
- **Accent** — filled `yellow`, text `#0F172A`. Reserved for conversion moments.
- States: default / pressed (scale 0.98, opacity 0.9) / disabled (opacity 0.5) / loading (spinner replaces label).

### Input
- Height 48, radius `md`, border `border`, focus border `teal` + `e1`.
- Label above field (13 / 600). Helper text below (12 / 400 / muted). Error text `error`.

### Card
- `surface`, radius `md`, padding 16, `e2`. Interactive cards add press scale 0.99.

### Chip
- Pill radius, 12 vertical / 10 horizontal, `bodySm`.
- Selected: bg `tealSoft`, border `teal`, text `tealDeep`.

### List Row
- Avatar 40, title `title`, subtitle `bodySm/muted`, min-height 56, chevron right 16.

### Tab Bar
- Height 64 + safe area, `e3`, icons 22, active color = role primary.

### Sheet / Modal
- Radius top `xl`, handle bar 4x36, `overlay`, content padding 20, close affordance top-left or drag-down.

### Badge
- Solid for status (`success/warning/error/info`), soft for tags (surface: `tealSoft`, text: `tealDeep`).

### Skeleton
- Rounded rect, `#E5E7EB` base, subtle shimmer.

### Toast
- Bottom, radius `md`, `e3`, auto-dismiss 3s. Success/info/error color on left stripe.

---

## 7. States (must-haves per screen)

Every screen ships 5 states, no exceptions:
1. **Loading** — skeleton, never spinners on whole screens.
2. **Empty** — illustration + one-line explanation + one CTA.
3. **Error** — message + retry.
4. **Partial** — degraded data (offline / cached).
5. **Success** — confirmation with clear next step.

Use the same components across the 5 states for visual continuity.

---

## 8. Motion

### Tokens
```ts
duration: { fast:150, base:220, slow:320 }
easing: {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
  accel: 'cubic-bezier(0.3, 0, 1, 1)',
}
```

### Rules
- Transitions ≤320ms. No bounces on CTAs.
- Haptics: light on selection, medium on confirm, warning on error.
- Page transitions: slide_from_right stack; sheets use spring.

---

## 9. Iconography & Imagery

- **Icons**: Ionicons; 20 default, 22 nav, 16 inline. Stroke style only; never fill + stroke mixed.
- **Avatars**: real photos > initials > default silhouette (never generic cartoons).
- **Media**: videos dominate feed; images fill cards at 4:5 or 16:9. Always `resizeMode="cover"`.
- **Illustrations**: limited palette (teal + yellow + neutrals). No stock clipart.

---

## 10. Data Display Patterns

### Pricing
- Always cents in DB, dollars in UI. Format `$85` for whole numbers, `$85.50` otherwise.
- Range: `$80–$120`. Hourly: `$45/hr`.

### Time
- Relative under 24h (`in 2h`), absolute after (`Fri, Apr 26 · 10:00 AM`).
- Timezones: always show when cross-zone.

### Trust
- Show: verification badge, rating (1 decimal), jobs completed, photo.
- Never show: fake counts, "thousands of reviews" copy.

---

## 11. Accessibility

- Target ≥44x44; space ≥8 between targets.
- Dynamic type: honor system scaling up to 130%.
- `accessibilityLabel` on every interactive. `accessibilityRole` set correctly.
- Never convey meaning with color alone (pair with icon or text).
- Reduced Motion: halve durations, remove spring overshoot.

---

## 12. Anti-Patterns (do not ship)

- Two primary CTAs on one screen.
- Color-coded meaning with no label.
- Empty states saying "No data".
- Toasts for critical errors (use inline error).
- Emoji in navigation, buttons, or error messages.
- Coral / red-orange accents (retired).

---

## 13. Implementation

Source tokens live in `src/utils/constants.ts` and role tokens in `src/context/ThemeContext.tsx`. All screens consume tokens — no hex literals in components.

```ts
import { COLORS, TYPOGRAPHY, SPACING, RADII, SHADOWS } from '../utils/constants';
```

If a token is missing, add it to constants first, then use it. Never inline.

---

## 14. Quality Checklist (ship gate)

Visual
- [ ] Uses role theme tokens
- [ ] No hex literals outside `constants.ts`
- [ ] Follows spacing grid and radii
- [ ] Max 3 color families

Interaction
- [ ] Touch targets ≥44
- [ ] Pressed/disabled/loading states
- [ ] Haptics on confirm actions

States
- [ ] Loading / Empty / Error / Success implemented

Accessibility
- [ ] 4.5:1 text contrast
- [ ] Labels + roles on interactives
- [ ] Dynamic type works

Copy
- [ ] CTAs ≤12 words, action verb first
- [ ] No emojis in chrome

---

Living document — update tokens here first, then code.
