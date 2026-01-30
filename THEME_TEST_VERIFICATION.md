# Theme Test Verification Guide

## QA Subtask: Run Theme Tests

This document provides instructions for running and verifying the theme tests for the Code-Auto application.

## Test Files to Execute

1. `e2e/theme-visual-test.spec.ts` - Visual regression testing across all three themes
2. `e2e/theme-audit.spec.ts` - Automated audit of theme implementation

## Prerequisites

Before running the tests, ensure:

- ✅ Node.js and Yarn are installed
- ✅ All dependencies are installed (`yarn install`)
- ✅ No other instance of the app is running on port 3000

## Running the Tests

### Option 1: Run All Theme Tests

```bash
yarn test:e2e e2e/theme-visual-test.spec.ts e2e/theme-audit.spec.ts
```

### Option 2: Run Individual Tests

```bash
# Visual test only
yarn test:e2e e2e/theme-visual-test.spec.ts

# Audit test only
yarn test:e2e e2e/theme-audit.spec.ts
```

### Option 3: Run with UI Mode (Recommended for Debugging)

```bash
yarn test:e2e:ui
```

Then select the theme test files from the UI.

### Option 4: Run in Headed Mode (Watch Tests Execute)

```bash
yarn test:e2e:headed e2e/theme-visual-test.spec.ts e2e/theme-audit.spec.ts
```

## What the Tests Verify

### Theme Visual Test (`theme-visual-test.spec.ts`)

This test captures screenshots of all three themes and verifies:

1. **Modern Dark Theme** (default)
   - Main page layout and styling
   - New Task modal with dark theme colors
2. **Light Mode Theme**
   - Proper color inversion for light backgrounds
   - Modal components with light theme styling
3. **Retro Terminal Theme**
   - Classic CRT aesthetic with green-on-black colors
   - Modal components with retro styling

**Expected Output:**

- ✅ 6 screenshots saved to `e2e/screenshots/`:
  - `theme-modern-dark.png`
  - `theme-modern-dark-modal.png`
  - `theme-light.png`
  - `theme-light-modal.png`
  - `theme-retro.png`
  - `theme-retro-modal.png`

### Theme Audit Test (`theme-audit.spec.ts`)

This test performs a comprehensive audit of theme implementation:

1. **Main Page Background** - Verifies dynamic background color
2. **Kanban Board Styling** - Checks board container colors
3. **Phase Columns** (6 columns) - Audits:
   - Background colors
   - Border colors
   - Text colors
4. **Task Cards** - Verifies:
   - Card background
   - Card borders
   - Text colors
5. **New Task Modal** - Checks:
   - Modal background
   - Modal text colors
   - Input field styling
   - Border styling
6. **Theme Switching** - Tests:
   - Dark to Light theme transition
   - Light to Retro theme transition
7. **Screenshots** - Captures all three themes for visual inspection

**Expected Output:**

- ✅ Console output showing color values for all components
- ✅ 3 screenshots saved to `e2e/screenshots/`:
  - `theme-dark-default.png`
  - `theme-light.png`
  - `theme-retro.png`
- ✅ Audit report showing no hardcoded colors

## Success Criteria

### ✅ Tests Pass If:

1. **All tests complete without errors**
   - No test failures
   - No timeout errors
   - No element not found errors

2. **Screenshots are generated successfully**
   - All 6+ screenshot files are created in `e2e/screenshots/`
   - Screenshots show distinct visual differences between themes
   - No white/blank screenshots

3. **Theme audit shows proper implementation**
   - All components use CSS variables (`var(--color-*)`)
   - No hardcoded Tailwind color classes (e.g., `bg-slate-800`, `text-slate-400`)
   - Color values change appropriately between themes

4. **Visual consistency**
   - Dark theme: Slate tones (#0f172a, #1e293b, #334155)
   - Light theme: Bright whites and subtle grays (#ffffff, #f8fafc)
   - Retro theme: Green-on-black (#00ff00 on #000000)

## Verifying Theme Consistency

### Check for Hardcoded Colors

After tests run, the audit should confirm NO instances of:

- `bg-slate-*` classes (unless in theme-agnostic components)
- `text-slate-*` classes
- `border-slate-*` classes
- Hardcoded hex colors in JSX (e.g., `style={{ color: '#334155' }}`)

### Check CSS Variables Usage

Components should use:

- `var(--color-background)`
- `var(--color-surface)`
- `var(--color-text-primary)`
- `var(--color-border)`
- And other theme variables defined in `globals.css`

## Theme System Architecture

### Configuration Files

1. **`src/lib/themes/theme-config.ts`** - Theme definitions and color palettes
2. **`src/app/globals.css`** - CSS variable declarations
3. **`src/components/theme/theme-provider.tsx`** - Dynamic theme application
4. **`src/store/theme-store.ts`** - Theme state management

### Recently Modified Files (Per Git Status)

The following modal files were recently updated for theme consistency:

- `src/components/tasks/new-task-modal.tsx`
- `src/components/tasks/planning-logs-modal.tsx`
- `src/components/tasks/task-detail-modal.tsx`

These files now use CSS variables instead of hardcoded colors.

## Troubleshooting

### Port Already in Use

If you see "Port 3000 is already in use":

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Then rerun tests
yarn test:e2e e2e/theme-visual-test.spec.ts
```

### Test Timeouts

If tests timeout waiting for elements:

- Ensure dev server starts properly (check `yarn next:dev` works)
- Increase timeout in `playwright.config.ts` if needed
- Check that test-ids exist in components

### Screenshots Not Generated

If screenshots folder is missing:

```bash
mkdir -p e2e/screenshots
yarn test:e2e e2e/theme-visual-test.spec.ts
```

### Theme Not Switching

If theme switcher doesn't work in tests:

- Verify theme store is properly initialized
- Check that theme provider wraps the app in `layout.tsx`
- Ensure theme selector has correct test-ids

## Expected Console Output

### Theme Visual Test

```
📸 Capturing Modern Dark theme...
📸 Capturing Light theme...
📸 Capturing Retro Terminal theme...
✅ All theme screenshots captured successfully!
📁 Check e2e/screenshots/ folder
```

### Theme Audit Test

```
=== THEME AUDIT REPORT ===

1. Main page background: rgb(15, 23, 42)
2. Kanban board background: rgb(15, 23, 42)

3. Found 6 phase columns
   Column column-discovery:
     - Background: rgb(30, 41, 59)
     - Border: rgb(139, 92, 246)
     - Text: rgb(255, 255, 255)
   [... more columns ...]

4. Found X task cards
   First task card:
     - Background: rgb(30, 41, 59)
     - Border: rgb(51, 65, 85)
     - Text: rgb(255, 255, 255)

5. New Task Modal visible: true
   Modal styling:
     - Background: rgb(30, 41, 59)
     - Text: rgb(255, 255, 255)
     - Border: rgb(51, 65, 85)
   [... more details ...]

6. Testing Light Theme
   Found 3 theme options

7. Taking screenshots for visual inspection
   ✓ Saved: theme-dark-default.png
   ✓ Saved: theme-light.png
   ✓ Saved: theme-retro.png

=== END AUDIT ===

Check e2e/screenshots/ for visual comparison
```

## Post-Test Verification

After running the tests:

1. **Check test results** - All tests should pass (green checkmarks)
2. **Review screenshots** - Open `e2e/screenshots/` and verify:
   - Distinct visual appearance for each theme
   - Modals render correctly in all themes
   - No broken layouts or missing styles
3. **Review console output** - Verify color values match theme definitions
4. **Check for regressions** - Compare with previous screenshots if available

## Manual Verification (Optional)

If automated tests are inconclusive, perform manual verification:

1. Start the app: `yarn start`
2. Open New Task modal
3. Switch between themes using sidebar selector
4. Verify:
   - All colors update correctly
   - No hardcoded colors remain
   - Modal dialogs look consistent
   - No visual glitches or flashing

## Theme Test Coverage

### ✅ Covered Components

- Main page background
- Sidebar
- Kanban board and columns
- Task cards
- New Task modal
- Theme switcher
- Input fields
- Buttons
- Borders and shadows

### 📋 Not Covered (Out of Scope)

- Planning Logs modal (covered by separate test)
- Task Detail modal (covered by separate test)
- Delete Task modal (covered by separate test)
- Agent terminal (separate test needed)

## Reporting Results

After running tests, document:

1. ✅ **Pass/Fail Status** - Did all tests pass?
2. 📊 **Test Duration** - How long did tests take?
3. 📸 **Screenshots Generated** - List all files created
4. 🐛 **Issues Found** - Any visual regressions or theme inconsistencies?
5. 💡 **Recommendations** - Any improvements needed?

## Related Documentation

- `VISUAL_TEST_GUIDE.md` - General visual testing guide
- `QA_VERIFICATION_SUMMARY.md` - Overall QA status
- `QA_THEME_VERIFICATION_REPORT.md` - Detailed theme verification report
- `docs/COMPONENTS.md` - Component architecture

---

**Test Execution Status:** ⏳ Pending - Ready to run

**Last Updated:** January 31, 2026
