import { test, expect } from '@playwright/test';

/**
 * Theme integration E2E: verifies getTheme('ocean'|'forest'|'sunset'),
 * getAllThemes() (six themes), ThemeProvider/store, descriptions, and persistence.
 */
test.describe('Theme Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="sidebar"]');
  });

  test('theme switcher shows six theme options with correct display names', async ({ page }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);

    const options = page.locator('[role="option"]');
    await expect(options).toHaveCount(6);

    const labels = await options.allTextContents();
    const displayNames = labels.map((t) => t.trim().split('\n')[0]);
    expect(displayNames).toContain('Modern Dark');
    expect(displayNames).toContain('Light Mode');
    expect(displayNames).toContain('Retro Terminal');
    expect(displayNames).toContain('Ocean');
    expect(displayNames).toContain('Forest');
    expect(displayNames).toContain('Sunset');
  });

  test('theme switcher shows correct descriptions for all six themes', async ({ page }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);

    const options = page.locator('[role="option"]');
    await expect(options).toHaveCount(6);
    const fullTexts = await options.allTextContents();

    const expectedByDisplayName: Record<string, string> = {
      'Modern Dark': 'Sleek dark',
      'Light Mode': 'Clean',
      'Retro Terminal': 'Classic CRT',
      Ocean: 'Deep blue',
      Forest: 'emerald',
      Sunset: 'Warm dark',
    };
    for (const text of fullTexts) {
      const lines = text
        .trim()
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      const displayName = lines[0];
      const description = lines.slice(1).join(' ');
      expect(expectedByDisplayName[displayName], `display name "${displayName}"`).toBeDefined();
      expect(
        description.toLowerCase().includes(expectedByDisplayName[displayName].toLowerCase()),
        `"${displayName}" description should contain "${expectedByDisplayName[displayName]}"`
      ).toBeTruthy();
    }
  });

  test('selecting Ocean applies ocean theme CSS variables (ThemeProvider)', async ({ page }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.locator('text=Ocean').first().click();
    await page.waitForTimeout(500);

    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-background').trim()
    );
    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-primary').trim()
    );
    expect(bg).toBe('#0c1929');
    expect(primary).toBe('#06b6d4');
  });

  test('selecting Forest applies forest theme CSS variables (ThemeProvider)', async ({ page }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.locator('text=Forest').first().click();
    await page.waitForTimeout(500);

    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-background').trim()
    );
    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-primary').trim()
    );
    expect(bg).toBe('#0f1d14');
    expect(primary).toBe('#10b981');
  });

  test('selecting Sunset applies sunset theme CSS variables (ThemeProvider)', async ({ page }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.locator('text=Sunset').first().click();
    await page.waitForTimeout(500);

    const bg = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-background').trim()
    );
    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-primary').trim()
    );
    expect(bg).toBe('#1c1614');
    expect(primary).toBe('#f59e0b');
  });

  test('Ocean theme applies background, surface, text, terminal, and status vars', async ({
    page,
  }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.locator('text=Ocean').first().click();
    await page.waitForTimeout(500);

    const vars = await page.evaluate(() => {
      const root = document.documentElement.style;
      return {
        background: root.getPropertyValue('--color-background').trim(),
        surface: root.getPropertyValue('--color-surface').trim(),
        textPrimary: root.getPropertyValue('--color-text-primary').trim(),
        primary: root.getPropertyValue('--color-primary').trim(),
        terminalBackground: root.getPropertyValue('--color-terminal-background').trim(),
        terminalText: root.getPropertyValue('--color-terminal-text').trim(),
        statusCompleted: root.getPropertyValue('--color-status-completed').trim(),
        phasePlanning: root.getPropertyValue('--color-phase-planning').trim(),
      };
    });
    expect(vars.background).toBe('#0c1929');
    expect(vars.surface).toBe('#132f4c');
    expect(vars.textPrimary).toBe('#f1f5f9');
    expect(vars.primary).toBe('#06b6d4');
    expect(vars.terminalBackground).toBe('#0c1929');
    expect(vars.terminalText).toBe('#e0f2fe');
    expect(vars.statusCompleted).toBe('#10b981');
    expect(vars.phasePlanning).toBe('#14b8a6');
  });

  test('Forest theme applies background, surface, text, terminal, and status vars', async ({
    page,
  }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.locator('text=Forest').first().click();
    await page.waitForTimeout(500);

    const vars = await page.evaluate(() => {
      const root = document.documentElement.style;
      return {
        background: root.getPropertyValue('--color-background').trim(),
        surface: root.getPropertyValue('--color-surface').trim(),
        textPrimary: root.getPropertyValue('--color-text-primary').trim(),
        primary: root.getPropertyValue('--color-primary').trim(),
        terminalBackground: root.getPropertyValue('--color-terminal-background').trim(),
        terminalText: root.getPropertyValue('--color-terminal-text').trim(),
        statusCompleted: root.getPropertyValue('--color-status-completed').trim(),
        phasePlanning: root.getPropertyValue('--color-phase-planning').trim(),
      };
    });
    expect(vars.background).toBe('#0f1d14');
    expect(vars.surface).toBe('#14532d');
    expect(vars.textPrimary).toBe('#f0fdf4');
    expect(vars.primary).toBe('#10b981');
    expect(vars.terminalBackground).toBe('#0f1d14');
    expect(vars.terminalText).toBe('#d1fae5');
    expect(vars.statusCompleted).toBe('#10b981');
    expect(vars.phasePlanning).toBe('#059669');
  });

  test('Sunset theme applies background, surface, text, terminal, and status vars', async ({
    page,
  }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.locator('text=Sunset').first().click();
    await page.waitForTimeout(500);

    const vars = await page.evaluate(() => {
      const root = document.documentElement.style;
      return {
        background: root.getPropertyValue('--color-background').trim(),
        surface: root.getPropertyValue('--color-surface').trim(),
        textPrimary: root.getPropertyValue('--color-text-primary').trim(),
        primary: root.getPropertyValue('--color-primary').trim(),
        terminalBackground: root.getPropertyValue('--color-terminal-background').trim(),
        terminalText: root.getPropertyValue('--color-terminal-text').trim(),
        statusCompleted: root.getPropertyValue('--color-status-completed').trim(),
        phasePlanning: root.getPropertyValue('--color-phase-planning').trim(),
      };
    });
    expect(vars.background).toBe('#1c1614');
    expect(vars.surface).toBe('#2d221c');
    expect(vars.textPrimary).toBe('#fef3e2');
    expect(vars.primary).toBe('#f59e0b');
    expect(vars.terminalBackground).toBe('#1c1614');
    expect(vars.terminalText).toBe('#e8d5c4');
    expect(vars.statusCompleted).toBe('#10b981');
    expect(vars.phasePlanning).toBe('#10b981');
  });

  test('selected theme persists after page reload', async ({ page }) => {
    const trigger = page.locator('[data-testid="sidebar"] [role="combobox"]').first();
    await trigger.click();
    await page.waitForTimeout(300);
    await page.locator('text=Ocean').first().click();
    await page.waitForTimeout(500);

    const beforeReload = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--color-background').trim()
    );
    expect(beforeReload).toBe('#0c1929');

    await page.reload();
    await page.waitForSelector('[data-testid="sidebar"]');
    await expect(async () => {
      const bg = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--color-background').trim()
      );
      expect(bg).toBe('#0c1929');
    }).toPass({ timeout: 5000 });
  });
});
