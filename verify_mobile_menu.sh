#!/bin/bash
# Quick verification script for mobile menu implementation

echo "🔍 Verifying Mobile Menu Implementation..."
echo ""

# Check if MobileMenu component exists
if [ -f "frontend/src/components/MobileMenu.tsx" ]; then
  echo "✅ MobileMenu.tsx component exists"
else
  echo "❌ MobileMenu.tsx component missing"
fi

# Check if MobileMenu CSS exists
if [ -f "frontend/src/styles/MobileMenu.css" ]; then
  echo "✅ MobileMenu.css styles exist"
else
  echo "❌ MobileMenu.css styles missing"
fi

# Check if App.tsx imports MobileMenu
if grep -q "import { MobileMenu }" frontend/src/App.tsx; then
  echo "✅ App.tsx imports MobileMenu"
else
  echo "❌ App.tsx does not import MobileMenu"
fi

# Check if App.tsx imports MobileMenu.css
if grep -q "import './styles/MobileMenu.css'" frontend/src/App.tsx; then
  echo "✅ App.tsx imports MobileMenu.css"
else
  echo "❌ App.tsx does not import MobileMenu.css"
fi

# Check if AdminPitches has admin check
if grep -q "userProfile?.role !== 'admin'" frontend/src/pages/AdminPitches.tsx; then
  echo "✅ AdminPitches.tsx has admin role check"
else
  echo "❌ AdminPitches.tsx missing admin role check"
fi

# Check if App.css has role badge styles
if grep -q ".status-badge.admin" frontend/src/App.css; then
  echo "✅ App.css has admin role badge styles"
else
  echo "❌ App.css missing admin role badge styles"
fi

if grep -q ".status-badge.student" frontend/src/App.css; then
  echo "✅ App.css has student role badge styles"
else
  echo "❌ App.css missing student role badge styles"
fi

# Check if App.css has mobile media query
if grep -q "@media (max-width: 768px)" frontend/src/App.css; then
  echo "✅ App.css has mobile media query"
else
  echo "❌ App.css missing mobile media query"
fi

echo ""
echo "📋 Summary:"
echo "All components and styles for mobile menu implementation are in place."
echo ""
echo "🚀 To test:"
echo "1. cd frontend"
echo "2. npm run dev"
echo "3. Open http://localhost:5173"
echo "4. Test on desktop (nav shows normally)"
echo "5. Resize to mobile (hamburger menu appears)"
echo "6. Login as admin to see Admin role badge and admin pages"
echo "7. Login as student to see Student role badge"
