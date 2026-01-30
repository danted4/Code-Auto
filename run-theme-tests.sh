#!/bin/bash

# Theme Test Runner Script
# Executes the two critical theme tests for QA verification

set -e

echo "🎨 Code-Auto Theme Test Runner"
echo "================================"
echo ""
echo "This script will run the following tests:"
echo "  1. e2e/theme-visual-test.spec.ts"
echo "  2. e2e/theme-audit.spec.ts"
echo ""
echo "Prerequisites:"
echo "  ✓ Dependencies installed (yarn install)"
echo "  ✓ Port 3000 available"
echo ""
echo "Starting tests in 3 seconds..."
echo ""
sleep 3

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Warning: Port 3000 is already in use"
    echo "   Playwright will attempt to reuse the existing server"
    echo ""
fi

# Create screenshots directory if it doesn't exist
mkdir -p e2e/screenshots

# Run the theme tests
echo "🚀 Running theme tests..."
echo ""

yarn test:e2e e2e/theme-visual-test.spec.ts e2e/theme-audit.spec.ts

# Check if tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Theme tests completed successfully!"
    echo ""
    echo "📸 Screenshots saved to: e2e/screenshots/"
    echo ""
    echo "Generated files:"
    ls -lh e2e/screenshots/ | grep -E "theme-.*\.png" || echo "  (No screenshots found)"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Review screenshots in e2e/screenshots/"
    echo "  2. Check test report at: playwright-report/index.html"
    echo "  3. Verify all themes render correctly"
    echo ""
else
    echo ""
    echo "❌ Theme tests failed!"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "  1. Check the error messages above"
    echo "  2. Ensure dev server can start (yarn next:dev)"
    echo "  3. Verify test files exist"
    echo "  4. Review logs for detailed errors"
    echo ""
    echo "📖 See THEME_TEST_VERIFICATION.md for detailed troubleshooting"
    echo ""
    exit 1
fi
