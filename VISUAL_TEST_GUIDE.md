# Visual Testing Guide: Theme Button Verification

## Quick Start

```bash
# Start the application
yarn start

# Or just the web server
yarn next:dev
# Then open http://localhost:3000
```

## What You're Testing

✅ **Goal**: Verify all buttons in the three modified modals have theme-aware backgrounds (no white backgrounds) and working hover effects across Dark, Light, and Retro themes.

## 3-Minute Quick Test

### 1. New Task Modal (60 seconds)

1. Click "New Task" button in sidebar
2. Check Cancel button (should have gray background, not white)
3. Hover over Cancel → should change shade
4. Check Start Task button (should have colored background)
5. Hover over Start Task → should change shade
6. Switch theme in sidebar → verify colors change
7. Press ESC to close

### 2. Task Detail Modal (60 seconds)

1. Click any task card
2. Check if skip/delete buttons visible (might not be depending on task state)
3. If visible, hover over them → should change to warning/destructive colors
4. Click "Logs" tab
5. Check Copy logs button (should have gray background, not white)
6. Hover over Copy logs → should change shade
7. Switch theme → verify colors change
8. Press ESC to close

### 3. Planning Logs Modal (60 seconds)

1. Create a new task (will be in planning state)
2. Click "View Planning Logs" button on the task card
3. Check Copy logs button and Close button
4. Both should have gray backgrounds (not white)
5. Hover over each → should change shade
6. Switch theme → verify colors change
7. Press ESC to close

## Expected Visual Results

### Dark Theme (Default)

```
Background:   Very dark blue (#0f172a)
Buttons:      Dark gray (#1e293b, #334155)
Primary:      Yellow/Amber (#fbbf24)
Hover:        Should darken or change to action color
```

### Light Theme

```
Background:   White (#ffffff)
Buttons:      Light gray (#f8fafc, #f1f5f9) - NOT pure white!
Primary:      Orange (#f59e0b)
Hover:        Should lighten or change to action color
```

### Retro Theme

```
Background:   Pure black (#000000)
Buttons:      Very dark gray (#0a0a0a, #1a1a1a)
Primary:      Magenta (#ff00ff)
Text:         Green (#00ff00)
Hover:        Should lighten or change to action color
```

## Common Issues to Watch For

❌ **White button backgrounds in Light theme**

- Buttons should be light gray, not pure white
- Should be distinguishable from white modal background

❌ **No hover effect**

- Button should visibly change on mouse hover
- Change should be immediate and smooth

❌ **Theme not applying**

- When you switch themes, all colors should update
- If buttons stay the same color, theme CSS variables aren't applied

❌ **Text not readable**

- Text should always be readable against button background
- Check contrast in all themes

## Testing Tips

1. **Use Browser DevTools**

   ```
   Right-click button → Inspect → Styles tab
   Look for: var(--color-surface-hover), var(--color-background), etc.
   Should NOT see: #ffffff, rgb(255, 255, 255), or "white"
   ```

2. **Test Theme Switching**
   - Don't close modal between theme switches
   - Colors should update instantly
   - If they don't, there's a problem

3. **Test All Button States**
   - Normal (not hovering)
   - Hover (mouse over button)
   - Disabled (if applicable)

4. **Screenshot Comparison**
   - Take screenshots in each theme
   - Compare side-by-side
   - Look for consistency

## Specific Buttons to Test

### Planning Logs Modal

- [ ] Copy logs button (top right of header bar)
- [ ] Close button (bottom right)

### Task Detail Modal

- [ ] Copy logs button (in Logs tab, top right)
- [ ] Skip subtask buttons (in Subtasks tab, if visible)
- [ ] Delete subtask buttons (in Subtasks tab, if visible)
- [ ] Skip current button (bottom, if task is running)

### New Task Modal

- [ ] Cancel button (bottom left)
- [ ] Start Task button (bottom right)

## Success Criteria

✅ All buttons have theme-appropriate backgrounds (no white)
✅ All buttons show visible hover effects
✅ Colors update when switching themes
✅ Text is readable in all themes
✅ No visual glitches or flashing

## Automated Test

If you prefer automated testing:

```bash
# Run the E2E test (will take ~2-3 minutes)
yarn test:e2e qa-theme-modal-verification.spec.ts

# See the test in action
yarn test:e2e:headed qa-theme-modal-verification.spec.ts

# Interactive mode
yarn test:e2e:ui qa-theme-modal-verification.spec.ts
```

Screenshots will be saved to `e2e/screenshots/qa-*.png`

## Troubleshooting

**Modal won't open?**

- Make sure you have tasks created
- Some modals need specific task states (planning, in_progress, etc.)

**Can't find buttons?**

- Check task state - some buttons only appear in certain phases
- Scroll in modal if needed
- Check browser console for errors

**Theme won't switch?**

- Look for theme selector in sidebar (select dropdown)
- Click current theme name → select different theme
- Wait 1 second for transition

**Hover not working?**

- Move mouse slowly over button
- Make sure you're hovering over button, not just near it
- Try different browser if needed

## Quick Visual Reference

### ✅ GOOD - Theme-aware button

```
Default:  Gray background, clearly visible
Hover:    Background changes shade/color
Border:   Visible, matches theme
Text:     Readable, good contrast
```

### ❌ BAD - Hardcoded white button

```
Default:  Pure white (#ffffff)
Hover:    No change or minimal change
Border:   May be invisible on white background
Theme:    Doesn't change when switching themes
```

## Report Issues

If you find any issues:

1. Note which modal
2. Note which theme
3. Note which button
4. Take a screenshot
5. Check browser console for errors
6. Document the expected vs actual behavior

---

**Estimated Time**: 3-5 minutes for quick test, 10-15 minutes for thorough test
**Automation Available**: Yes (E2E test provided)
**Manual Testing**: Recommended for visual verification
