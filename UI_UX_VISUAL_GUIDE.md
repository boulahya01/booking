# UI/UX Redesign - Visual Guide

## Layout Structure

### Desktop View (≥768px)
```
┌─────────────────────────────────────────────────┐
│  ⚽ PitchBook        [User Name]  [Admin]  [🚪]  │  ← Header
├──────────────┬─────────────────────────────────┤
│  Navigation  │                                 │
│              │                                 │
│  ⚽ Book      │                                 │
│  📅 Bookings │    Main Content Area           │
│  👤 Profile  │    (Home, Bookings, etc)       │
│              │                                 │
│  👥 Admin    │                                 │
│  🏟️ Pitches  │                                 │
│              │                                 │
│  🚪 Logout   │                                 │
└──────────────┴─────────────────────────────────┘
```

### Mobile/Tablet View (≤768px)
```
When Menu Closed:
┌──────────────────────────────┐
│ ☰  ⚽ PitchBook         [🚪]  │  ← Header
├──────────────────────────────┤
│                              │
│    Main Content Area         │
│    (Home, Bookings, etc)     │
│                              │
│                              │
└──────────────────────────────┘

When Menu Open (☰ clicked):
┌──────────────────────────────┐
│ ☰  ⚽ PitchBook         [🚪]  │  ← Header
├─────────────┬────────────────┤
│             │ Fades          │
│  ⚽ Book     │ when menu      │
│  📅 Bookings│ opens          │
│  👤 Profile │                │
│             │ Sidebar slides │
│  👥 Admin   │ from left      │
│  🏟️ Pitches │                │
│             │                │
│  🚪 Logout  │                │
└─────────────┴────────────────┘
```

## Color Scheme

```
Header Background:    Gradient Purple
                      #667eea → #764ba2

Text (Primary):       Dark Gray (#333)
Text (Secondary):     Medium Gray (#666)
Text (Muted):         Light Gray (#999)

Badges:
  Admin:              Red (#ff6b6b)
  Approved:           Green (#51cf66)
  Active Link:        Purple (#667eea)

Backgrounds:
  Main BG:            Very Light Gray (#f9f9f9)
  Card BG:            White
  Hover:              Light Gray (#f0f0f0)

Borders:              Light Gray (#e0e0e0)
```

## Navigation Items

```
Icon  Label              Route           Access
────────────────────────────────────────────────
⚽    Book Pitch         /               Approved
📅    My Bookings        /bookings       Approved
👤    Profile            /profile        Approved
👥    Admin: Users       /admin/users    Approved + Admin
🏟️    Admin: Pitches     /admin/pitches  Approved + Admin
🚪    Logout             /logout         Anytime
```

## Page Layouts

### Home Page (Book Pitch)
```
┌─────────────────────────────────┐
│  ⚽ Book Your Pitch              │
│  Select a pitch...              │
├─────────────────────────────────┤
│  [Pitch 1]  [Pitch 2]  [Pitch 3]│
├─────────────────────────────────┤
│  Operating Hours: 08:00 - 22:00 │
├─────────────────────────────────┤
│  📅 Today                        │
│  ┌─────────┐ ┌─────────┐       │
│  │ 08:00   │ │ 09:00   │       │
│  │ Available│ │ Booked  │       │
│  └─────────┘ └─────────┘       │
│                                 │
│  📅 Tomorrow                     │
│  ┌─────────┐ ┌─────────┐       │
│  │ 08:00   │ │ 09:00   │       │
│  │ Available│ │ Available│      │
│  └─────────┘ └─────────┘       │
└─────────────────────────────────┘
```

### Profile Page
```
┌─────────────────────────────────┐
│  👤 My Profile                  │
│  Manage your account info       │
├─────────────────────────────────┤
│  Account Information            │
│                                 │
│  Full Name: [________]          │
│  Email: user@example.com        │
│  Student ID: STU001             │
│  Role: Student                  │
│                                 │
│  [Save Changes]                 │
├─────────────────────────────────┤
│  Account Status                 │
│                                 │
│  User ID: abc12345              │
│  Role: [Student]                │
│  Created: Dec 20, 2024          │
│  Updated: Dec 20, 2025          │
└─────────────────────────────────┘
```

## Responsive Breakpoints

```
Breakpoint 1: Desktop (≥768px)
  ✓ Sidebar always visible
  ✓ Full user badge in header
  ✓ Grid layouts (2+ columns)
  ✓ Wide content areas

Breakpoint 2: Tablet (480px - 768px)
  ✓ Hamburger menu visible
  ✓ Sidebar collapses
  ✓ Grid becomes 1-2 columns
  ✓ Touch-optimized spacing

Breakpoint 3: Mobile (<480px)
  ✓ Hamburger menu required
  ✓ Single column layout
  ✓ Larger touch targets
  ✓ Reduced padding
```

## Interaction States

### Navigation Links
```
Normal State:
  Color: Dark gray (#333)
  BG: Transparent
  Border: None
  Icon: Normal size

Hover State:
  Color: Primary purple (#667eea)
  BG: Light gray (#f0f0f0)
  Border: None
  Icon: Slightly larger

Active State:
  Color: Primary purple (#667eea)
  BG: Light gradient background
  Border: Left border (4px, purple)
  Icon: Normal size
```

### Buttons
```
Primary Button (Book, Save, etc):
  BG: Gradient purple
  Text: White
  Hover: Slightly darker
  Active: Pressed state

Ghost Button (Category toggle):
  BG: Transparent
  Text: Gray
  Hover: Light background
  Active: Primary background + white text
```

## Animations

```
Sidebar Open/Close:
  Duration: 300ms
  Easing: ease

Menu Overlay:
  Fade in: 300ms
  Fade out: 200ms

Link Hover:
  Background fade: 200ms
  Color change: 200ms

Button Hover:
  Background change: 150ms
  Scale: Slight (no scale, just color)
```

## Typography

```
App Title (Header):
  Font: Bold
  Size: Desktop 2xl (28px), Mobile lg (18px)
  Color: White

Section Titles:
  Font: Bold
  Size: 2xl (28px)
  Color: Dark gray

Card Titles:
  Font: Semibold
  Size: xl (20px)
  Color: Dark gray

Body Text:
  Font: Regular
  Size: base (16px)
  Color: Medium gray

Labels:
  Font: Semibold
  Size: sm (14px)
  Color: Medium gray
  Transform: Uppercase
  Letter-spacing: 0.5px
```

## Touch Target Sizes

All interactive elements follow iOS/Android guidelines:

```
Minimum Touch Target: 44px × 44px

Navigation Links: 48px height
Buttons: 48px height
Input Fields: 48px height
Menu Toggle: 40px × 40px

Spacing Between Targets: 8px minimum
```

## Accessibility Features

```
✓ Semantic HTML (nav, main, header, aside)
✓ ARIA labels for screen readers
✓ Sufficient color contrast (4.5:1 WCAG AA)
✓ Keyboard navigable
✓ Focus indicators on links
✓ Touch-friendly sizing
✓ Clear error messages
✓ Form validation feedback
```

## Browser Support

```
✓ Chrome/Edge (latest)
✓ Firefox (latest)
✓ Safari (latest)
✓ Mobile browsers (iOS Safari, Chrome Mobile)

CSS Features Used:
  - Flexbox
  - Grid
  - CSS Variables
  - Linear Gradients
  - Box Shadows
  - Transitions (no animations)
```

---

**Design Philosophy**: 
- Content first, chrome second
- Mobile-first responsive design
- Clear visual hierarchy
- Consistent interactions
- Accessible to all users
