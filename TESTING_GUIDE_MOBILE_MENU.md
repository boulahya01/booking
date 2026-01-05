# 📱 Mobile Menu Testing Guide

## Quick Test Checklist

### ✅ Pre-Test Setup
- [ ] Frontend running: `npm run dev` in `frontend/` directory
- [ ] Backend running: Supabase local or cloud instance
- [ ] Browser at http://localhost:5173
- [ ] Test user accounts available (admin and student)

---

## Desktop Testing (≥ 768px)

### 1. Navigation Bar Visible
- [ ] Traditional horizontal navigation bar shows below header
- [ ] Links visible: "Bookings" and admin links (if admin)
- [ ] No hamburger button visible
- [ ] Hover effects work on nav links

### 2. Header Display
- [ ] Title: "Football Pitch Booking System"
- [ ] Welcome message with student ID
- [ ] **NEW:** Role badge shows (👤 Admin or 👤 Student)
- [ ] Approval status badge shows (✓ Approved or ⏳ Pending)
- [ ] Logout button visible

### 3. Admin Features (as admin user)
- [ ] "Admin: Users" link visible in nav
- [ ] "Admin: Pitches" link visible in nav
- [ ] "👤 Admin" badge displayed
- [ ] Can navigate to /admin/users (works)
- [ ] Can navigate to /admin/pitches (NOW WORKS - was broken)

---

## Mobile Testing (< 768px - Resize Browser Window)

### 1. Hamburger Button Appears
- [ ] Three horizontal lines button appears (top-left area)
- [ ] Button is clickable
- [ ] Button stays visible when scrolling
- [ ] Navigation bar is hidden (not visible)

### 2. Menu Toggle Functionality
- [ ] Click hamburger → menu slides out from left
- [ ] Overlay appears (semi-transparent background)
- [ ] Click overlay → menu slides back in
- [ ] Click hamburger again → menu toggles close

### 3. Mobile Menu Content
- [ ] Menu header shows "Menu" title
- [ ] User avatar visible (first letter of student ID)
- [ ] User ID displayed
- [ ] User role displayed (Admin or Student)

### 4. Navigation Links in Mobile Menu
- [ ] "📗 Bookings" link visible
- [ ] "🚪 Logout" link visible
- [ ] **If Admin:**
  - [ ] "👥 Admin: Users" link visible
  - [ ] "⚽ Admin: Pitches" link visible
- [ ] **If Student:**
  - [ ] Admin links NOT visible

### 5. Menu Navigation
- [ ] Click "Bookings" → navigates to /bookings and menu closes
- [ ] Click "Admin: Users" (if admin) → navigates and menu closes
- [ ] Click "Admin: Pitches" (if admin) → navigates and menu closes
- [ ] Click "Logout" → logs out and redirects

### 6. Role Badges on Mobile
- [ ] "👤 Admin" or "👤 Student" badge visible in header
- [ ] Approval badge (✓ Approved or ⏳ Pending) visible
- [ ] Badges wrap nicely on small screens
- [ ] No overlapping text

---

## Admin-Specific Testing

### For /admin/pitches Page:
- [ ] **Before Fix:** Stuck on "Loading..." (BROKEN)
- [ ] **After Fix:** Should now load pitch list (FIXED)
- [ ] Can edit pitch names and times
- [ ] Can save changes
- [ ] Can cancel edits
- [ ] **Mobile:** Can access via hamburger menu

### For /admin/users Page:
- [ ] Shows list of pending users
- [ ] Can approve/reject users
- [ ] Buttons work correctly
- [ ] **Mobile:** Can access via hamburger menu

### Non-Admin Access Control:
- [ ] Non-admin navigates to /admin/pitches
- [ ] Shows "Access denied. Admin only." message
- [ ] Automatically redirects after 2 seconds
- [ ] Works on both desktop and mobile

---

## Role Badge Testing

### Admin User:
- [ ] See "👤 Admin" badge (green background, white text)
- [ ] Badge appears in:
  - [ ] Desktop header
  - [ ] Mobile header
  - [ ] Mobile menu user info

### Student User:
- [ ] See "👤 Student" badge (blue background, white text)
- [ ] Badge appears in:
  - [ ] Desktop header
  - [ ] Mobile header
  - [ ] Mobile menu user info

### Approval Status Badges:
- [ ] Approved: "✓ Approved" (green background)
- [ ] Pending: "⏳ Pending" (yellow background)
- [ ] Shows alongside role badge
- [ ] Multiple badges don't overlap

---

## Responsive Testing

### Test Breakpoints:
```
Mobile (< 768px):
- 320px (iPhone SE)
- 375px (iPhone X)
- 480px (Android)
- 600px (Tablet portrait)
- 768px (edge case)

Desktop (≥ 768px):
- 768px (edge case)
- 1024px (iPad landscape)
- 1200px (Desktop)
- 1920px (Full desktop)
```

### Test Procedure:
1. Open DevTools (F12)
2. Click device toolbar icon (mobile view)
3. Select each breakpoint
4. Verify menu appears/disappears at 768px boundary
5. Test navigation at each breakpoint

---

## Cross-Browser Testing

### Desktop Browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Mobile Browsers:
- [ ] Chrome Mobile
- [ ] Safari Mobile (iOS)
- [ ] Firefox Mobile
- [ ] Samsung Internet

---

## Accessibility Testing

### Keyboard Navigation:
- [ ] Tab through hamburger button
- [ ] Enter/Space activates menu toggle
- [ ] Tab through menu links
- [ ] Escape closes menu
- [ ] Focus visible on interactive elements

### Screen Reader Testing:
- [ ] Hamburger button has aria-label
- [ ] Menu overlay marked properly
- [ ] Links descriptive and clickable
- [ ] Avatar text accessible

---

## Performance Testing

### Mobile Menu Performance:
- [ ] Menu opens smoothly (no jank)
- [ ] Navigation transitions are smooth
- [ ] No console errors
- [ ] Page load time acceptable
- [ ] Memory usage reasonable

### CSS Animations:
- [ ] Hamburger button animation smooth
- [ ] Menu slide-out animation smooth
- [ ] Overlay fade smooth
- [ ] No CSS flickering

---

## Error Scenario Testing

### What Should Work:
- [ ] Login → Hamburger appears on mobile
- [ ] Register → Role badge shows immediately
- [ ] Pending approval → Menu accessible
- [ ] Already logged in → Menu persists
- [ ] Admin redirect → Works on mobile

### What Should NOT Happen:
- [ ] ❌ Menu doesn't close on navigation
- [ ] ❌ Hamburger button disappears on mobile
- [ ] ❌ Desktop nav hides on desktop
- [ ] ❌ Role badges not showing
- [ ] ❌ AdminPitches page stuck loading
- [ ] ❌ Admin links showing for students

---

## Test Results Template

```
Date: __________
Tester: __________
Browser: __________
Device: __________
OS: __________

Desktop (≥768px):
- Navigation Bar: [ ] Pass [ ] Fail
- Header Display: [ ] Pass [ ] Fail
- Admin Links: [ ] Pass [ ] Fail
- Role Badges: [ ] Pass [ ] Fail

Mobile (<768px):
- Hamburger Button: [ ] Pass [ ] Fail
- Menu Toggle: [ ] Pass [ ] Fail
- Menu Content: [ ] Pass [ ] Fail
- Navigation: [ ] Pass [ ] Fail
- Role Badges: [ ] Pass [ ] Fail

Admin Features:
- /admin/pitches: [ ] Pass [ ] Fail
- /admin/users: [ ] Pass [ ] Fail
- Access Control: [ ] Pass [ ] Fail

Overall Status: [ ] PASS [ ] FAIL

Notes:
_________________________________
_________________________________
```

---

## Troubleshooting

### Menu Not Appearing on Mobile?
- [ ] Check browser width < 768px
- [ ] Check DevTools responsive mode activated
- [ ] Check MobileMenu.css is imported
- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Check console for JavaScript errors

### Role Badges Not Showing?
- [ ] Check user is authenticated
- [ ] Check profile has role field
- [ ] Check App.css has badge styles
- [ ] Check conditional rendering in App.tsx
- [ ] Look for console TypeScript errors

### AdminPitches Still Stuck Loading?
- [ ] Check AuthContext is loaded
- [ ] Check useAuth hook returns profile
- [ ] Check admin role in database
- [ ] Verify RLS policies allow access
- [ ] Check Supabase logs for errors

### Menu Doesn't Close on Navigation?
- [ ] Check setIsOpen(false) in handleNavigate
- [ ] Check event handlers are proper
- [ ] Check React router properly updating
- [ ] Verify useNavigate is from react-router-dom

---

## Sign-Off Checklist

Once all tests pass:

- [ ] All features working on desktop
- [ ] All features working on mobile
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Admin pages accessible and working
- [ ] Role badges display correctly
- [ ] Mobile menu appears/disappears at breakpoint
- [ ] Navigation works on all pages
- [ ] Responsive design verified
- [ ] Cross-browser tested
- [ ] Accessibility checked
- [ ] Performance acceptable

**Ready for Deployment:** YES / NO

---

**For Questions or Issues:** Check MOBILE_MENU_COMPLETE.md or IMPLEMENTATION_STATUS.md
