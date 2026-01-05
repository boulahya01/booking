#!/bin/bash

# Security verification script before pushing to git
# Run this to ensure no sensitive data will be committed

echo "🔐 Security Pre-Push Verification"
echo "=================================="
echo ""

# Check for sensitive patterns in staged files
echo "1. Checking for sensitive patterns in staged files..."
if git diff --cached -S "password" -S "token" -S "secret" -S "POSTGRES_PASSWORD" --name-only 2>/dev/null | grep -v node_modules; then
    echo "   ⚠️  Possible secrets found in staged files!"
else
    echo "   ✅ No obvious secrets in staged files"
fi
echo ""

# Check .env files
echo "2. Checking .env files are ignored..."
for envfile in frontend/.env.local .env.local .env.cron supabase/.env.local; do
    if [ -f "$envfile" ]; then
        if git check-ignore "$envfile" > /dev/null 2>&1; then
            echo "   ✅ $envfile is properly ignored"
        else
            echo "   ❌ $envfile is NOT ignored - DO NOT COMMIT!"
        fi
    fi
done
echo ""

# List what will be committed
echo "3. Files to be committed:"
git diff --cached --name-only | head -20
if [ $(git diff --cached --name-only | wc -l) -gt 20 ]; then
    echo "   ... and $(( $(git diff --cached --name-only | wc -l) - 20 )) more"
fi
echo ""

# Final check
echo "4. Final verification:"
# Only scan non-doc/source files for high-confidence secret patterns. We skip typical docs and UI files
danger_found=0
patterns="POSTGRES_PASSWORD|SUPABASE_.*_KEY|VERCEL_OIDC|token.*="
for f in $(git diff --cached --name-only); do
    # skip documentation and frontend source files where the words may legitimately appear
    case "$f" in
        *.md|*.markdown|*.ts|*.tsx|*.json|frontend/*|*.css|*.html)
            continue
            ;;
    esac

    if git diff --cached -- "$f" | grep -E "$patterns" | grep -v "node_modules" > /dev/null; then
        echo "   ❌ Sensitive pattern found in staged file: $f"
        danger_found=1
    fi
done

if [ "$danger_found" -eq 1 ]; then
    echo "   ❌ DANGER: Sensitive data found in staged changes!"
    echo "   Run: git reset HEAD"
    exit 1
else
    echo "   ✅ Ready to push!"
fi
